import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initPush } from '../src/scripts/push-notifications';
let stop: (() => void) | undefined;
const markup = `<section data-push><p data-push-install hidden></p><p data-push-status></p><button data-push-enable disabled></button><button data-push-disable hidden></button></section>`;
const flush = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = markup;
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function mock(permission = 'default') {
  let current: object | null = null,
    registered = false;
  const unsubscribe = vi.fn(async () => {
    current = null;
    return true;
  });
  const subscription = {
    toJSON: () => ({
      endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic',
    }),
    unsubscribe,
  };
  const subscribe = vi.fn(async () => {
    current = subscription;
    return subscription;
  });
  const registration = {
    pushManager: { getSubscription: vi.fn(async () => current), subscribe },
    getNotifications: async () => [],
  };
  const serviceWorker = {
    register: vi.fn(async () => registration),
    ready: Promise.resolve(registration),
  };
  vi.stubGlobal('PushManager', class {});
  const notification = {
    permission,
    requestPermission: vi.fn(async () => {
      notification.permission = 'granted';
      return 'granted';
    }),
  };
  vi.stubGlobal('Notification', notification);
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    get: () => serviceWorker,
  });
  const fetch = vi.fn(async (_url: unknown, options?: RequestInit) => ({
    ok: true,
    json: async () => {
      if (String(_url).endsWith('/config'))
        return { publicKey: 'BA'.repeat(43) + 'A' };
      if (options?.method === 'PUT') registered = true;
      if (options?.method === 'DELETE') registered = false;
      return { subscribed: registered };
    },
  }));
  vi.stubGlobal('fetch', fetch);
  return { notification, subscribe, unsubscribe, fetch, serviceWorker };
}
it('does not prompt automatically; explicit opt-in persists and unsubscribe deletes server state', async () => {
  const m = mock();
  stop = initPush();
  await flush();
  expect(m.notification.requestPermission).not.toHaveBeenCalled();
  document.querySelector<HTMLButtonElement>('[data-push-enable]')!.click();
  await flush();
  expect(m.notification.requestPermission).toHaveBeenCalledTimes(1);
  expect(m.subscribe).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[data-push-status]')!.textContent).toContain(
    'مفعّلة',
  );
  stop?.();
  stop = initPush();
  await flush();
  expect(m.notification.requestPermission).toHaveBeenCalledTimes(1);
  document.querySelector<HTMLButtonElement>('[data-push-disable]')!.click();
  await flush();
  expect(m.unsubscribe).toHaveBeenCalled();
  expect(m.fetch.mock.calls.some(([, o]) => o?.method === 'DELETE')).toBe(true);
  expect(localStorage.getItem('nur-push-opt-in-v1')).toBe('no');
});
it('never asks again when permission was denied', async () => {
  const m = mock('denied');
  stop = initPush();
  await flush();
  expect(
    document.querySelector<HTMLButtonElement>('[data-push-enable]')!.disabled,
  ).toBe(true);
  expect(document.querySelector('[data-push-status]')!.textContent).toContain(
    'محظورة',
  );
  expect(m.notification.requestPermission).not.toHaveBeenCalled();
});
it('explains installation on iPhone Safari and does not request permission', async () => {
  const m = mock();
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Safari');
  stop = initPush();
  await flush();
  expect(
    document.querySelector<HTMLElement>('[data-push-install]')!.hidden,
  ).toBe(false);
  expect(m.serviceWorker.register).not.toHaveBeenCalled();
  expect(m.notification.requestPermission).not.toHaveBeenCalled();
});
it('allows supported iPhone Home Screen app to opt in without automatic prompt', async () => {
  const m = mock();
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Safari');
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  stop = initPush();
  await flush();
  expect(
    document.querySelector<HTMLElement>('[data-push-install]')!.hidden,
  ).toBe(true);
  expect(
    document.querySelector<HTMLButtonElement>('[data-push-enable]')!.disabled,
  ).toBe(false);
  expect(m.notification.requestPermission).not.toHaveBeenCalled();
});
it('fails safely when the browser lacks notification support', async () => {
  stop = initPush();
  await flush();
  expect(document.querySelector('[data-push-status]')!.textContent).toContain(
    'غير مدعومة',
  );
});
