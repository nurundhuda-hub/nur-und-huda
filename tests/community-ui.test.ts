import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { initCommunity } from '../src/scripts/community';
import { berlinLocal } from '../src/lib/community';
const markup = readFileSync('dist/together.html', 'utf8');
let stop: (() => void) | undefined;
const now = Date.parse('2026-11-03T10:00:00Z');
const item = {
  id: 'a'.repeat(64),
  prayer: 'asr',
  startsAt: new Date(now + 3600000).toISOString(),
  participantCount: 1,
  joined: false,
  participationRevision: 0,
  organizer: false,
  cancelled: false,
};
let online = true;
function root(api = 'https://staging.invalid/prayerApi') {
  document.body.innerHTML = markup;
  const r = document.querySelector<HTMLElement>('[data-community]')!;
  r.dataset.api = api;
  return r;
}
const reply = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body });
const list = (gatherings: unknown[] = []) =>
  reply({ serverTime: new Date(now).toISOString(), gatherings });
const flush = async () => {
  for (let n = 0; n < 20; n++) await Promise.resolve();
};
const button = (name: string) =>
  Array.from(document.querySelectorAll('button')).find(
    (b) => b.textContent === name,
  )!;
const status = () =>
  document.querySelector('[data-community-status]')!.textContent;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  localStorage.clear();
  online = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('keeps an unconfigured build inactive and sends no requests', () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  stop = initCommunity(root(''));
  expect(fetch).not.toHaveBeenCalled();
  expect(document.querySelector('fieldset')!.disabled).toBe(true);
});
it('does not misreport a failed initial load as an empty community', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => reply({ error: { code: 'UNAVAILABLE' } }, 503)),
  );
  stop = initCommunity(root());
  await flush();
  expect(document.querySelector<HTMLElement>('[data-empty]')!.hidden).toBe(
    true,
  );
  expect(document.querySelector('fieldset')!.disabled).toBe(true);
  expect(status()).toContain('تعذر');
});
it('requires explicit consent, joins with one action afterward, leaves and disables offline writes', async () => {
  const fetch = vi
    .fn()
    .mockImplementationOnce(() => list([item]))
    .mockImplementationOnce(() =>
      reply({ gathering: { ...item, joined: true } }),
    )
    .mockImplementationOnce(() =>
      list([
        {
          ...item,
          joined: true,
          participationRevision: 1,
          participantCount: 2,
        },
      ]),
    )
    .mockImplementationOnce(() => reply({}))
    .mockImplementationOnce(() => list([item]));
  vi.stubGlobal('fetch', fetch);
  stop = initCommunity(root());
  await flush();
  button('انضمام').click();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(document.querySelector<HTMLElement>('[data-consent]')!.hidden).toBe(
    false,
  );
  button('أوافق وأتابع').click();
  await flush();
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(JSON.parse(fetch.mock.calls[1]![1].body)).toMatchObject({
    joined: true,
    expectedRevision: 0,
    consent: 'prayer-v1',
  });
  expect(fetch.mock.calls[1]![1].headers.Authorization).toMatch(
    /^Bearer [A-Za-z0-9_-]{43}$/,
  );
  expect(status()).toContain('تم انضمامك');
  button('إلغاء مشاركتي').click();
  await flush();
  expect(JSON.parse(fetch.mock.calls[3]![1].body)).toMatchObject({
    joined: false,
    expectedRevision: 1,
  });
  online = false;
  window.dispatchEvent(new Event('offline'));
  expect(button('انضمام').disabled).toBe(true);
  expect(status()).toContain('غير متصل');
  expect(fetch).toHaveBeenCalledTimes(5);
});
it('retains the create operation ID after a lost response and never invents a success', async () => {
  localStorage.setItem(
    'nur-prayer-ownership-v1',
    JSON.stringify({ token: 'A'.repeat(43), expiresAt: now + 3600000 }),
  );
  const fetch = vi
    .fn()
    .mockImplementationOnce(() => list())
    .mockRejectedValueOnce(new TypeError('network'))
    .mockImplementationOnce(() => list())
    .mockImplementationOnce(() =>
      reply({ gathering: { ...item, organizer: true } }),
    )
    .mockImplementationOnce(() => list([{ ...item, organizer: true }]));
  vi.stubGlobal('fetch', fetch);
  stop = initCommunity(root());
  await flush();
  (document.querySelector('[name=time]') as HTMLInputElement).value =
    berlinLocal(new Date(now + 3600000));
  const form = document.querySelector('form')!;
  form.dispatchEvent(new Event('submit', { cancelable: true }));
  await flush();
  expect(status()).toContain('تعذر تأكيد');
  form.dispatchEvent(new Event('submit', { cancelable: true }));
  await flush();
  expect(JSON.parse(fetch.mock.calls[1]![1].body).operationId).toBe(
    JSON.parse(fetch.mock.calls[3]![1].body).operationId,
  );
  expect(status()).toContain('تم إنشاء');
});
it('blocks mutation if the ownership key cannot be stored', async () => {
  const fetch = vi.fn(() => list([item]));
  vi.stubGlobal('fetch', fetch);
  stop = initCommunity(root());
  await flush();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('blocked');
  });
  button('انضمام').click();
  button('أوافق وأتابع').click();
  await flush();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(status()).toContain('لا يمكن حفظ');
});
it('keeps a confirmed write success visible when the subsequent refresh fails', async () => {
  localStorage.setItem(
    'nur-prayer-ownership-v1',
    JSON.stringify({ token: 'A'.repeat(43), expiresAt: now + 3600000 }),
  );
  const fetch = vi
    .fn()
    .mockImplementationOnce(() => list([item]))
    .mockImplementationOnce(() => reply({}))
    .mockRejectedValueOnce(Error('network'));
  vi.stubGlobal('fetch', fetch);
  stop = initCommunity(root());
  await flush();
  button('انضمام').click();
  await flush();
  expect(status()).toContain('تم انضمامك');
  expect(status()).toContain('تعذّر تحديث');
});

it('clears a load error when background refresh successfully recovers', async () => {
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(Error('network'))
    .mockImplementationOnce(() => list());
  vi.stubGlobal('fetch', fetch);
  stop = initCommunity(root());
  await flush();
  expect(status()).toContain('تعذر');
  await vi.advanceTimersByTimeAsync(30_000);
  await flush();
  expect(status()).toContain('تم تحديث');
  expect(document.querySelector('fieldset')!.disabled).toBe(false);
});
