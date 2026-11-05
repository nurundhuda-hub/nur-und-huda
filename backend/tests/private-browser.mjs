import { navigateSite } from './site-navigation.mjs';
// Actual Hosting rewrite -> compiled Function -> demo Firestore, behind local TLS.
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { request } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { groupCode } from './group-fixture.mjs';
assert.equal(process.env.GCLOUD_PROJECT, 'demo-nur-prayer');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8086');
const tls = mkdtempSync(path.join(tmpdir(), 'nur-private-tls-'));
execFileSync(
  'openssl',
  [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    path.join(tls, 'key.pem'),
    '-out',
    path.join(tls, 'cert.pem'),
    '-days',
    '1',
    '-subj',
    '/CN=localhost',
    '-addext',
    'subjectAltName=DNS:localhost',
  ],
  { stdio: 'ignore' },
);
const server = createServer(
  {
    key: readFileSync(path.join(tls, 'key.pem')),
    cert: readFileSync(path.join(tls, 'cert.pem')),
  },
  (req, res) => {
    const upstream = request(
      {
        host: '127.0.0.1',
        port: 5002,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (reply) => {
        res.writeHead(reply.statusCode, reply.headers);
        reply.pipe(res);
      },
    );
    upstream.on('error', () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  },
);
const origin = 'https://localhost:4443';
const {
  request: api,
  chromium,
  webkit,
} = await import(process.env.PRAYER_PLAYWRIGHT_MODULE ?? 'playwright');
const engine = process.env.PRAYER_BROWSER_ENGINE ?? 'chromium';
let browser;
try {
  server.listen(4443, '127.0.0.1');
  await once(server, 'listening');
  const anon = await api.newContext({ ignoreHTTPSErrors: true });
  const manifest = JSON.parse(
    readFileSync('backend/functions/private-site/manifest.json', 'utf8'),
  );
  for (const file of Object.keys(manifest.files)) {
    const reply = await anon.get(origin + '/nur-und-huda/' + file, {
      maxRedirects: 0,
    });
    assert.equal(reply.status(), 303, `Unauthenticated static file: ${file}`);
    assert.match(reply.headers()['cache-control'], /no-store/);
  }
  for (const url of [
    origin + '/nur-und-huda/api/gatherings',
    'http://127.0.0.1:5001/demo-nur-prayer/europe-west3/privateSite/nur-und-huda/api/gatherings',
  ]) {
    const reply = await anon.get(url, { maxRedirects: 0 });
    assert.equal(reply.status(), 401);
  }
  const denied = await anon.post(origin + '/access', {
    form: { code: groupCode },
    headers: { Origin: 'https://untrusted.invalid' },
    maxRedirects: 0,
  });
  assert.equal(denied.status(), 403);
  const wrong = await anon.post(origin + '/access', {
    form: { code: 'WRONG' },
    headers: { Origin: origin },
    maxRedirects: 0,
  });
  assert.equal(wrong.status(), 401);
  assert.ok(!(await wrong.text()).includes('WRONG'));
  const login = await anon.post(origin + '/access', {
    form: { code: groupCode, next: '//untrusted.invalid' },
    headers: { Origin: origin },
    maxRedirects: 0,
  });
  assert.equal(login.status(), 303);
  assert.equal(login.headers().location, '/nur-und-huda/index.html');
  const cookie = login.headers()['set-cookie'];
  const crossOrigin = await anon.post(origin + '/nur-und-huda/api/gatherings', {
    data: {},
    headers: { Origin: 'https://untrusted.invalid' },
    maxRedirects: 0,
  });
  assert.equal(crossOrigin.status(), 403);
  assert.equal(crossOrigin.headers()['access-control-allow-origin'], undefined);
  for (const attack of [
    '/.env',
    '/nur-und-huda/.sermon-review/first-sermon-approved.txt',
    '/nur-und-huda/_review/first-sermon',
    '/nur-und-huda/manifest.json',
    '/nur-und-huda/lib/index.js',
  ]) {
    assert.equal(
      (await anon.get(origin + attack, { maxRedirects: 0 })).status(),
      404,
    );
  }
  for (const flag of ['Secure', 'HttpOnly', 'SameSite=Lax', 'Max-Age=31536000'])
    assert.ok(cookie.includes(flag));
  for (const [file, hash] of Object.entries(manifest.files)) {
    const reply = await anon.get(origin + '/nur-und-huda/' + file);
    assert.equal(reply.status(), 200, file);
    assert.equal(
      createHash('sha256')
        .update(await reply.body())
        .digest('hex'),
      hash,
      file,
    );
    assert.match(reply.headers()['cache-control'], /no-store/);
  }
  const beforeLogout = await anon.storageState();
  const session = beforeLogout.cookies.find((c) => c.name === '__session');
  assert.ok(
    session?.secure &&
      session.httpOnly &&
      session.expires > Date.now() / 1000 + 364 * 86400,
  );
  browser = await (engine === 'webkit' ? webkit : chromium).launch({
    ...(engine === 'webkit'
      ? {}
      : {
          executablePath:
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        }),
    headless: true,
  });
  // A new browser context with persisted cookie proves no second code prompt.
  const remembered = await browser.newContext({
    storageState: beforeLogout,
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await remembered.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(origin + '/nur-und-huda/together.html');
  assert.equal(await page.locator('#code').count(), 0);
  assert.equal(
    await page.locator('body').getAttribute('data-group-site'),
    'true',
  );
  assert.ok(
    !(await page.evaluate(() => document.cookie)).includes('__session'),
  );
  // Follow the normal site navigation, not only direct HTTP resource checks.
  for (const file of ['sermons', 'quran', 'library', 'together']) {
    await navigateSite(page, file);
    await page.waitForURL(origin + `/nur-und-huda/${file}.html`);
    assert.equal(await page.locator('#code').count(), 0);
    assert.equal(await page.locator('main').isVisible(), true);
  }
  await page
    .locator('.footer-nav a[href="/nur-und-huda/legal.html#privacy"]')
    .click();
  await page.waitForURL(origin + '/nur-und-huda/legal.html#privacy');
  assert.equal(await page.locator('#privacy').isVisible(), true);
  assert.deepEqual(pageErrors, []);
  if (manifest.privateReleaseSha256) {
    const { verifyBrandingAndSermon } =
      await import('./branding-sermon-browser.mjs');
    await verifyBrandingAndSermon(
      page,
      origin + '/nur-und-huda/',
      `local-${engine}`,
    );
  }
  await page.getByRole('button', { name: 'خروج من الموقع الخاص' }).click();
  await page.waitForURL(origin + '/access');
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: path.join(tmpdir(), `nur-private-${engine}-login-390.png`),
    fullPage: true,
  });
  // A copied old cookie fails too: logout revokes server-side, not just in this browser.
  assert.equal(
    (await anon.get(origin + '/nur-und-huda/api/gatherings')).status(),
    401,
  );
  for (const attack of [
    '/.env',
    '/nur-und-huda/.sermon-review/first-sermon-approved.txt',
    '/nur-und-huda/_review/first-sermon',
    '/nur-und-huda/manifest.json',
    '/nur-und-huda/lib/index.js',
  ]) {
    const response = await anon.get(origin + attack, { maxRedirects: 0 });
    assert.notEqual(response.status(), 200);
  }
  await browser.close();
  browser = undefined;
  await anon.dispose();
  console.log(
    'PASS private Hosting HTTP boundary: all packaged pages/assets denied anonymously, exact authorized bytes, same-origin login, Secure persistent HttpOnly cookie, no JS cookie access, server-side logout revocation and direct Function protection.',
  );
  process.env.PRAYER_PRIVATE_URL = origin;
  await import('./browser.mjs');
} finally {
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  rmSync(tls, { recursive: true, force: true });
}
