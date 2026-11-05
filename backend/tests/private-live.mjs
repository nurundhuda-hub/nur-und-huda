import { navigateSite } from './site-navigation.mjs';
// Explicitly authorized live acceptance; synthetic records only, no database reset.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
assert.equal(process.argv[2], '--authorized-live');
const origin = 'https://nour-und-huda.web.app';
const base = origin + '/nur-und-huda/';
const endpoint = base + 'api/gatherings';
const code = (
  await readFile(
    '.prayer-review/group-production-access/access-code.txt',
    'utf8',
  )
).trim();
const manifest = JSON.parse(
  await readFile('backend/functions/private-site/manifest.json', 'utf8'),
);
const { webkit, chromium, request } = await import(
  process.env.PRAYER_PLAYWRIGHT_MODULE ?? 'playwright'
);
const engine = process.env.PRAYER_BROWSER_ENGINE ?? 'webkit';
assert.ok(['webkit', 'chromium'].includes(engine));
const browser = await (engine === 'webkit' ? webkit : chromium).launch({
  headless: true,
  ...(engine === 'chromium'
    ? {
        executablePath:
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      }
    : {}),
});
const marker = 'تحقق تقني مؤقت ' + randomUUID().slice(0, 8);
const tokenKey = 'nur-prayer-ownership-v1';
const secrets = [code, code.replace(/-/g, '')];
const report = {
  target: origin,
  engine,
  startedAt: new Date().toISOString(),
  checks: [],
};
const pass = (message) => {
  report.checks.push(message);
  console.log('PASS ' + message);
};
let a, b, pageA, ownerToken;
const createdIds = new Set();
async function call(context, method, suffix = '', token, data) {
  return context.request.fetch(endpoint + suffix, {
    method,
    headers: {
      Origin: origin,
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(data ? { data } : {}),
    maxRedirects: 0,
  });
}
try {
  const anon = await request.newContext();
  for (const file of Object.keys(manifest.files)) {
    const r = await anon.get(base + file, { maxRedirects: 0 });
    assert.equal(r.status(), 303, 'Anonymous resource denied: ' + file);
    assert.match(r.headers()['cache-control'], /no-store/);
  }
  for (const url of [
    endpoint,
    'https://europe-west3-nour-und-huda.cloudfunctions.net/privateSite/nur-und-huda/api/gatherings',
  ])
    assert.equal((await anon.get(url, { maxRedirects: 0 })).status(), 401);
  pass(
    'All packaged pages/assets and direct Function API reject anonymous access',
  );
  a = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  b = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  pageA = await a.newPage();
  const pageB = await b.newPage();
  const errors = [];
  const widgetResponses = [];
  pageA.on('response', (response) => {
    if (
      response.url().startsWith('https://mawaqit.net/ar/w/') &&
      response.request().resourceType() === 'document'
    )
      widgetResponses.push(response.status());
  });
  for (const page of [pageA, pageB])
    page.on('pageerror', (e) => errors.push(e.message));
  async function login(page, url) {
    await page.goto(url);
    await page.locator('#code').fill(code);
    await page.getByRole('button', { name: 'دخول', exact: true }).click();
    await page.waitForURL(url);
    assert.equal(await page.locator('#code').count(), 0);
  }
  await login(pageA, base + 'index.html');
  if (manifest.privateReleaseSha256) {
    const { verifyBrandingAndSermon } =
      await import('./branding-sermon-browser.mjs');
    await verifyBrandingAndSermon(pageA, base, `live-${engine}`);
    await pageA.setViewportSize({ width: 390, height: 844 });
    await pageA.goto(base + 'index.html');
  }
  assert.equal(await pageA.locator('.hero-logo').isVisible(), true);
  const frame = pageA.locator('iframe');
  assert.match(await frame.getAttribute('src'), /^https:\/\/mawaqit\.net\//);
  await frame.scrollIntoViewIfNeeded();
  try {
    await pageA.waitForFunction(() => {
      const f = document.querySelector('iframe');
      return Boolean(f && f.contentWindow);
    });
    report.widget =
      'Official iframe present; external provider rendering is independently controlled';
  } catch {
    report.widget = 'Official iframe and fallback retained';
  }
  await pageA.screenshot({
    path: path.join(tmpdir(), `nur-live-${engine}-home-390.png`),
    fullPage: true,
  });
  report.widgetHttpStatuses = widgetResponses;
  for (const file of ['sermons', 'quran', 'library', 'together']) {
    await navigateSite(pageA, file);
    await pageA.waitForURL(base + file + '.html');
    assert.equal(await pageA.locator('main').isVisible(), true);
  }
  for (const [file, hash] of Object.entries(manifest.files)) {
    const response = await a.request.get(base + file);
    assert.equal(response.status(), 200, 'Authorized resource: ' + file);
    assert.equal(
      createHash('sha256')
        .update(await response.body())
        .digest('hex'),
      hash,
      'Deployed bytes: ' + file,
    );
  }
  pass(
    'Normal navigation, original logo, official MAWAQIT iframe, and all deployed bytes match the release',
  );
  const remembered = await a.storageState();
  const cookie = remembered.cookies.find((c) => c.name === '__session');
  assert.ok(
    cookie?.secure &&
      cookie.httpOnly &&
      cookie.sameSite === 'Lax' &&
      cookie.expires > Date.now() / 1000 + 364 * 86400,
  );
  secrets.push(cookie.value);
  const restored = await browser.newContext({ storageState: remembered });
  const restoredPage = await restored.newPage();
  await restoredPage.goto(base + 'together.html');
  assert.equal(await restoredPage.locator('#code').count(), 0);
  assert.ok(
    !(await restoredPage.evaluate(() => document.cookie)).includes('__session'),
  );
  await restored.close();
  pass('Persistent Secure HttpOnly session restored without re-entering code');
  const bad = await a.request.post(endpoint, {
    headers: { Origin: 'https://untrusted.invalid' },
    data: {},
  });
  assert.equal(bad.status(), 403);
  assert.equal(bad.headers()['access-control-allow-origin'], undefined);
  for (const url of [
    '.env',
    'nur-und-huda/_review/first-sermon',
    'nur-und-huda/.sermon-review/first-sermon-approved.txt',
    'nur-und-huda/manifest.json',
  ])
    assert.equal(
      (await a.request.get(origin + '/' + url, { maxRedirects: 0 })).status(),
      404,
    );
  pass(
    'Cross-origin mutations and private review/source paths denied even with a session',
  );
  await pageA.waitForFunction(
    () => !document.querySelector('fieldset').disabled,
  );
  await pageA
    .locator('.community-options a')
    .filter({ hasText: '+ إنشاء جماعة جديدة' })
    .click();
  const local = (minutes) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(Date.now() + minutes * 60000));
    const get = (k) => parts.find((p) => p.type === k).value;
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  };
  async function create(minutes, note) {
    const date = local(minutes);
    await pageA.locator('#community-name').fill('تجربة');
    await pageA.locator('[name=prayer]').selectOption('asr');
    await pageA.locator('[name=date]').fill(date.slice(0, 10));
    await pageA.locator('[name=time]').fill(date.slice(11));
    await pageA.locator('[name=note]').fill(note);
    if (await pageA.locator('[name=consent]').isVisible())
      await pageA.locator('[name=consent]').check();
    const response = pageA.waitForResponse(
      (r) => r.url() === endpoint && r.request().method() === 'POST',
    );
    await pageA
      .getByRole('button', { name: 'إنشاء الجماعة', exact: true })
      .click();
    const r = await response;
    assert.equal(r.status(), 200);
    const data = await r.json();
    createdIds.add(data.gathering.id);
    ownerToken = await pageA.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).token,
      tokenKey,
    );
    secrets.push(ownerToken);
    return data.gathering;
  }
  const first = await create(20, marker);
  assert.equal(first.participantCount, 1);
  assert.deepEqual(first.participantNames, ['تجربة']);
  const cardA = pageA
    .locator('.gathering-card')
    .filter({ hasText: marker })
    .first();
  await login(pageB, base + 'together.html');
  const cardB = pageB
    .locator('.gathering-card')
    .filter({ hasText: marker })
    .first();
  await cardB.getByRole('button', { name: 'سأنضم', exact: true }).click();
  await pageB.locator('#join-name').fill('Test');
  await pageB.locator('[data-consent-accept]').click();
  await cardB
    .getByRole('button', { name: 'إلغاء انضمامي', exact: true })
    .waitFor();
  await pageA.waitForFunction(
    (marker) =>
      [...document.querySelectorAll('.gathering-card')].some(
        (c) => c.textContent.includes(marker) && c.textContent.includes('Test'),
      ),
    marker,
    { timeout: 45000 },
  );
  for (const card of [cardA, cardB]) {
    assert.match(
      await card.locator('.participant-names').textContent(),
      /تجربة.*Test/,
    );
    assert.match(await card.textContent(), /2|٢/);
  }
  const memberToken = await pageB.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)).token,
    tokenKey,
  );
  secrets.push(memberToken);
  const snapshot = await (await call(b, 'GET', '', memberToken)).json();
  const joined = snapshot.gatherings.find((g) => g.id === first.id);
  assert.equal(joined.participantCount, 2);
  const duplicate = {
    joined: true,
    firstName: 'Test',
    consent: 'prayer-v2',
    expectedRevision: joined.participationRevision,
    operationId: randomUUID(),
  };
  for (let n = 0; n < 2; n++) {
    const r = await call(
      b,
      'PUT',
      '/' + first.id + '/participation',
      memberToken,
      duplicate,
    );
    assert.equal(r.status(), 200);
    assert.equal((await r.json()).gathering.participantCount, 2);
  }
  assert.equal(
    (await call(b, 'DELETE', '/' + first.id, memberToken)).status(),
    403,
  );
  await pageB.reload();
  await cardB
    .getByRole('button', { name: 'إلغاء انضمامي', exact: true })
    .click();
  await cardB.getByRole('button', { name: 'سأنضم', exact: true }).waitFor();
  assert.equal(
    (await (await call(a, 'GET', '', ownerToken)).json()).gatherings.find(
      (g) => g.id === first.id,
    ).participantCount,
    1,
  );
  const second = await create(25, marker + ' ثانية');
  assert.equal(second.prayer, first.prayer);
  assert.notEqual(second.startsAt, first.startsAt);
  assert.equal(
    (await (await call(a, 'GET', '', ownerToken)).json()).gatherings.filter(
      (g) => createdIds.has(g.id),
    ).length,
    2,
  );
  pass(
    'Live named create, second-session join, automatic updates, duplicate rejection, leave, owner protection and multiple gatherings',
  );
  for (const [page, width] of [
    [pageA, 390],
    [pageB, 375],
  ]) {
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({
      path: path.join(tmpdir(), `nur-live-${engine}-${width}.png`),
      fullPage: true,
    });
  }
  await b.setOffline(true);
  await pageB.waitForFunction(() =>
    document
      .querySelector('[data-community-status]')
      .textContent.includes('غير متصل'),
  );
  assert.equal(
    await cardB
      .getByRole('button', { name: 'سأنضم', exact: true })
      .isDisabled(),
    true,
  );
  await b.setOffline(false);
  pageA.on('dialog', (d) => d.accept());
  for (const id of [second.id, first.id]) {
    const target = pageA
      .locator('.gathering-card')
      .filter({ hasText: id === second.id ? marker + ' ثانية' : marker })
      .first();
    const reply = pageA.waitForResponse(
      (r) =>
        r.url() === endpoint + '/' + id && r.request().method() === 'DELETE',
    );
    await target
      .getByRole('button', { name: 'إلغاء الجماعة', exact: true })
      .click();
    assert.equal((await reply).status(), 200);
    createdIds.delete(id);
  }
  pass(
    'Organizer cancellation, offline handling and iPhone-sized WebKit/Chromium layout',
  );
  await pageA
    .locator('.footer-nav a[href="/nur-und-huda/legal.html#privacy"]')
    .click();
  await pageA.waitForURL(base + 'legal.html#privacy');
  assert.match(
    await pageA.locator('#impressum').textContent(),
    /Ahmad Ghalayini/,
  );
  await pageA.getByRole('button', { name: 'خروج من الموقع الخاص' }).click();
  await pageA.waitForURL(origin + '/access');
  const replay = await request.newContext({ storageState: remembered });
  assert.equal((await replay.get(endpoint)).status(), 401);
  await replay.dispose();
  await pageB.getByRole('button', { name: 'خروج من الموقع الخاص' }).click();
  await pageB.waitForURL(origin + '/access');
  assert.deepEqual(errors, []);
  pass(
    'Logout revokes the copied cookie; no page JavaScript errors; synthetic gatherings cancelled',
  );
  await anon.dispose();
  report.completedAt = new Date().toISOString();
  report.success = true;
  await writeFile(
    '.prayer-review/live-' + engine + '-result.json',
    JSON.stringify(report, null, 2),
    { mode: 0o600 },
  );
} catch (error) {
  let message = error.message;
  for (const secret of secrets)
    message = message.replaceAll(secret, '[REDACTED]');
  console.error(message);
  process.exitCode = 1;
} finally {
  if (a && ownerToken) {
    for (const id of createdIds) {
      try {
        await call(a, 'DELETE', '/' + id, ownerToken);
      } catch {
        /* Record was created only by this test; retained expiry is the fallback. */
      }
    }
  }
  await browser.close();
}
