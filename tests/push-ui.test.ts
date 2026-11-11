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
  expect(
    document.querySelector<HTMLElement>('[data-push-enable]')!.hidden,
  ).toBe(true);
  expect(
    document.querySelector<HTMLElement>('[data-push-disable]')!.hidden,
  ).toBe(false);
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
it('shows Android Chrome instructions and permits activation without installation', async () => {
  const m = mock();
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
    'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36',
  );
  // An Android UA must never be overridden by a desktop-emulation platform hint.
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    get: () => 5,
  });
  stop = initPush();
  await flush();
  const help = document.querySelector<HTMLElement>('[data-push-install]')!;
  const enable =
    document.querySelector<HTMLButtonElement>('[data-push-enable]')!;
  expect(help.hidden).toBe(false);
  expect(help.textContent).toContain('Chrome على Android');
  expect(help.textContent).not.toContain('Safari');
  expect(enable.disabled).toBe(false);
  expect(enable.hidden).toBe(false);
  expect(m.notification.requestPermission).not.toHaveBeenCalled();
  enable.click();
  await flush();
  expect(m.subscribe).toHaveBeenCalledTimes(1);
  expect(help.hidden).toBe(true);
  expect(document.querySelector('[data-push-status]')!.textContent).toBe(
    'إشعارات الجماعة مفعّلة على هذا الجهاز.',
  );
});
it.each(['navigator', 'fullscreen'])(
  'recognizes installed iOS using %s and activates on click',
  async (signal) => {
    const m = mock();
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Safari');
    if (signal === 'navigator')
      Object.defineProperty(navigator, 'standalone', {
        configurable: true,
        value: true,
      });
    else
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('fullscreen'),
      }));
    try {
      stop = initPush();
      await flush();
      const button =
        document.querySelector<HTMLButtonElement>('[data-push-enable]')!;
      expect(button.hidden).toBe(false);
      expect(button.disabled).toBe(false);
      button.click();
      await flush();
      expect(m.subscribe).toHaveBeenCalledTimes(1);
    } finally {
      Reflect.deleteProperty(navigator, 'standalone');
    }
  },
);
it('keeps denied permission explanation accurate even if server initialization fails', async () => {
  const m = mock('denied');
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Chrome/130');
  m.serviceWorker.register.mockRejectedValueOnce(Error('offline'));
  stop = initPush();
  await flush();
  expect(document.querySelector('[data-push-status]')!.textContent).toContain(
    'إعدادات Chrome',
  );
  expect(
    document.querySelector<HTMLElement>('[data-push-enable]')!.hidden,
  ).toBe(true);
  expect(m.notification.requestPermission).not.toHaveBeenCalled();
});
