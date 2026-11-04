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
  participantNames: ['أحمد'],
  note: 'بعد الاجتماع',
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
  sessionStorage.clear();
  online = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  Element.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
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
  button('سأنضم').click();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(
    document.querySelector<HTMLDialogElement>('[data-consent]')!.open,
  ).toBe(true);
  (document.querySelector('#join-name') as HTMLInputElement).value = 'محمد';
  document.querySelector<HTMLButtonElement>('[data-consent-accept]')!.click();
  await flush();
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(JSON.parse(fetch.mock.calls[1]![1].body)).toMatchObject({
    joined: true,
    expectedRevision: 0,
    consent: 'prayer-v2',
    firstName: 'محمد',
  });
  expect(fetch.mock.calls[1]![1].headers.Authorization).toMatch(
    /^Bearer [A-Za-z0-9_-]{43}$/,
  );
  expect(status()).toContain('تم انضمامك');
  button('إلغاء انضمامي').click();
  await flush();
  expect(JSON.parse(fetch.mock.calls[3]![1].body)).toMatchObject({
    joined: false,
    expectedRevision: 1,
  });
  online = false;
  window.dispatchEvent(new Event('offline'));
  expect(button('سأنضم').disabled).toBe(true);
  expect(status()).toContain('غير متصل');
  expect(fetch).toHaveBeenCalledTimes(5);
});
it('retains the create operation ID after a lost response and never invents a success', async () => {
  localStorage.setItem(
    'nur-prayer-ownership-v1',
    JSON.stringify({ token: 'A'.repeat(43), expiresAt: now + 3600000 }),
  );
  localStorage.setItem('nur-prayer-name-v2', 'أحمد');
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
  const selected = berlinLocal(new Date(now + 3600000));
  (document.querySelector('[name=date]') as HTMLInputElement).value =
    selected.slice(0, 10);
  (document.querySelector('[name=time]') as HTMLInputElement).value =
    selected.slice(11);
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
  button('سأنضم').click();
  (document.querySelector('#join-name') as HTMLInputElement).value = 'محمد';
  document.querySelector<HTMLButtonElement>('[data-consent-accept]')!.click();
  await flush();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[data-name-error]')!.textContent).toContain(
    'لا يمكن حفظ',
  );
});
it('keeps a confirmed write success visible when the subsequent refresh fails', async () => {
  localStorage.setItem('nur-prayer-name-v2', 'محمد');
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
  button('سأنضم').click();
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

function stagingRoot() {
  const r = root();
  r.dataset.staging = 'true';
  r.insertAdjacentHTML(
    'afterbegin',
    '<form data-staging-login><input name="accessCode" type="password"><button>Login</button></form><button data-staging-logout hidden>Logout</button>',
  );
  return r;
}
it('keeps staging data locked until a server-approved credential, uses only the header and clears it on logout', async () => {
  const fetch = vi.fn().mockImplementation(() => list());
  vi.stubGlobal('fetch', fetch);
  const r = stagingRoot();
  stop = initCommunity(r);
  await flush();
  expect(fetch).not.toHaveBeenCalled();
  expect(r.querySelector('fieldset')!.disabled).toBe(true);
  const login = r.querySelector<HTMLFormElement>('[data-staging-login]')!;
  const input = login.elements.namedItem('accessCode') as HTMLInputElement;
  input.value = 'A'.repeat(43);
  login.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0]![0]).not.toContain('A'.repeat(43));
  expect(fetch.mock.calls[0]![1].headers['X-Staging-Access']).toBe(
    'A'.repeat(43),
  );
  expect(input.value).toBe('');
  expect(login.hidden).toBe(true);
  expect(localStorage.getItem('nur-prayer-staging-access-v1')).toBeNull();
  expect(sessionStorage.getItem('nur-prayer-staging-access-v1')).toBe(
    'A'.repeat(43),
  );
  r.querySelector<HTMLButtonElement>('[data-staging-logout]')!.click();
  expect(sessionStorage.getItem('nur-prayer-staging-access-v1')).toBeNull();
  expect(r.querySelector('fieldset')!.disabled).toBe(true);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('clears previously displayed staging data and disables writes when access expires', async () => {
  sessionStorage.setItem('nur-prayer-staging-access-v1', 'A'.repeat(43));
  const fetch = vi
    .fn()
    .mockImplementationOnce(() => list([item]))
    .mockImplementation(() =>
      reply({ error: { code: 'STAGING_CLOSED' } }, 403),
    );
  vi.stubGlobal('fetch', fetch);
  const r = stagingRoot();
  stop = initCommunity(r);
  await flush();
  expect(r.querySelector('[data-gatherings]')!.childElementCount).toBe(1);
  r.querySelector<HTMLButtonElement>('[data-refresh]')!.click();
  await flush();
  expect(r.querySelector('[data-gatherings]')!.childElementCount).toBe(0);
  expect(r.querySelector('fieldset')!.disabled).toBe(true);
  expect(sessionStorage.getItem('nur-prayer-staging-access-v1')).toBeNull();
  expect(r.querySelector<HTMLFormElement>('[data-staging-login]')!.hidden).toBe(
    false,
  );
});

it('renders public names and notes as text, supports changing the saved name, and expires visible records', async () => {
  localStorage.setItem('nur-prayer-name-v2', 'Max');
  const fetch = vi.fn(() =>
    list([
      {
        ...item,
        participantNames: ['أحمد', 'Max', '<img src=x>'],
        note: '<script>alert(1)</script>',
      },
    ]),
  );
  vi.stubGlobal('fetch', fetch);
  stop = initCommunity(root());
  await flush();
  expect(document.querySelector('.participant-names')!.textContent).toContain(
    'أحمد، Max',
  );
  expect(
    document.querySelector('.gathering-card img, .gathering-card script'),
  ).toBeNull();
  button('تغيير اسمي').click();
  (document.querySelector('#join-name') as HTMLInputElement).value = 'محمد';
  document.querySelector<HTMLButtonElement>('[data-consent-accept]')!.click();
  expect(localStorage.getItem('nur-prayer-name-v2')).toBe('محمد');
  expect(
    (document.querySelector('#community-name') as HTMLInputElement).value,
  ).toBe('محمد');
  expect(fetch).toHaveBeenCalledTimes(1);
  vi.setSystemTime(now + 3600000);
  await vi.advanceTimersByTimeAsync(1000);
  expect(document.querySelectorAll('.gathering-card')).toHaveLength(0);
});
it('exposes both options, saves the first name after consent, and creates without any login', async () => {
  const fetch = vi
    .fn()
    .mockImplementationOnce(() => list())
    .mockImplementationOnce(() => reply({ gathering: item }))
    .mockImplementationOnce(() => list([item]));
  vi.stubGlobal('fetch', fetch);
  stop = initCommunity(root());
  await flush();
  expect(document.querySelectorAll('.community-options a')).toHaveLength(2);
  expect(document.querySelector('[data-staging-login]')).toBeNull();
  const form = document.querySelector<HTMLFormElement>('[data-create]')!;
  (form.elements.namedItem('firstName') as HTMLInputElement).value = 'علي';
  const selected = berlinLocal(new Date(now + 3600000));
  (form.elements.namedItem('date') as HTMLInputElement).value = selected.slice(
    0,
    10,
  );
  (form.elements.namedItem('time') as HTMLInputElement).value =
    selected.slice(11);
  (form.elements.namedItem('note') as HTMLInputElement).value = 'بعد الاجتماع';
  form.dispatchEvent(new Event('submit', { cancelable: true }));
  await flush();
  expect(fetch).toHaveBeenCalledTimes(1); // Explicit first-use consent still required.
  (form.elements.namedItem('consent') as HTMLInputElement).checked = true;
  form.dispatchEvent(new Event('submit', { cancelable: true }));
  await flush();
  expect(JSON.parse(fetch.mock.calls[1]![1].body)).toMatchObject({
    firstName: 'علي',
    note: 'بعد الاجتماع',
    consent: 'prayer-v2',
  });
  expect(fetch.mock.calls[1]![1].headers['X-Staging-Access']).toBeUndefined();
  expect(localStorage.getItem('nur-prayer-name-v2')).toBe('علي');
  expect(status()).toContain('تم إنشاء');
});
