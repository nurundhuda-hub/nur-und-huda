// Real Chromium + authenticated emulator API + real service worker.
// Browser subscriptions and provider delivery are explicitly synthetic here.
import assert from 'node:assert/strict';
import { createECDH, randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { groupCode } from './group-fixture.mjs';
export async function verifyPushIphoneInstructions(
  browser,
  storageState,
  origin,
) {
  assert.equal(origin, 'https://localhost:4443');
  const context = await browser.newContext({
    storageState,
    ignoreHTTPSErrors: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 Version/16.4 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(origin + '/nur-und-huda/together.html');
      await page.locator('[data-push-install]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('[data-push-enable]').isDisabled(), true);
      assert.ok(
        (await page.locator('[data-push-status]').innerText()).includes(
          'الشاشة الرئيسية',
        ),
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.locator('[data-push]').scrollIntoViewIfNeeded();
      const shot = path.join(tmpdir(), `nur-push-webkit-${width}.png`);
      await page.screenshot({ path: shot });
      await chmod(shot, 0o600);
    }
    console.log(
      'PASS WebKit iPhone-sized installation guidance and no permission prompt in ordinary Safari. Physical Home Screen push not verified.',
    );
  } finally {
    await context.close();
  }
}
export async function verifyPushLocal(browser, storageState, origin) {
  assert.equal(origin, 'https://localhost:4443');
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-nur-prayer');
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8086');
  const contexts = [];
  const requireBackend = createRequire(
    new URL('../functions/package.json', import.meta.url),
  );
  const { initializeApp, getApps } = requireBackend('firebase-admin/app');
  const { getFirestore } = requireBackend('firebase-admin/firestore');
  if (!getApps().length) initializeApp({ projectId: 'demo-nur-prayer' });
  const db = getFirestore();
  try {
    for (const width of [390, 320]) {
      const ctx = await browser.newContext({
        storageState,
        ignoreHTTPSErrors: true,
        viewport: { width, height: 844 },
      });
      contexts.push(ctx);
      assert.equal(
        (
          await ctx.request.post(origin + '/access', {
            form: { code: groupCode },
            headers: { Origin: origin },
            maxRedirects: 0,
          })
        ).status(),
        303,
      );
      await ctx.grantPermissions(['notifications'], { origin });
      const ec = createECDH('prime256v1');
      ec.generateKeys();
      const fixture = {
        endpoint:
          'https://fcm.googleapis.com/fcm/send/synthetic-' + randomUUID(),
        keys: {
          p256dh: ec.getPublicKey().toString('base64url'),
          auth: randomBytes(16).toString('base64url'),
        },
      };
      await ctx.addInitScript((fixture) => {
        const wrap = () => ({
          toJSON: () => fixture,
          unsubscribe: async () => {
            localStorage.removeItem('synthetic-subscription');
            return true;
          },
        });
        PushManager.prototype.getSubscription = async () =>
          localStorage.getItem('synthetic-subscription') ? wrap() : null;
        PushManager.prototype.subscribe = async () => {
          localStorage.setItem('synthetic-subscription', 'yes');
          return wrap();
        };
      }, fixture);
      const page = await ctx.newPage();
      await page.goto(origin + '/nur-und-huda/together.html');
      await page.waitForFunction(
        () => !document.querySelector('[data-push-enable]').disabled,
      );
      await page.locator('[data-push-enable]').click();
      await page.waitForFunction(
        () =>
          document.querySelector('[data-push-status]').textContent ===
          'إشعارات الجماعة مفعّلة على هذا الجهاز.',
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.locator('[data-push]').scrollIntoViewIfNeeded();
      const shot = path.join(tmpdir(), `nur-push-chromium-${width}.png`);
      await page.screenshot({ path: shot });
      await chmod(shot, 0o600);
    }
    const [a, b] = contexts,
      pageA = a.pages()[0];
    let pageB = b.pages()[0];
    const creator = await pageA.evaluate(() =>
      localStorage.getItem('nur-push-device-v1'),
    );
    const owner = randomBytes(32).toString('base64url');
    const headers = {
      Origin: origin,
      Authorization: 'Bearer ' + owner,
      'X-Push-Device': creator,
    };
    const command = {
      prayer: 'asr',
      startsAt: new Date(
        Math.ceil(Date.now() / 60000) * 60000 + 600000,
      ).toISOString(),
      consent: 'prayer-v2',
      firstName: 'Synthetic',
      operationId: randomUUID(),
    };
    const r = await a.request.post(origin + '/nur-und-huda/api/gatherings', {
      headers,
      data: command,
    });
    assert.equal(r.status(), 200);
    const gathering = (await r.json()).gathering;
    assert.equal(
      (
        await a.request.post(origin + '/nur-und-huda/api/gatherings', {
          headers,
          data: command,
        })
      ).status(),
      200,
    );
    const state = (await db.doc('privatePush/state').get()).data();
    assert.equal(Object.keys(state.devices).length, 2);
    assert.equal(
      Object.keys(state.deliveries).length,
      1,
      'one recipient; creator excluded and retry deduplicated',
    );
    // Close the website, retaining a blank automation target and the browser.
    // This tests a background worker, not a physically closed phone browser.
    await pageB.waitForFunction(() =>
      Boolean(navigator.serviceWorker.controller),
    );
    const control = await b.newPage();
    const cdp = await b.newCDPSession(control);
    const registrations = new Map();
    cdp.on('ServiceWorker.workerRegistrationUpdated', (event) => {
      for (const r of event.registrations)
        registrations.set(r.scopeURL, r.registrationId);
    });
    await cdp.send('ServiceWorker.enable');
    await new Promise((resolve) => setTimeout(resolve, 200));
    const registrationId = registrations.get(origin + '/nur-und-huda/');
    assert.ok(registrationId);
    await pageB.close();
    const payload = {
      gathering: gathering.id,
      expiresAt: Date.parse(gathering.expiresAt),
    };
    // Protocol delivery invokes the actual installed worker; no provider success claim.
    await cdp.send('ServiceWorker.deliverPushMessage', {
      origin,
      registrationId,
      data: JSON.stringify(payload),
    });
    const worker = b
      .serviceWorkers()
      .find((w) => w.url().endsWith('/group-push.js'));
    assert.ok(worker);
    const count = () =>
      worker.evaluate(
        async () => (await self.registration.getNotifications()).length,
      );
    for (let n = 0; n < 100 && (await count()) !== 1; n++)
      await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(
      await count(),
      1,
      'Actual service worker displays validated push',
    );
    await worker.evaluate(async () => {
      for (const n of await self.registration.getNotifications()) n.close();
    });
    await cdp.send('ServiceWorker.deliverPushMessage', {
      origin,
      registrationId,
      data: JSON.stringify(payload),
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(
      await count(),
      0,
      'Persistent dedup survives dismissed notification',
    );
    const second = await a.request.post(
      origin + '/nur-und-huda/api/gatherings',
      { headers, data: { ...command, operationId: randomUUID() } },
    );
    assert.equal(second.status(), 200);
    const cancelled = (await second.json()).gathering;
    await a.request.delete(
      origin + '/nur-und-huda/api/gatherings/' + cancelled.id,
      { headers },
    );
    await cdp.send('ServiceWorker.deliverPushMessage', {
      origin,
      registrationId,
      data: JSON.stringify({
        gathering: cancelled.id,
        expiresAt: Date.parse(cancelled.expiresAt),
      }),
    });
    const expiredId = randomBytes(32).toString('hex');
    await db.doc('prayerService/group').update({
      ['gatherings.' + expiredId]: {
        id: expiredId,
        prayer: 'asr',
        startsAt: Date.now() - 31 * 60_000,
        owner: 'synthetic',
        members: {},
        cancelled: false,
      },
    });
    await cdp.send('ServiceWorker.deliverPushMessage', {
      origin,
      registrationId,
      data: JSON.stringify({
        gathering: expiredId,
        expiresAt: Date.now() - 60000,
      }),
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(
      await count(),
      0,
      'Cancelled and expired payloads never display',
    );
    pageB = await b.newPage();
    await pageB.goto(
      origin +
        '/access?next=' +
        encodeURIComponent(
          '/nur-und-huda/together.html#gathering-' + gathering.id,
        ),
    );
    await pageB.waitForFunction(
      (id) => document.activeElement?.id === 'gathering-' + id,
      gathering.id,
    );
    await pageB.waitForFunction(
      () =>
        document.querySelector('[data-push-status]').textContent ===
        'إشعارات الجماعة مفعّلة على هذا الجهاز.',
    );
    assert.equal(await pageB.locator('#gathering-' + gathering.id).count(), 1);
    await pageB.locator('[data-push-disable]').click();
    await pageB.waitForFunction(() =>
      document
        .querySelector('[data-push-status]')
        .textContent.includes('غير مفعّلة'),
    );
    assert.equal(
      Object.keys((await db.doc('privatePush/state').get()).data().devices)
        .length,
      1,
    );
    await a.request.delete(
      origin + '/nur-und-huda/api/gatherings/' + gathering.id,
      { headers },
    );
    await pageA.locator('[data-push-disable]').click();
    await pageA.waitForFunction(() =>
      document
        .querySelector('[data-push-status]')
        .textContent.includes('غير مفعّلة'),
    );
    console.log(
      'PASS Chromium synthetic subscriptions: two sessions, creator exclusion, dedup, actual service-worker display, reopen persistence, private gathering deep link and unsubscribe. Provider/physical-device delivery NOT verified.',
    );
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
}
