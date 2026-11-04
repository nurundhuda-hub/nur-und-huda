import assert from 'node:assert/strict';
import { chmod, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { verifyMawaqitMobile } from './mawaqit-mobile-browser.mjs';

// Called with an already authorized browser. Never logs cookies or article text.
export async function verifyBrandingAndSermon(page, base, label) {
  const approvedCatalog = JSON.parse(
    await readFile('.sermon-review/task27-public-catalog.json', 'utf8'),
  );
  const errors = [];
  const onError = (error) => errors.push(error.message);
  page.on('pageerror', onError);
  const dimensions = [];
  for (const width of [320, 375, 390, 430, 768, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto(base + 'index.html');
    await page.locator('.hero-logo').evaluate((image) => image.decode());
    await page.evaluate(() => document.fonts.ready);
    const size = await page.evaluate(() => {
      const image = document.querySelector('.hero-logo'),
        box = image.getBoundingClientRect();
      return {
        width: box.width,
        height: box.height,
        naturalWidth: image.naturalWidth,
        overflow: document.documentElement.scrollWidth > innerWidth,
        mask: getComputedStyle(image).maskImage,
        prayerTop: document
          .querySelector('.prayer-stage')
          .getBoundingClientRect().top,
      };
    });
    assert.equal(size.overflow, false, `Homepage overflow at ${width}`);
    assert.equal(size.naturalWidth, 1672);
    assert.ok(Math.abs(size.width / size.height - 1672 / 941) < 0.01);
    assert.equal(size.width, Math.min(width, 836));
    assert.equal(size.mask, 'none');
    assert.equal(await page.locator('.mission').count(), 0);
    assert.ok(!(await page.locator('body').innerText()).includes('منبر للذكر'));
    assert.equal(await page.locator('[data-mawaqit-card] iframe').count(), 1);
    dimensions.push({ viewport: width, ...size });
    const screenshot = path.join(tmpdir(), `nur-${label}-home-${width}.png`);
    await page.screenshot({ path: screenshot });
    await chmod(screenshot, 0o600);
    if (width <= 430) await verifyMawaqitMobile(page, width, label);
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto(base + 'index.html');
    await page.locator('.main-nav a[href$="sermons.html"]').click();
    const sermonLink = page
      .locator('a[href$="sermons/learn-our-religion/r1.html"]')
      .first();
    await sermonLink.click();
    await page.waitForURL(base + 'sermons/learn-our-religion/r1.html');
    assert.equal(
      await page.locator('.sermon-article .khutbah-part').count(),
      2,
    );
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    assert.ok(await page.locator('[data-reader-open]').isVisible());
    await page.locator('[data-reader-open]').click();
    assert.ok(await page.locator('dialog[open]').isVisible());
    const font = () =>
      page
        .locator('#reader-title')
        .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    const before = await font();
    await page.locator('[data-font-step="2"]').click();
    assert.ok((await font()) > before);
    await page.locator('[data-font-step="-2"]').click();
    assert.equal(await font(), before);
    await page.locator('select[data-reader-theme]').selectOption('dark');
    assert.equal(
      await page.locator('dialog').getAttribute('data-reader-theme'),
      'dark',
    );
    await page.locator('select[data-reader-theme]').selectOption('light');
    await page.evaluate(() => {
      window.__nurPrintCalls = 0;
      window.print = () => window.__nurPrintCalls++;
    });
    await page.locator('dialog [data-sermon-print]').click();
    assert.equal(await page.evaluate(() => window.__nurPrintCalls), 1);
    await page.locator('[data-reader-close]').click();
    const download = page.locator('a[download]');
    const response = await page.request.get(
      new URL(await download.getAttribute('href'), base).href,
    );
    assert.equal(response.status(), 200);
    assert.ok(
      (await response.text()).includes(
        'https://nour-und-huda.web.app/nur-und-huda/studies/',
      ),
    );
    await page.locator('.sermon-article .study-link a').click();
    await page.waitForURL(base + 'studies/learn-our-religion-study/r2.html');
    assert.equal(
      await page.locator('.sermon-article h1').textContent(),
      approvedCatalog.studies[0].title,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.evaluate(() => document.fonts.ready);
    await page
      .locator('.sermon-article a[href$="sermons/learn-our-religion/r1.html"]')
      .click();
    await page.waitForURL(base + 'sermons/learn-our-religion/r1.html');
  }
  await page.goto(base + 'index.html');
  await page.locator('a[href$="r1.html#imam"]').click();
  await page.locator('dialog[open]').waitFor({ state: 'visible' });
  assert.ok(await page.locator('dialog[open]').isVisible());
  await page.locator('[data-reader-close]').click();
  assert.deepEqual(errors, []);
  page.off('pageerror', onError);
  console.log(
    'PASS branding + approved sermon/study navigation, reader font/theme/print, download, RTL and responsive layout: ' +
      JSON.stringify(dimensions),
  );
}
