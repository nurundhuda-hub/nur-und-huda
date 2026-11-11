// UI capability simulations in real engines. Never evidence of physical push delivery.
import assert from 'node:assert/strict';
import { chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
export async function verifyPushUiScenarios(
  browser,
  storageState,
  origin,
  engine,
) {
  assert.equal(origin, 'https://localhost:4443');
  const iphone =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
  const android =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
  const cases = [
    { name: 'iphone-safari', ua: iphone, install: true },
    { name: 'iphone-installed', ua: iphone, standalone: true, activate: true },
    { name: 'android-chrome', ua: android, activate: true, android: true },
    { name: 'android-subscribed', ua: android, subscribed: true },
    {
      name: 'iphone-subscribed',
      ua: iphone,
      standalone: true,
      subscribed: true,
    },
    { name: 'android-denied', ua: android, denied: true },
    { name: 'iphone-denied', ua: iphone, standalone: true, denied: true },
    { name: 'unsupported', ua: android, unsupported: true },
  ];
  for (const scenario of cases) {
    const context = await browser.newContext({
      storageState,
      ignoreHTTPSErrors: true,
      userAgent: scenario.ua,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    let remote = Boolean(scenario.subscribed),
      writes = 0;
    try {
      await context.route(
        origin + '/nur-und-huda/api/push/**',
        async (route) => {
          const req = route.request();
          if (req.method() === 'PUT') {
            remote = true;
            writes++;
          }
          if (req.method() === 'DELETE') {
            remote = false;
            writes++;
          }
          await route.fulfill({
            json: req.url().endsWith('/config')
              ? { publicKey: 'BA'.repeat(43) + 'A' }
              : {
                  subscribed: remote,
                  expiresAt: remote ? Date.now() + 86400000 : null,
                },
          });
        },
      );
      await context.addInitScript((s) => {
        Object.defineProperty(navigator, 'standalone', {
          configurable: true,
          value: Boolean(s.standalone),
        });
        let subscribed = Boolean(s.subscribed);
        window.__pushPermissionRequests = 0;
        const notification = {
          permission: s.denied
            ? 'denied'
            : s.subscribed
              ? 'granted'
              : 'default',
          requestPermission: async () => {
            window.__pushPermissionRequests++;
            notification.permission = 'granted';
            return 'granted';
          },
        };
        Object.defineProperty(window, 'Notification', {
          configurable: true,
          value: notification,
        });
        if (s.unsupported) delete window.PushManager;
        else
          Object.defineProperty(window, 'PushManager', {
            configurable: true,
            value: class {},
          });
        const sub = {
          toJSON: () => ({
            endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic-ui-only',
          }),
          unsubscribe: async () => {
            subscribed = false;
            return true;
          },
        };
        const registration = {
          pushManager: {
            getSubscription: async () => (subscribed ? sub : null),
            subscribe: async () => {
              subscribed = true;
              return sub;
            },
          },
          getNotifications: async () => [],
        };
        Object.defineProperty(navigator, 'serviceWorker', {
          configurable: true,
          value: {
            register: async () => registration,
            ready: Promise.resolve(registration),
          },
        });
        if (s.subscribed) {
          localStorage.setItem('nur-push-opt-in-v1', 'yes');
          localStorage.setItem('nur-push-device-v1', 'x'.repeat(43));
        }
      }, scenario);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', () => errors.push('pageerror'));
      await page.goto(origin + '/nur-und-huda/together.html');
      await page.waitForFunction(
        () =>
          !document
            .querySelector('[data-push-status]')
            .textContent.includes('جارٍ'),
      );
      const panel = page.locator('[data-push]'),
        help = page.locator('[data-push-install]'),
        enable = page.locator('[data-push-enable]'),
        disable = page.locator('[data-push-disable]');
      assert.equal(
        await page.evaluate(() => window.__pushPermissionRequests),
        0,
      );
      assert.equal(await enable.isVisible(), Boolean(scenario.activate));
      assert.equal(await disable.isVisible(), Boolean(scenario.subscribed));
      if (scenario.install) {
        assert.match(await help.innerText(), /Safari.*الشاشة الرئيسية/);
        assert.equal(writes, 0);
      }
      if (scenario.android) {
        assert.match(await help.innerText(), /Chrome على Android/);
        assert.ok(!(await panel.innerText()).includes('Safari'));
      }
      if (scenario.denied) assert.match(await panel.innerText(), /محظورة/);
      if (scenario.unsupported)
        assert.match(await panel.innerText(), /غير مدعومة/);
      if (scenario.subscribed)
        assert.match(
          await panel.innerText(),
          /إشعارات الجماعة مفعّلة على هذا الجهاز/,
        );
      for (const width of [320, 375, 390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        assert.equal(
          await panel.evaluate((el) => getComputedStyle(el).direction),
          'rtl',
        );
        if (scenario.activate) {
          assert.equal(await enable.isEnabled(), true);
          assert.ok((await enable.boundingBox()).height >= 48);
        }
        if (width === 390) {
          await panel.scrollIntoViewIfNeeded();
          const shot = path.join(
            tmpdir(),
            `nur-push-ui-${engine}-${scenario.name}.png`,
          );
          await panel.screenshot({ path: shot });
          await chmod(shot, 0o600);
        }
      }
      if (scenario.activate) {
        await enable.click();
        await page.waitForFunction(
          () =>
            document.querySelector('[data-push-status]').textContent ===
            'إشعارات الجماعة مفعّلة على هذا الجهاز.',
        );
        assert.equal(
          await page.evaluate(() => window.__pushPermissionRequests),
          1,
        );
        assert.equal(await enable.isVisible(), false);
        assert.equal(await disable.isVisible(), true);
        assert.ok(writes > 0);
      }
      if (scenario.activate || scenario.subscribed) {
        await disable.click();
        await page.waitForFunction(() =>
          document
            .querySelector('[data-push-status]')
            .textContent.includes('غير مفعّلة'),
        );
        assert.equal(remote, false);
        assert.equal(await enable.isEnabled(), true);
      }
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${engine} UI simulation ${scenario.name}: 320/375/390/430px, RTL, correct controls and explicit opt-in`,
      );
    } finally {
      await context.close();
    }
  }
}
