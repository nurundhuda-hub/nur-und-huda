import assert from 'node:assert/strict';
import { chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Actual rendered geometry and real requestAnimationFrame, never synthetic prayer data.
// Caller supplies an authorized page. This helper never publishes or saves content.
export async function verifyImamScroll(page, url, label) {
  const errors = [];
  const error = (e) => errors.push(e.message);
  page.on('pageerror', error);
  await page.goto(url);
  const original = await page
    .locator('.sermon-article .khutbah-part')
    .allTextContents();
  assert.equal(original.length, 2);
  await page.locator('[data-reader-open]').click();
  const dialog = page.locator('#sermon-reader-dialog');
  const viewport = page.locator('[data-reader-viewport]');
  const toggle = page.locator('[data-auto-toggle]');
  const top = () => viewport.evaluate((el) => el.scrollTop);
  const level = async (n) => {
    await page.locator('[data-auto-speed]').evaluate((el, value) => {
      el.value = String(value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, n);
    assert.ok(
      (await page.locator('[data-auto-speed-label]').textContent()).includes(
        `${n} / 5`,
      ),
    );
  };
  await page.locator('.reader-options summary').click();
  await page.locator('[data-font-reset]').click();
  await page.locator('.reader-options summary').click();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  assert.deepEqual(
    await dialog.locator('.khutbah-part').allTextContents(),
    original,
  );
  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(await dialog.locator('.khutbah-part').nth(1).isVisible(), false);
  const readings = [];
  for (const [i, speed] of [6, 10, 16, 24, 32].entries()) {
    await level(i + 1);
    const start = await top();
    const before = Date.now();
    await toggle.click();
    await page.waitForTimeout(850);
    await toggle.click();
    const elapsed = (Date.now() - before) / 1000,
      moved = (await top()) - start;
    assert.ok(moved > 0, `level ${i + 1} moved`);
    // Geometry rounding and browser/driver scheduling tolerance, not reading duration.
    assert.ok(
      Math.abs(moved - speed * elapsed) < Math.max(3, speed * 0.4),
      `level ${i + 1}: ${moved}px / ${elapsed}s`,
    );
    readings.push({ level: i + 1, moved: Math.round(moved * 10) / 10 });
  }
  const paused = await top();
  await page.waitForTimeout(150);
  assert.equal(await top(), paused);
  await toggle.click();
  await page.waitForTimeout(250);
  await viewport.tap({ position: { x: 30, y: 40 } });
  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  const manual = await top();
  await page.waitForTimeout(200);
  assert.equal(await top(), manual);
  // A scroll not initiated by our animation also pauses, including keyboard/scrollbar paths.
  await toggle.click();
  await page.waitForTimeout(150);
  await viewport.evaluate((el) => {
    el.scrollTop += 60;
  });
  await page.waitForTimeout(80);
  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  await toggle.click();
  await page.waitForTimeout(100);
  const font = () =>
    page
      .locator('#reader-title')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const beforeFont = await font();
  await page.locator('[data-font-step="2"]').click();
  assert.ok((await font()) > beforeFont);
  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  await page.locator('[data-font-step="-2"]').click();
  assert.equal(await font(), beforeFont);
  // Seek close to the real part boundary so the test does not take a full sermon.
  async function seekEnd(part) {
    await viewport.evaluate((el, index) => {
      const section = el.querySelectorAll('.khutbah-part')[index];
      const end =
        section.getBoundingClientRect().bottom -
        el.getBoundingClientRect().top +
        el.scrollTop -
        el.clientHeight +
        parseFloat(getComputedStyle(el).paddingBottom);
      el.scrollTop = Math.max(0, end - 2);
    }, part);
    await page.waitForTimeout(120);
    await toggle.click();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-auto-toggle]')
          .getAttribute('aria-pressed') === 'false',
    );
    const bounds = await viewport.evaluate(
      (el, index) => ({
        end: el.querySelectorAll('.khutbah-part')[index].getBoundingClientRect()
          .bottom,
        bottom: el.getBoundingClientRect().bottom,
        top: el.scrollTop,
        max: el.scrollHeight - el.clientHeight,
      }),
      part,
    );
    assert.ok(bounds.end <= bounds.bottom + 2);
    assert.ok(bounds.top <= bounds.max);
  }
  await seekEnd(0);
  assert.equal(await dialog.getAttribute('data-auto-part'), '0');
  assert.equal(await dialog.locator('.khutbah-part').nth(1).isVisible(), false);
  assert.ok(
    (await page.locator('[data-auto-status]').textContent()).includes(
      'انتهت الخطبة الأولى',
    ),
  );
  await page.locator('button[data-auto-part]').click();
  await page.waitForTimeout(120);
  assert.equal(await dialog.getAttribute('data-auto-part'), '1');
  assert.ok(await dialog.locator('.khutbah-part').nth(1).isVisible());
  assert.equal(await dialog.locator('.khutbah-part').nth(0).isVisible(), false);
  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(await top(), 0);
  await toggle.click();
  await page.waitForTimeout(300);
  await toggle.click();
  assert.ok((await top()) > 0);
  await seekEnd(1);
  assert.ok(
    (await page.locator('[data-auto-status]').textContent()).includes(
      'انتهت الخطبة الثانية',
    ),
  );
  await page.locator('[data-auto-reset]').click();
  assert.equal(await top(), 0);
  assert.equal(await dialog.getAttribute('data-auto-part'), '1');
  await viewport.evaluate((el) => {
    el.scrollTop = 100;
  });
  const position = await top();
  await page.locator('[data-reader-close]').click();
  await page.locator('[data-reader-open]').click();
  await page.waitForTimeout(100);
  assert.equal(await top(), position);
  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(await dialog.getAttribute('data-auto-part'), '1');
  await page.locator('button[data-auto-part]').click();
  for (const width of [320, 375, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.waitForTimeout(100);
    const dimensions = await dialog.evaluate((el) => ({
      width: el.scrollWidth,
      viewport: innerWidth,
      textHeight: el.querySelector('[data-reader-viewport]').clientHeight,
      bar: el.querySelector('.reader-toolbar').getBoundingClientRect().height,
    }));
    assert.ok(dimensions.width <= dimensions.viewport);
    assert.ok(dimensions.textHeight >= 250);
    for (const selector of [
      '[data-auto-toggle]',
      '[data-auto-reset]',
      'button[data-auto-part]',
      '[data-reader-close]',
      '[data-font-step="2"]',
    ]) {
      const box = await page.locator(selector).boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44);
    }
    await toggle.click();
    await page.waitForTimeout(100);
    await toggle.click();
    assert.equal(
      await page
        .locator('.reader-toolbar')
        .evaluate((el) => el.getBoundingClientRect().height),
      dimensions.bar,
      'Start/pause must not resize the toolbar',
    );
    const shot = path.join(tmpdir(), `nur-imam-${label}-${width}.png`);
    await page.screenshot({ path: shot });
    await chmod(shot, 0o600);
  }
  await page.locator('[data-reader-close]').click();
  await page.reload();
  await page.locator('[data-reader-open]').click();
  assert.equal(await page.locator('[data-auto-speed]').inputValue(), '5');
  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(
    await dialog.locator('.khutbah-part').allTextContents(),
    original,
  );
  await page.locator('[data-reader-close]').click();
  assert.deepEqual(errors, []);
  page.off('pageerror', error);
  console.log(
    `PASS ${label}: five measured pixel speeds ${JSON.stringify(readings)}, manual pause, font changes, first/second boundaries, explicit transition, reopen, preferences, 320–1440px controls and unchanged text.`,
  );
}
