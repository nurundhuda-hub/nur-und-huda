import { pushDevice } from './push-device';
export function initPush(
  root = document.querySelector<HTMLElement>('[data-push]'),
) {
  if (!root) return;
  const status = root.querySelector<HTMLElement>('[data-push-status]')!;
  const enable = root.querySelector<HTMLButtonElement>('[data-push-enable]')!;
  const disable = root.querySelector<HTMLButtonElement>('[data-push-disable]')!;
  const instructions = root.querySelector<HTMLElement>('[data-push-install]')!;
  const android = /Android/i.test(navigator.userAgent);
  const ios =
    !android &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  const androidChrome = android && /Chrome|Chromium/i.test(navigator.userAgent);
  const standalone =
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: fullscreen)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const wanted = 'nur-push-opt-in-v1';
  let registration: ServiceWorkerRegistration | undefined,
    key: string | undefined,
    busy = false,
    alive = true;
  instructions.textContent = '';
  instructions.hidden = true;
  enable.hidden = false;
  disable.hidden = true;
  if (ios && !standalone) {
    instructions.textContent =
      'في Safari: مشاركة ← إضافة إلى الشاشة الرئيسية، ثم افتح الموقع من الأيقونة الجديدة. يتطلب iOS 16.4 أو أحدث.';
    instructions.hidden = false;
    status.textContent = 'فعّل الإشعارات من تطبيق الشاشة الرئيسية.';
    enable.hidden = true;
    enable.disabled = true;
    return;
  }
  const supported =
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
  if (!supported) {
    status.textContent =
      'الإشعارات غير مدعومة في هذا المتصفح. يمكنك استخدام الجماعات كالمعتاد.';
    enable.hidden = true;
    enable.disabled = true;
    return;
  }
  const deniedMessage = ios
    ? 'الإشعارات محظورة. فعّلها لهذا التطبيق من إعدادات الجهاز.'
    : androidChrome
      ? 'الإشعارات محظورة. غيّر إذن الإشعارات لهذا الموقع في إعدادات Chrome.'
      : 'الإشعارات محظورة. غيّر إذنها لهذا الموقع في إعدادات المتصفح.';
  function guidance(active = false) {
    const denied = Notification.permission === 'denied';
    instructions.hidden = active || denied || !androidChrome;
    instructions.textContent = androidChrome
      ? 'في Chrome على Android، اضغط التفعيل ثم «السماح». لا يلزم تثبيت التطبيق.'
      : '';
    enable.hidden = active || denied;
  }
  guidance();
  status.textContent =
    Notification.permission === 'denied'
      ? deniedMessage
      : 'جارٍ التحقق من الإشعارات…';
  function preference(value?: string) {
    if (value !== undefined) localStorage.setItem(wanted, value);
    return localStorage.getItem(wanted) === 'yes';
  }
  async function request(method: string, body?: unknown) {
    const token = pushDevice(true);
    if (!token) throw Error('storage');
    const response = await fetch('/nur-und-huda/api/push/subscription', {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'X-Push-Device': token,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw Error('server');
    return response.json() as Promise<{ subscribed: boolean }>;
  }
  function failure() {
    status.textContent =
      Notification.permission === 'denied'
        ? deniedMessage
        : 'تعذّر تحديث الإشعارات. تحقق من الاتصال وأعد فتح الصفحة للمحاولة.';
  }
  async function sync() {
    if (busy || !alive) return;
    busy = true;
    enable.disabled = true;
    try {
      // Registration does not request permission and caches no private pages.
      registration = await navigator.serviceWorker.register(
        '/nur-und-huda/group-push.js',
        { scope: '/nur-und-huda/', updateViaCache: 'none' },
      );
      await navigator.serviceWorker.ready;
      const config = await fetch('/nur-und-huda/api/push/config', {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
      if (!config.ok) throw Error();
      key = (await config.json()).publicKey;
      const sub = await registration.pushManager.getSubscription();
      const opted = preference();
      const remote =
        sub && opted && Notification.permission === 'granted'
          ? await request('PUT', sub.toJSON())
          : pushDevice()
            ? await request('GET')
            : { subscribed: false };
      const active = Boolean(
        sub &&
        remote.subscribed &&
        Notification.permission === 'granted' &&
        opted,
      );
      disable.hidden = !sub && !remote.subscribed;
      guidance(active);
      status.textContent = active
        ? 'إشعارات الجماعة مفعّلة على هذا الجهاز.'
        : Notification.permission === 'denied'
          ? deniedMessage
          : 'إشعارات الجماعة غير مفعّلة على هذا الجهاز.';
      enable.disabled = active || Notification.permission === 'denied' || !key;
    } catch {
      failure();
      enable.disabled = !key || Notification.permission === 'denied';
    } finally {
      busy = false;
    }
  }
  const subscribe = async () => {
    if (busy || !registration || !key || Notification.permission === 'denied')
      return;
    busy = true;
    enable.disabled = true;
    let failed = false;
    try {
      // Permission request happens directly in the user's click, before awaits.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        preference('no');
        return;
      }
      const bytes = Uint8Array.from(
        atob(key.replace(/-/g, '+').replace(/_/g, '/')),
        (c) => c.charCodeAt(0),
      );
      const sub =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        }));
      await request('PUT', sub.toJSON());
      preference('yes');
    } catch {
      failed = true;
    } finally {
      busy = false;
      await sync();
      if (failed) failure();
    }
  };
  const unsubscribe = async () => {
    if (busy) return;
    busy = true;
    disable.disabled = true;
    let failed = false;
    try {
      await request('DELETE'); // Remove server delivery first, even if browser removal fails.
      preference('no');
      await (await registration?.pushManager.getSubscription())?.unsubscribe();
      for (const notification of (await registration?.getNotifications()) ?? [])
        notification.close();
    } catch {
      failed = true;
    } finally {
      busy = false;
      disable.disabled = false;
      await sync();
      if (failed) failure();
    }
  };
  const visible = () => {
    if (!document.hidden) void sync();
  };
  enable.addEventListener('click', subscribe);
  disable.addEventListener('click', unsubscribe);
  document.addEventListener('visibilitychange', visible);
  void sync();
  return () => {
    alive = false;
    enable.removeEventListener('click', subscribe);
    disable.removeEventListener('click', unsubscribe);
    document.removeEventListener('visibilitychange', visible);
  };
}
