import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function verifySermonEditorBrowser(
  browser,
  origin,
  authenticate,
  engine,
) {
  assert.ok(
    ['https://nour-und-huda.web.app', 'https://localhost:4443'].includes(
      origin,
    ),
  );
  const base = origin + '/nur-und-huda/';
  const options = {
    ignoreHTTPSErrors: origin.includes('localhost'),
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      engine === 'webkit'
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  };
  const a = await browser.newContext(options),
    b = await browser.newContext(options);
  try {
    await authenticate(a);
    await authenticate(b);
    const p = await a.newPage(),
      q = await b.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    q.on('pageerror', (e) => errors.push(e.message));
    // Verify visible entry point on real sermons without making any mutation.
    for (const id of ['learn-our-religion', 'meaning-of-testimony']) {
      await p.goto(base + `sermons/${id}/r1.html`);
      assert.ok(
        await p.getByRole('link', { name: 'تعديل', exact: true }).isVisible(),
      );
      assert.equal(
        await p.locator('[data-sermon-edit]').getAttribute('href'),
        `/nur-und-huda/sermon-editor.html?id=${id}`,
      );
    }
    const editor = base + 'sermon-editor.html?id=editor-check';
    const api = base + 'api/sermons/editor-check';
    const start = await (await a.request.get(api)).json();
    assert.equal(start.testOnly, true);
    await p.goto(editor);
    await q.goto(editor);
    await p.locator('[data-editor-form]').waitFor({ state: 'visible' });
    await q.locator('[data-editor-form]').waitFor({ state: 'visible' });
    const unique = 'اختبار المحرر ' + randomUUID();
    const first =
      'نَصٌّ تَجْرِيبِيٌّ فقط\n\nArabic & Latin e\u0301 <b>ليس HTML</b>\n';
    await p.locator('#edit-title').fill(unique);
    await p.locator('#edit-first').fill(first);
    await p.locator('#edit-study').fill('دراسة الاختبار ' + unique);
    await p.getByRole('button', { name: 'حفظ المسودة', exact: true }).click();
    await p
      .locator('[data-editor-status]')
      .filter({ hasText: 'حُفظت المسودة' })
      .waitFor();
    assert.deepEqual(
      (await (await b.request.get(api)).json()).published,
      start.published,
    );
    await p.reload();
    await p.locator('[data-editor-form]').waitFor({ state: 'visible' });
    assert.equal(await p.locator('#edit-first').inputValue(), first);
    // A stale second session cannot clobber a saved draft.
    await q.locator('#edit-first').fill('تعديل متزامن لن يستبدل المسودة');
    await q.getByRole('button', { name: 'حفظ المسودة', exact: true }).click();
    await q.locator('[data-editor-conflict]').waitFor({ state: 'visible' });
    assert.equal(
      await q.locator('#edit-first').inputValue(),
      'تعديل متزامن لن يستبدل المسودة',
    );
    await p.getByRole('button', { name: 'معاينة', exact: true }).click();
    await p
      .locator('[data-editor-preview-panel]')
      .waitFor({ state: 'visible' });
    assert.ok(
      (await p.locator('[data-editor-preview-article]').textContent()).includes(
        first,
      ),
    );
    assert.equal(await p.locator('[data-editor-preview-article] b').count(), 0);
    await p.locator('[data-reader-open]').click();
    await p.locator('#sermon-reader-dialog[open]').waitFor();
    const size = () =>
      p
        .locator('#reader-title')
        .evaluate((n) => parseFloat(getComputedStyle(n).fontSize));
    const before = await size();
    await p.locator('[data-font-step="2"]').click();
    assert.ok((await size()) > before);
    await p.locator('select[data-reader-theme]').selectOption('dark');
    assert.equal(
      await p
        .locator('#sermon-reader-dialog')
        .getAttribute('data-reader-theme'),
      'dark',
    );
    await p.locator('[data-reader-close]').click();
    await p.locator('[data-editor-preview-close]').click();
    await p.getByRole('button', { name: 'نشر التعديلات', exact: true }).click();
    await p.locator('[data-editor-confirm][open]').waitFor();
    await p.locator('[data-editor-confirm-cancel]').click();
    assert.deepEqual(
      (await (await b.request.get(api)).json()).published,
      start.published,
    );
    await p.getByRole('button', { name: 'نشر التعديلات', exact: true }).click();
    await p.locator('[data-editor-confirm-ok]').click();
    await p
      .locator('[data-editor-status]')
      .filter({ hasText: 'نُشرت التعديلات' })
      .waitFor();
    await q.goto(base + 'editor-check.html');
    assert.equal(await q.locator('.sermon-article h1').textContent(), unique);
    assert.ok(
      (
        await q.locator('.sermon-article .khutbah-part').first().textContent()
      ).includes(first),
    );
    await q.locator('[data-reader-open]').click();
    await q.locator('#sermon-reader-dialog[open]').waitFor();
    assert.ok((await q.locator('.reader-text').textContent()).includes(first));
    await q.evaluate(() => {
      window.__editorPrint = 0;
      window.print = () => window.__editorPrint++;
    });
    await q.locator('.reader-options summary').click();
    await q.locator('dialog [data-sermon-print]').click();
    assert.equal(await q.evaluate(() => window.__editorPrint), 1);
    await q.locator('[data-reader-close]').click();
    const download = await b.request.get(base + 'editor-check-download.html');
    assert.equal(download.status(), 200);
    assert.ok((await download.text()).includes(unique));
    await q.goto(base + 'editor-check-study.html');
    assert.ok(await q.locator('.sermon-article').isVisible());
    assert.ok(
      (await q.locator('.sermon-article').textContent()).includes(
        'دراسة الاختبار ' + unique,
      ),
    );
    await q.locator('.sermon-article a').click();
    await q.waitForURL(base + 'editor-check.html');
    await p
      .getByRole('button', { name: 'استعادة النسخة السابقة', exact: true })
      .click();
    await p.locator('[data-editor-confirm-ok]').click();
    await p
      .locator('[data-editor-status]')
      .filter({ hasText: 'استُعيدت النسخة السابقة' })
      .waitFor();
    await q.goto(base + 'editor-check.html');
    assert.equal(
      await q.locator('.sermon-article h1').textContent(),
      start.published.content.title,
    );
    const restored = await (await b.request.get(api)).json();
    assert.deepEqual(restored.published.content, start.published.content);
    assert.equal(restored.published.number, start.published.number + 2);
    for (const width of [320, 390, 430, 768, 1440]) {
      await p.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await p.evaluate(() => document.fonts.ready);
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.ok(
        await p
          .getByRole('button', { name: 'حفظ المسودة', exact: true })
          .isVisible(),
      );
      await p.evaluate(() => scrollTo(0, 0));
      await p.waitForTimeout(100);
      const file = path.join(tmpdir(), `nur-editor-${engine}-${width}.png`);
      await p.screenshot({ path: file, fullPage: true });
      await chmod(file, 0o600);
    }
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${engine} editor: two independent sessions, reopen draft, escaped exact Unicode preview, imam font/theme, explicit confirmation, publication visible to second session, download, study, restore, conflict preservation, 320–1440px layout.`,
    );
  } finally {
    for (const c of [a, b]) {
      await c.request.post(origin + '/access/logout', {
        headers: { Origin: origin },
        maxRedirects: 0,
      });
      await c.close();
    }
  }
}
