import { groupCode } from './group-fixture.mjs';
// Optional local browser QA; never points at a real Firebase project.
import assert from 'node:assert/strict';
assert.equal(process.env.GCLOUD_PROJECT, 'demo-nur-prayer');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8086');
const { chromium, webkit } = await import(
  process.env.PRAYER_PLAYWRIGHT_MODULE ?? 'playwright'
);
const engine = process.env.PRAYER_BROWSER_ENGINE ?? 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine));
await fetch(
  'http://127.0.0.1:8086/emulator/v1/projects/demo-nur-prayer/databases/(default)/documents',
  { method: 'DELETE' },
);
const browser = await (engine === 'webkit' ? webkit : chromium).launch({
  ...(engine === 'chromium'
    ? {
        executablePath:
          process.env.PRAYER_BROWSER_EXECUTABLE ??
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      }
    : {}),
  headless: true,
});
try {
  const privateOrigin = process.env.PRAYER_PRIVATE_URL;
  assert.ok(!privateOrigin || privateOrigin === 'https://localhost:4443');
  const a = await browser.newContext({
    ignoreHTTPSErrors: Boolean(privateOrigin),
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const b = await browser.newContext({
    ignoreHTTPSErrors: Boolean(privateOrigin),
    viewport: { width: 320, height: 740 },
    isMobile: true,
    hasTouch: true,
  });
  const pageA = await a.newPage(),
    pageB = await b.newPage();
  const errors = [];
  for (const p of [pageA, pageB])
    p.on('pageerror', (e) => errors.push(e.message));
  const url =
    (privateOrigin ?? 'http://127.0.0.1:4344') + '/nur-und-huda/together.html';
  async function enter(page) {
    await page.goto(url);
    if (privateOrigin && (await page.locator('#code').count())) {
      await page.locator('#code').fill(groupCode);
      await page.getByRole('button', { name: 'دخول', exact: true }).click();
      await page.waitForURL(url);
    }
  }
  await enter(pageA);
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
  await pageA
    .locator('.community-options a')
    .filter({ hasText: '+ إنشاء جماعة جديدة' })
    .click();
  await pageA.locator('#community-name').fill('أحمد');
  await pageA.locator('[name=prayer]').selectOption('asr');
  await pageA.locator('[name=date]').fill(local.slice(0, 10));
  await pageA.locator('[name=time]').fill(local.slice(11));
  await pageA.locator('[name=note]').fill('بعد الاجتماع');
  await pageA.locator('[name=consent]').check();
  await pageA
    .getByRole('button', { name: 'إنشاء الجماعة', exact: true })
    .click();

  await pageA
    .getByRole('button', { name: 'إلغاء الجماعة', exact: true })
    .waitFor();
  await enter(pageB);
  const pageB2 = await b.newPage();
  await enter(pageB2);
  assert.equal(
    await pageA.locator('.participant-names').textContent(),
    'معكم: أحمد',
  );
  await pageB.getByRole('button', { name: 'سأنضم', exact: true }).click();
  await pageB.locator('#join-name').fill('Max');
  await pageB2.getByRole('button', { name: 'سأنضم', exact: true }).click();
  await pageB2.locator('#join-name').fill('Max');
  await Promise.all([
    pageB.locator('[data-consent-accept]').click(),
    pageB2.locator('[data-consent-accept]').click(),
  ]);
  await pageB2
    .getByRole('button', { name: 'إلغاء انضمامي', exact: true })
    .waitFor();
  assert.equal(
    await pageB2.locator('.participant-names').textContent(),
    'معكم: أحمد، Max',
  );
  assert.equal(
    await pageB2.evaluate(() =>
      localStorage.getItem('nur-prayer-ownership-v1'),
    ),
    await pageB.evaluate(() => localStorage.getItem('nur-prayer-ownership-v1')),
  );
  await pageB2.close();
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
  // The first browser updates automatically, without a manual refresh.
  await pageA.waitForFunction(
    () =>
      document
        .querySelector('.gathering-card p')
        ?.textContent.includes(new Intl.NumberFormat('ar').format(2)),
    undefined,
    { timeout: 35_000 },
  );
  assert.equal(
    await pageA.locator('.participant-names').textContent(),
    'معكم: أحمد، Max',
  );
  await pageB.reload();
  await pageB
    .getByRole('button', { name: 'إلغاء انضمامي', exact: true })
    .waitFor();
  assert.equal(
    await pageB.locator('[data-consent]').evaluate((d) => d.open),
    false,
  );
  assert.equal(
    await pageB.locator('[data-saved-name]').textContent(),
    'اسمك على هذا الجهاز: Max',
  );
  await pageB
    .getByRole('button', { name: 'إلغاء انضمامي', exact: true })
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
      .getByRole('button', { name: 'سأنضم', exact: true })
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
      .evaluateAll((items) =>
        items
          .filter(
            (el) =>
              el.getBoundingClientRect().height > 0 &&
              el.getBoundingClientRect().height < 44 &&
              el.type !== 'checkbox',
          )
          .map((el) => ({
            id: el.id,
            tag: el.tagName,
            type: el.type,
            height: el.getBoundingClientRect().height,
          })),
      );
    assert.deepEqual(small, [], JSON.stringify(small));
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    console.log(
      'Layout',
      engine,
      width,
      await page.evaluate(() => ({
        active: document.activeElement?.className,
        skipTransform: getComputedStyle(document.querySelector('.skip-link'))
          .transform,
        skipTop: document.querySelector('.skip-link').getBoundingClientRect()
          .top,
      })),
    );
    const options = await page.locator('.community-options').boundingBox();
    assert.ok(
      options && options.y + options.height < (width === 390 ? 844 : 740),
      'Both options are visible in the initial phone viewport',
    );
    await page.screenshot({
      path: `${process.env.TMPDIR ?? '/tmp'}/nur-${privateOrigin ? 'private' : 'community'}-${engine}-${width}.png`,
      fullPage: true,
    });
  }
  // Changing the locally remembered name affects the next join, not existing content.
  await pageB.getByRole('button', { name: 'تغيير اسمي', exact: true }).click();
  await pageB.locator('#join-name').fill('محمد');
  await pageB.getByRole('button', { name: 'حفظ الاسم', exact: true }).click();
  await pageB.getByRole('button', { name: 'سأنضم', exact: true }).click();
  await pageB
    .getByRole('button', { name: 'إلغاء انضمامي', exact: true })
    .waitFor();
  assert.equal(
    await pageB.locator('.participant-names').textContent(),
    'معكم: أحمد، محمد',
  );
  // Another gathering for the same prayer remains independently available.
  const secondLocal = new Date(Date.parse(local + 'Z') + 60_000)
    .toISOString()
    .slice(0, 16);
  await pageA.locator('[name=date]').fill(secondLocal.slice(0, 10));
  await pageA.locator('[name=time]').fill(secondLocal.slice(11));
  await pageA
    .getByRole('button', { name: 'إنشاء الجماعة', exact: true })
    .click();
  await pageA.waitForFunction(
    () => document.querySelectorAll('.gathering-card').length === 2,
  );
  pageA.on('dialog', (d) => d.accept());
  await pageA
    .getByRole('button', { name: 'إلغاء الجماعة', exact: true })
    .last()
    .click();
  await pageA.waitForFunction(
    () => document.querySelectorAll('.gathering-card').length === 1,
  );
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
    `PASS two isolated ${engine} sessions: named create/join/count/reload/leave/name-change/multiple-gatherings/offline/owner-cancel, RTL, 320/390px no overflow and >=44px buttons. Not physical devices or iPhone Safari.`,
  );
} finally {
  await browser.close();
}
