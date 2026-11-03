// Optional local browser QA; never points at a real Firebase project.
const { chromium } = await import(
  process.env.PRAYER_PLAYWRIGHT_MODULE ?? 'playwright-core'
);
import assert from 'node:assert/strict';
await fetch(
  'http://127.0.0.1:8086/emulator/v1/projects/demo-nur-prayer/databases/(default)/documents',
  { method: 'DELETE' },
);
const browser = await chromium.launch({
  executablePath:
    process.env.PRAYER_BROWSER_EXECUTABLE ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
try {
  const a = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const b = await browser.newContext({
    viewport: { width: 320, height: 740 },
    isMobile: true,
    hasTouch: true,
  });
  const pageA = await a.newPage(),
    pageB = await b.newPage();
  const errors = [];
  for (const p of [pageA, pageB])
    p.on('pageerror', (e) => errors.push(e.message));
  const url = 'http://127.0.0.1:4343/nur-und-huda/together.html';
  await pageA.goto(url);
  await pageA
    .getByRole('button', { name: 'إنشاء الجماعة', exact: true })
    .waitFor();
  await pageA.waitForFunction(
    () => !document.querySelector('fieldset').disabled,
  );
  const local = await pageA.evaluate(() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(Date.now() + 15 * 60000));
    const get = (k) => parts.find((p) => p.type === k).value;
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  });
  await pageA.locator('[name=prayer]').selectOption('asr');
  await pageA.locator('[name=time]').fill(local);
  await pageA
    .getByRole('button', { name: 'إنشاء الجماعة', exact: true })
    .click();
  await pageA.getByRole('button', { name: 'أوافق وأتابع' }).click();
  await pageA
    .getByRole('button', { name: 'إلغاء الجماعة', exact: true })
    .waitFor();
  await pageB.goto(url);
  await pageB.getByRole('button', { name: 'انضمام', exact: true }).click();
  await pageB.getByRole('button', { name: 'أوافق وأتابع' }).click();
  await pageB.waitForFunction(() =>
    document
      .querySelector('.gathering-card p')
      ?.textContent.includes(new Intl.NumberFormat('ar').format(2)),
  );
  assert.equal(
    await pageB
      .getByRole('button', { name: 'إلغاء الجماعة', exact: true })
      .count(),
    0,
  );
  await pageA.getByRole('button', { name: 'تحديث', exact: true }).click();
  await pageA.waitForFunction(() =>
    document
      .querySelector('.gathering-card p')
      ?.textContent.includes(new Intl.NumberFormat('ar').format(2)),
  );
  await pageB.reload();
  await pageB
    .getByRole('button', { name: 'إلغاء مشاركتي', exact: true })
    .click();
  await pageB.waitForFunction(() =>
    document
      .querySelector('.gathering-card p')
      ?.textContent.includes(new Intl.NumberFormat('ar').format(1)),
  );
  await b.setOffline(true);
  await pageB.waitForFunction(() =>
    document
      .querySelector('[data-community-status]')
      .textContent.includes('غير متصل'),
  );
  assert.equal(
    await pageB
      .getByRole('button', { name: 'انضمام', exact: true })
      .isDisabled(),
    true,
  );
  await b.setOffline(false);
  await pageB.waitForFunction(
    () => !document.querySelector('[data-refresh]').disabled,
  );
  for (const [page, width] of [
    [pageA, 390],
    [pageB, 320],
  ]) {
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `no overflow at ${width}`,
    );
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    const small = await page
      .locator('.community button,.community input,.community select')
      .evaluateAll(
        (items) =>
          items.filter(
            (el) =>
              el.getBoundingClientRect().height > 0 &&
              el.getBoundingClientRect().height < 44,
          ).length,
      );
    assert.equal(small, 0);
    await page.screenshot({
      path: `${process.env.TMPDIR ?? '/tmp'}/nur-task30-mobile-${width}.png`,
      fullPage: true,
    });
  }
  pageA.on('dialog', (d) => d.accept());
  await pageA
    .getByRole('button', { name: 'إلغاء الجماعة', exact: true })
    .click();
  await pageA.waitForFunction(
    () => document.querySelectorAll('.gathering-card').length === 0,
  );
  await pageB.getByRole('button', { name: 'تحديث', exact: true }).click();
  await pageB.waitForFunction(
    () => document.querySelectorAll('.gathering-card').length === 0,
  );
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    'PASS two isolated Chromium sessions: create/join/count/reload/leave/offline/owner-cancel, RTL, 320/390px no overflow and >=44px controls. Not physical devices or Safari.',
  );
} finally {
  await browser.close();
}
