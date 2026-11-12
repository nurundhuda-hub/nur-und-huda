import assert from 'node:assert/strict';
import { readFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Read-only, already-authorized browser check. No secret/content logging. */
export async function verifyStandaloneSermon(page, base, label) {
  const approved = JSON.parse(
    await readFile(
      '.sermon-review/second-sermon-merged-content-approved.json',
      'utf8',
    ),
  ).sermon;
  const route = `sermons/${approved.id}/${approved.revision}.html`;
  const errors = [];
  const onError = () => errors.push('pageerror');
  page.on('pageerror', onError);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto(base + 'sermons.html');
    await page.locator(`a[href$="${route}"]`).first().click();
    await page.waitForURL(base + route);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    assert.equal(
      await page.locator('.sermon-article h1').textContent(),
      approved.title,
    );
    assert.deepEqual(
      await page
        .locator('.sermon-article .khutbah-part .content-block')
        .allTextContents(),
      approved.parts.flat().map((b) => b.text),
    );
    assert.deepEqual(
      await page
        .locator('.sermon-article .sermon-introduction .content-block')
        .allTextContents(),
      approved.introduction.map((b) => b.text),
    );
    assert.equal(await page.locator('.sermon-article .study-link').count(), 0);
    assert.ok(await page.locator('.study-pending').isVisible());
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const screenshot = path.join(
      tmpdir(),
      `nur-${label}-merged-sermon-${width}.png`,
    );
    await page.screenshot({ path: screenshot });
    await chmod(screenshot, 0o600);
    await page.locator('[data-reader-open]').click();
    await page.locator('dialog[open]').waitFor();
    assert.deepEqual(
      await page
        .locator('dialog .khutbah-part .content-block')
        .allTextContents(),
      approved.parts.flat().map((b) => b.text),
    );
    const sizes = () =>
      page
        .locator('dialog .khutbah-part')
        .first()
        .evaluate((el) =>
          [el.querySelector('h2'), el.querySelector('p')].map((n) =>
            parseFloat(getComputedStyle(n).fontSize),
          ),
        );
    const before = await sizes();
    await page.locator('[data-font-step="2"]').click();
    const after = await sizes();
    assert.ok(after.every((v, i) => v > before[i]));
    await page.locator('[data-font-step="-2"]').click();
    assert.deepEqual(await sizes(), before);
    await page.locator('select[data-reader-theme]').selectOption('dark');
    assert.equal(
      await page
        .locator('#sermon-reader-dialog')
        .getAttribute('data-reader-theme'),
      'dark',
    );
    await page.locator('select[data-reader-theme]').selectOption('light');
    await page.evaluate(() => {
      window.__nurPrintCalls = 0;
      window.print = () => window.__nurPrintCalls++;
    });
    await page.locator('dialog [data-sermon-print]').click();
    assert.equal(await page.evaluate(() => window.__nurPrintCalls), 1);
    const readerShot = path.join(
      tmpdir(),
      `nur-${label}-merged-reader-${width}.png`,
    );
    await page.screenshot({ path: readerShot });
    await chmod(readerShot, 0o600);
    await page.locator('[data-reader-close]').click();
    await page.emulateMedia({ media: 'print' });
    assert.equal(
      await page
        .locator('.sermon-article')
        .evaluate((el) => getComputedStyle(el).display !== 'none'),
      true,
    );
    await page.emulateMedia({ media: 'screen' });
    const download = await page.locator('a[download]').getAttribute('href');
    assert.equal(
      (await page.request.get(new URL(download, base).href)).status(),
      200,
    );
  }
  assert.equal(
    (
      await page.request.get(
        base + 'studies/meaning-of-testimony-study/r1.html',
      )
    ).status(),
    404,
  );
  assert.deepEqual(errors, []);
  page.off('pageerror', onError);
  console.log(
    `PASS ${label}: exact merged sermon, normal navigation, RTL, no overflow, reader/font/theme/print/download at 320/390/768/1440; study withheld.`,
  );
}
