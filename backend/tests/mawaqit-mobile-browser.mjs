import assert from 'node:assert/strict';
import { chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Browser-only layout inspection of the actual provider. No timetable is copied,
 * imported, changed or saved; results contain dimensions and booleans only. */
export async function verifyMawaqitMobile(page, width, label) {
  const card = page.locator('[data-mawaqit-card]');
  const iframe = card.locator('iframe');
  const source = await iframe.getAttribute('src');
  await iframe.scrollIntoViewIfNeeded();
  const frame = await (await iframe.elementHandle()).contentFrame();
  await frame.waitForURL('https://mawaqit.net/**');
  const names = ['الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء'];
  await frame.getByText(names[0], { exact: true }).waitFor();
  await frame.evaluate(() => document.fonts.ready);
  const geometry = () =>
    frame.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }));
  const cell = (name) =>
    frame.getByText(name, { exact: true }).evaluate((node) => {
      const time = node.parentElement.querySelector('.time');
      const box = node.parentElement.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        nameFont: parseFloat(getComputedStyle(node).fontSize),
        timeFont: parseFloat(getComputedStyle(time).fontSize),
        hasTime: /^\d{2}:\d{2}$/.test(time.textContent.trim()),
      };
    });
  const screenshot = async (mode) => {
    const file = path.join(
      tmpdir(),
      `nur-${label}-widget-${width}-${mode}.png`,
    );
    await card.screenshot({ path: file });
    await chmod(file, 0o600);
  };
  const overview = await geometry();
  assert.equal(overview.scrollWidth, overview.width);
  assert.equal(overview.scrollHeight, overview.height);
  for (const name of names) {
    const box = await cell(name);
    assert.ok(
      box.hasTime &&
        box.left >= 0 &&
        box.right <= overview.width + 1 &&
        box.top >= 0 &&
        box.bottom <= overview.height + 1,
      'All five provider cells must fit the overview',
    );
  }
  await screenshot('full');
  const zoom = card.locator('[data-mawaqit-zoom]');
  assert.ok(await zoom.isVisible());
  await zoom.click();
  assert.equal(await zoom.getAttribute('aria-pressed'), 'true');
  assert.ok(await card.locator('[data-mawaqit-pan]').isVisible());
  assert.ok(await card.locator('.mawaqit-scroll-hint').isVisible());
  await screenshot('right');
  const seen = new Set();
  const left = card.locator('[data-mawaqit-left]');
  for (let step = 0; step < 10; step++) {
    const frameBox = await iframe.boundingBox();
    const panelBox = await card.locator('.mawaqit-scroll').boundingBox();
    for (const name of names) {
      const box = await cell(name);
      assert.ok(box.nameFont >= 16 && box.timeFont >= 25 && box.hasTime);
      if (
        frameBox.x + box.left >= panelBox.x &&
        frameBox.x + box.right <= panelBox.x + panelBox.width
      )
        seen.add(name);
    }
    if (await left.isDisabled()) break;
    await left.click();
  }
  assert.equal(
    seen.size,
    5,
    'Every prayer must be fully accessible in the enlarged view',
  );
  assert.ok(await left.isDisabled());
  await screenshot('left');
  const right = card.locator('[data-mawaqit-right]');
  for (let step = 0; step < 10 && !(await right.isDisabled()); step++)
    await right.click();
  assert.ok(await right.isDisabled());
  await zoom.click();
  assert.equal(await zoom.getAttribute('aria-pressed'), 'false');
  assert.equal(await card.locator('[data-mawaqit-pan]').isVisible(), false);
  assert.equal(await iframe.getAttribute('src'), source);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(
    await card
      .locator('.friday-info time')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('datetime'))),
    ['13:00', '13:30'],
  );
  console.log(
    `PASS official widget ${width}px: five cells fit ${overview.width}×${overview.height}; enlarged pan reaches all five; no page overflow; Friday times retained.`,
  );
}
