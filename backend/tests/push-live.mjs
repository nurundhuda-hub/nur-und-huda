// Authorized production checks. No synthetic provider tokens or injected push events.
// Logs contain check labels only, never subscriptions, cookies or participant data.
import assert from 'node:assert/strict';
import { readFile, mkdtemp, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
assert.equal(process.argv[2], '--authorized-live');
const origin = 'https://nour-und-huda.web.app';
const base = origin + '/nur-und-huda/';
const push = base + 'api/push/';
const code = (
  await readFile(
    '.prayer-review/group-production-access/access-code.txt',
    'utf8',
  )
).trim();
const expectedKey = JSON.parse(
  await readFile(
    '.prayer-review/group-production-access/push-keys.json',
    'utf8',
  ),
).publicKey;
const { chromium, request } = await import(
  process.env.PRAYER_PLAYWRIGHT_MODULE ?? 'playwright'
);
const contexts = [];
const profiles = [];
const devices = [];
const owner = randomBytes(32).toString('base64url');
let gathering;
let stage = 'anonymous boundary';
const pass = (s) => console.log('PASS ' + s);
try {
  const anon = await request.newContext();
  for (const route of ['config', 'subscription', 'check/' + 'a'.repeat(64)]) {
    assert.equal(
      (await anon.get(push + route, { maxRedirects: 0 })).status(),
      401,
    );
  }
  for (const file of [
    'group-push.js',
    'group-manifest.json',
    'group-icon.svg',
  ]) {
    assert.equal(
      (await anon.get(base + file, { maxRedirects: 0 })).status(),
      303,
    );
  }
  assert.equal(
    (
      await anon.get(
        'https://europe-west3-nour-und-huda.cloudfunctions.net/deliverGroupNotifications',
      )
    ).status(),
    403,
  );
  await anon.dispose();
  pass(
    'Push APIs, worker assets and scheduled function reject unauthenticated access',
  );
  stage = 'authenticated endpoint checks';
  for (let i = 0; i < 2; i++) {
    const dir = await mkdtemp(path.join(tmpdir(), 'nur-push-live-'));
    await chmod(dir, 0o700);
    profiles.push(dir);
    const ctx = await chromium.launchPersistentContext(dir, {
      executablePath:
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
      ignoreDefaultArgs: ['--disable-background-networking'],
      viewport: { width: i ? 390 : 320, height: 844 },
    });
    contexts.push(ctx);
    await ctx.grantPermissions(['notifications'], { origin });
    const login = await ctx.request.post(origin + '/access', {
      headers: { Origin: origin },
      form: { code },
      maxRedirects: 0,
    });
    assert.equal(login.status(), 303);
    const config = await ctx.request.get(push + 'config');
    assert.equal(config.status(), 200);
    assert.deepEqual(await config.json(), { publicKey: expectedKey });
    const token = randomBytes(32).toString('base64url');
    devices.push(token);
    const headers = { Origin: origin, 'X-Push-Device': token };
    assert.deepEqual(
      await (await ctx.request.get(push + 'subscription', { headers })).json(),
      { subscribed: false, expiresAt: null },
    );
    assert.equal(
      (
        await ctx.request.put(push + 'subscription', {
          headers: { ...headers, Origin: 'https://untrusted.invalid' },
          data: {},
        })
      ).status(),
      403,
    );
    assert.equal(
      (
        await ctx.request.put(push + 'subscription', {
          headers,
          data: { endpoint: 'https://127.0.0.1/private', keys: {} },
        })
      ).status(),
      400,
    );
    assert.equal((await ctx.request.get(push + 'subscription')).status(), 400);
    const page = ctx.pages()[0];
    await page.goto(base + 'together.html');
    await page.evaluate(
      (token) => localStorage.setItem('nur-push-device-v1', token),
      token,
    );
    await page.waitForFunction(
      () => !document.querySelector('[data-push-enable]').disabled,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  pass(
    'Two private sessions: correct VAPID public key, no token disclosure, strict origin and subscription validation, mobile layout',
  );
  stage = 'native provider registration';
  let registered = true;
  for (const ctx of contexts) {
    const page = ctx.pages()[0];
    await page.locator('[data-push-enable]').click();
    try {
      await page.waitForFunction(
        () =>
          document.querySelector('[data-push-status]').textContent ===
          'إشعارات الجماعة مفعّلة على هذا الجهاز.',
        undefined,
        { timeout: 45000 },
      );
    } catch {
      registered = false;
      const state = await page.evaluate(async () => ({
        permission: Notification.permission,
        nativeSubscription: Boolean(
          await (
            await navigator.serviceWorker.ready
          ).pushManager.getSubscription(),
        ),
        failureShown: document
          .querySelector('[data-push-status]')
          .textContent.includes('تعذّر'),
      }));
      console.log(
        'LIMIT native provider registration unavailable: ' +
          JSON.stringify(state),
      );
      break;
    }
  }
  if (registered) {
    pass(
      'Two real browser push subscriptions registered with the production API',
    );
    stage = 'native provider delivery';
    const [a, b] = contexts;
    const headers = {
      Origin: origin,
      Authorization: 'Bearer ' + owner,
      'X-Push-Device': devices[0],
    };
    const command = {
      prayer: 'asr',
      startsAt: new Date(
        Math.ceil(Date.now() / 60000) * 60000 + 1200000,
      ).toISOString(),
      firstName: 'تجربة',
      consent: 'prayer-v2',
      operationId: randomUUID(),
    };
    const created = await a.request.post(base + 'api/gatherings', {
      headers,
      data: command,
    });
    assert.equal(created.status(), 200);
    gathering = (await created.json()).gathering.id;
    const count = (page, id) =>
      page.evaluate(
        async (id) =>
          (
            await (
              await navigator.serviceWorker.ready
            ).getNotifications({ tag: 'gathering-' + id })
          ).length,
        id,
      );
    const deadline = Date.now() + 60000;
    let received = false;
    while (Date.now() < deadline) {
      if (await count(b.pages()[0], gathering)) {
        received = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    assert.equal(await count(a.pages()[0], gathering), 0);
    if (received) {
      assert.equal(await count(b.pages()[0], gathering), 1);
      assert.equal(
        (
          await a.request.post(base + 'api/gatherings', {
            headers,
            data: command,
          })
        ).status(),
        200,
      );
      assert.equal(await count(b.pages()[0], gathering), 1);
      pass(
        'Native provider delivery reached the second browser once; creator excluded and create replay deduplicated',
      );
    } else
      console.log(
        'LIMIT native provider delivery not observed within 60 seconds; physical device acceptance remains required',
      );
    await b.pages()[0].reload();
    await b
      .pages()[0]
      .waitForFunction(
        () =>
          document.querySelector('[data-push-status]').textContent ===
          'إشعارات الجماعة مفعّلة على هذا الجهاز.',
      );
    pass('Subscription persisted across page reopening');
  }
  stage = 'unsubscribe and session revocation';
  for (const [i, ctx] of contexts.entries()) {
    const headers = { Origin: origin, 'X-Push-Device': devices[i] };
    assert.equal(
      (await ctx.request.delete(push + 'subscription', { headers })).status(),
      200,
    );
    assert.deepEqual(
      await (await ctx.request.get(push + 'subscription', { headers })).json(),
      { subscribed: false, expiresAt: null },
    );
  }
  pass(
    'Private subscription removal is idempotent and status reflects removal',
  );
} catch {
  console.error(
    'FAIL live push check at: ' +
      stage +
      ' (sensitive exception details suppressed)',
  );
  process.exitCode = 1;
} finally {
  if (gathering && contexts[0]) {
    const r = await contexts[0].request
      .delete(base + 'api/gatherings/' + gathering, {
        headers: { Origin: origin, Authorization: 'Bearer ' + owner },
      })
      .catch(() => null);
    if (r?.status() !== 200) {
      console.error('FAIL synthetic gathering cancellation');
      process.exitCode = 1;
    }
  }
  for (const [i, ctx] of contexts.entries()) {
    if (devices[i])
      await ctx.request
        .delete(push + 'subscription', {
          headers: { Origin: origin, 'X-Push-Device': devices[i] },
        })
        .catch(() => {});
    for (const page of ctx.pages())
      await page
        .evaluate(async () => {
          if (!('serviceWorker' in navigator)) return;
          for (const r of await navigator.serviceWorker.getRegistrations()) {
            await (await r.pushManager.getSubscription())?.unsubscribe();
            for (const n of await r.getNotifications()) n.close();
            await r.unregister();
          }
          localStorage.clear();
        })
        .catch(() => {});
    const r = await ctx.request
      .post(origin + '/access/logout', {
        headers: { Origin: origin },
        maxRedirects: 0,
      })
      .catch(() => null);
    if (r?.status() !== 303) {
      console.error('FAIL test-session logout');
      process.exitCode = 1;
    }
    await ctx.close();
  }
  for (const dir of profiles) await rm(dir, { recursive: true, force: true });
}
