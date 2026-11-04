import { firstName, shortNote } from '../lib/community-fields';
import {
  apiEndpoint,
  berlinLocal,
  berlinToUtc,
  communityErrors,
  prayerLabels,
  type CommunityGathering,
} from '../lib/community';

type LocalIdentity = {
  token: string;
  expiresAt: number;
  pendingCreate?: {
    prayer: string;
    startsAt: string;
    operationId: string;
    firstName?: string;
    note?: string;
  };
};
const STORAGE = 'nur-prayer-ownership-v1';
const NAME_STORAGE = 'nur-prayer-name-v2';
const ACCESS_STORAGE = 'nur-prayer-staging-access-v1';
export function initCommunity(
  root = document.querySelector<HTMLElement>('[data-community]'),
) {
  if (!root || !root.dataset.api) return;
  const endpoint = apiEndpoint(
    root.dataset.api ?? '',
    ['localhost', '127.0.0.1'].includes(location.hostname),
  );
  const status = root.querySelector<HTMLElement>('[data-community-status]')!;
  const list = root.querySelector<HTMLElement>('[data-gatherings]')!;
  const empty = root.querySelector<HTMLElement>('[data-empty]')!;
  const refresh = root.querySelector<HTMLButtonElement>('[data-refresh]')!;
  const form = root.querySelector<HTMLFormElement>('[data-create]')!;
  const fieldset = form.querySelector<HTMLFieldSetElement>('fieldset')!;
  const time = form.elements.namedItem('time') as HTMLInputElement;
  const date = form.elements.namedItem('date') as HTMLInputElement;
  const nameInput = form.elements.namedItem(
    'firstName',
  ) as HTMLInputElement | null;
  const noteInput = form.elements.namedItem(
    'note',
  ) as HTMLTextAreaElement | null;
  const consentInput = form.elements.namedItem('consent') as HTMLInputElement;
  const consentLabel = root.querySelector<HTMLElement>(
    '[data-create-consent]',
  )!;
  const prayer = form.elements.namedItem('prayer') as HTMLSelectElement;
  const consent = root.querySelector<HTMLDialogElement>('[data-consent]')!;
  const accept = root.querySelector<HTMLButtonElement>(
    '[data-consent-accept]',
  )!;
  const nameForm = root.querySelector<HTMLFormElement>('[data-name-form]')!;
  const dialogName = nameForm.elements.namedItem(
    'firstName',
  ) as HTMLInputElement | null;
  const nameError = root.querySelector<HTMLElement>('[data-name-error]')!;
  const changeName =
    root.querySelector<HTMLButtonElement>('[data-change-name]');
  const editNote = root.querySelector<HTMLElement>('[data-name-edit-note]')!;
  let savedName = '';
  try {
    savedName = firstName(localStorage.getItem(NAME_STORAGE));
  } catch {
    /* First visit. */
  }
  if (nameInput) nameInput.value = savedName;
  if (!endpoint) return;
  const staging = root.dataset.staging === 'true';
  const login = root.querySelector<HTMLFormElement>('[data-staging-login]');
  const logout = root.querySelector<HTMLButtonElement>('[data-staging-logout]');
  let accessCredential = '';
  if (staging) {
    // A broken staging login must never silently become a public client.
    if (!login || !logout) return;
    try {
      accessCredential = sessionStorage.getItem(ACCESS_STORAGE) ?? '';
    } catch {
      /* Memory-only access still works when session storage is blocked. */
    }
  }
  let identity: LocalIdentity | null = null;
  try {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE) ?? 'null',
    ) as LocalIdentity | null;
    if (
      stored &&
      /^[A-Za-z0-9_-]{43}$/.test(stored.token) &&
      stored.expiresAt > Date.now() &&
      stored.expiresAt <= Date.now() + 27 * 3_600_000
    )
      identity = stored;
    else localStorage.removeItem(STORAGE);
  } catch {
    /* Browsing remains available; participation will explain blocked storage. */
  }
  let gatherings: CommunityGathering[] = [],
    busy = false,
    loading = false,
    loaded = false,
    offset = 0,
    sequence = 0,
    retryAfter = 0,
    lastError = false;
  let deferred: (() => Promise<void>) | null = null;
  function message(text: string, error = false) {
    status.textContent = text;
    lastError = error;
  }
  function save() {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(identity));
      if (
        JSON.parse(localStorage.getItem(STORAGE) ?? 'null')?.token !==
        identity?.token
      )
        throw Error();
    } catch {
      throw new Error('STORAGE');
    }
  }
  function expireIdentity() {
    if (
      identity?.pendingCreate &&
      Date.parse(identity.pendingCreate.startsAt) <= Date.now()
    ) {
      delete identity.pendingCreate;
      save();
    }
    if (identity && identity.expiresAt <= Date.now()) {
      identity = null;
      try {
        localStorage.removeItem(STORAGE);
      } catch {
        /* No write is attempted without a new consent. */
      }
    }
  }
  function retain() {
    if (identity) {
      identity.expiresAt = Date.now() + 26 * 3_600_000;
      save();
    }
  }
  function nameState() {
    const approved = staging ? Boolean(identity) : Boolean(savedName);
    consentInput.required = !approved;
    consentInput.checked = approved;
    consentLabel.hidden = approved;
    const label = root!.querySelector<HTMLElement>('[data-saved-name]');
    if (label)
      label.textContent = savedName
        ? `اسمك على هذا الجهاز: ${savedName}`
        : 'يكفي اسمك الأول، بلا حساب.';
    if (changeName) changeName.hidden = !savedName;
  }
  function rememberName(name: string) {
    try {
      localStorage.setItem(NAME_STORAGE, name);
    } catch {
      throw new Error('STORAGE');
    }
    savedName = name;
    if (nameInput) nameInput.value = name;
    nameState();
  }
  function readSharedIdentity() {
    try {
      const current = JSON.parse(
        localStorage.getItem(STORAGE) ?? 'null',
      ) as LocalIdentity | null;
      if (
        current &&
        /^[A-Za-z0-9_-]{43}$/.test(current.token) &&
        current.expiresAt > Date.now() &&
        current.expiresAt <= Date.now() + 27 * 3_600_000
      )
        identity = current;
    } catch {
      /* Writes below still require functioning storage. */
    }
  }
  async function ensureIdentity() {
    const obtain = () => {
      readSharedIdentity();
      expireIdentity();
      if (!identity) {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        identity = {
          token: btoa(String.fromCharCode(...bytes))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, ''),
          expiresAt: Date.now() + 26 * 3_600_000,
        };
        try {
          save();
        } catch (error) {
          identity = null;
          throw error;
        }
      }
    };
    // Coordinate first-use key creation across same-origin tabs, including Safari.
    if (navigator.locks) await navigator.locks.request(STORAGE, obtain);
    else obtain();
  }
  function state() {
    const disabled = busy || loading || !navigator.onLine || !loaded;
    fieldset.disabled = disabled;
    accept.disabled = disabled;
    refresh.disabled =
      busy || loading || !navigator.onLine || (staging && !accessCredential);
    root!
      .querySelectorAll<HTMLButtonElement>('[data-mutation]')
      .forEach((b) => {
        b.disabled = disabled;
      });
    date.min = berlinLocal(new Date(Date.now() + offset)).slice(0, 10);
    date.max = berlinLocal(
      new Date(Date.now() + offset + 24 * 3_600_000),
    ).slice(0, 10);
    if (!date.value) date.value = date.min;
  }
  async function request(path: string, method = 'GET', body?: unknown) {
    if (!navigator.onLine) throw new Error('OFFLINE');
    if (staging && !accessCredential)
      throw new Error('STAGING_ACCESS_REQUIRED');
    readSharedIdentity();
    expireIdentity();
    const controller = new AbortController(),
      timer = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(endpoint + path, {
        method,
        signal: controller.signal,
        cache: 'no-store',
        credentials: endpoint === '/nur-und-huda/api' ? 'same-origin' : 'omit',
        referrerPolicy: 'no-referrer',
        headers: {
          ...(staging ? { 'X-Staging-Access': accessCredential } : {}),
          ...(identity ? { Authorization: `Bearer ${identity.token}` } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 429) retryAfter = Date.now() + 60_000;
        throw new Error(result.error?.code ?? 'UNAVAILABLE');
      }
      return result;
    } finally {
      clearTimeout(timer);
    }
  }
  function failure(error: unknown) {
    const key = error instanceof Error ? error.message : 'UNAVAILABLE';
    if (
      staging &&
      ['STAGING_ACCESS_REQUIRED', 'STAGING_CLOSED'].includes(key)
    ) {
      accessCredential = '';
      loaded = false;
      gatherings = [];
      list.replaceChildren();
      empty.hidden = true;
      if (login) login.hidden = false;
      if (logout) logout.hidden = true;
      try {
        sessionStorage.removeItem(ACCESS_STORAGE);
      } catch {
        /* No stored credential. */
      }
    }
    if (key === 'GROUP_ACCESS_REQUIRED') {
      loaded = false;
      gatherings = [];
      list.replaceChildren();
      empty.hidden = true;
    }
    message(communityErrors[key] ?? communityErrors.UNAVAILABLE!, true);
    if (key === 'GROUP_ACCESS_REQUIRED') {
      const link = document.createElement('a');
      link.href = '/access?next=%2Fnur-und-huda%2Ftogether.html';
      link.textContent = 'إدخال رمز المجموعة';
      status.append(' ', link);
    }
  }
  function render() {
    const focused = document.activeElement as HTMLElement | null;
    const focusKey = list.contains(focused)
      ? focused?.dataset.focusKey
      : undefined;
    list.replaceChildren();
    for (const item of gatherings.filter(
      (g) => !g.cancelled && Date.parse(g.startsAt) > Date.now() + offset,
    )) {
      const card = document.createElement('article');
      card.className = 'gathering-card';
      const title = document.createElement('h3');
      title.textContent = `صلاة ${prayerLabels[item.prayer] ?? ''}`;
      const when = document.createElement('time');
      when.dateTime = item.startsAt;
      when.textContent = new Intl.DateTimeFormat('ar-DE', {
        timeZone: 'Europe/Berlin',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(item.startsAt));
      const count = document.createElement('p');
      count.textContent = `المشاركون: ${new Intl.NumberFormat('ar').format(item.participantCount)}${item.joined ? ' — أنت مشارك' : ''}`;
      const actions = document.createElement('div');
      actions.className = 'gathering-actions';
      const join = document.createElement('button');
      join.type = 'button';
      join.dataset.mutation = 'true';
      join.dataset.focusKey = item.id + ':join';
      join.textContent = item.joined ? 'إلغاء انضمامي' : 'سأنضم';
      join.addEventListener('click', () =>
        authorize(
          async () =>
            mutate(
              async () => {
                await request(`/gatherings/${item.id}/participation`, 'PUT', {
                  joined: !item.joined,
                  expectedRevision: item.participationRevision,
                  operationId: crypto.randomUUID(),
                  consent: staging ? 'prayer-v1' : 'prayer-v2',
                  ...(!staging
                    ? { firstName: item.joined ? '' : savedName }
                    : {}),
                });
              },
              item.joined ? 'تم إلغاء مشاركتك.' : 'تم انضمامك إلى الجماعة.',
            ),
          !item.joined,
        ),
      );
      actions.append(join);
      if (item.organizer) {
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.dataset.mutation = 'true';
        cancel.className = 'secondary';
        cancel.dataset.focusKey = item.id + ':cancel';
        cancel.textContent = 'إلغاء الجماعة';
        cancel.addEventListener('click', () => {
          if (window.confirm('إلغاء هذه الجماعة للجميع؟'))
            authorize(
              async () =>
                mutate(async () => {
                  await request(`/gatherings/${item.id}`, 'DELETE');
                }, 'تم إلغاء الجماعة.'),
              false,
            );
        });
        actions.append(cancel);
      }
      card.append(title, when, count);
      if (!staging && item.participantNames?.length) {
        const names = document.createElement('p');
        names.className = 'participant-names';
        names.append('معكم: ');
        item.participantNames.forEach((name, index) => {
          if (index) names.append('، ');
          const label = document.createElement('bdi');
          label.textContent = name;
          names.append(label);
        });
        card.append(names);
      }
      if (!staging && item.note) {
        const note = document.createElement('p');
        note.className = 'gathering-note';
        note.dir = 'auto';
        note.textContent = item.note;
        card.append(note);
      }
      card.append(actions);
      list.append(card);
    }
    if (focusKey)
      [...list.querySelectorAll<HTMLButtonElement>('[data-focus-key]')]
        .find((b) => b.dataset.focusKey === focusKey)
        ?.focus({ preventScroll: true });
    empty.hidden = !loaded || list.childElementCount > 0;
    state();
  }
  async function load(silent = false): Promise<boolean> {
    if (loading) return false;
    if (staging && !accessCredential) {
      message(communityErrors.STAGING_ACCESS_REQUIRED!);
      state();
      return false;
    }
    if (!navigator.onLine) {
      message(communityErrors.OFFLINE!, true);
      state();
      return false;
    }
    const current = ++sequence;
    loading = true;
    list.setAttribute('aria-busy', 'true');
    state();
    try {
      const response = await request('/gatherings');
      if (current !== sequence) return false;
      if (
        !Array.isArray(response.gatherings) ||
        !Number.isFinite(Date.parse(response.serverTime))
      )
        throw new Error('UNAVAILABLE');
      offset = Date.parse(response.serverTime) - Date.now();
      gatherings = response.gatherings;
      loaded = true;
      if (staging) {
        login!.hidden = true;
        logout!.hidden = false;
        try {
          sessionStorage.setItem(ACCESS_STORAGE, accessCredential);
        } catch {
          /* Memory-only for this tab. */
        }
      }
      render();
      if (!silent || lastError) message('تم تحديث الجماعات القادمة.');
      return true;
    } catch (error) {
      if (current === sequence) failure(error);
      return false;
    } finally {
      loading = false;
      list.setAttribute('aria-busy', 'false');
      state();
    }
  }
  async function mutate(work: () => Promise<void>, success: string) {
    if (busy || loading) return;
    busy = true;
    ++sequence;
    state();
    try {
      if (!navigator.onLine) throw new Error('OFFLINE');
      retain();
      await work();
      // A successful write is reported separately from any subsequent read failure.
      const refreshed = await load(true);
      message(
        refreshed
          ? success
          : `${success} تعذّر تحديث القائمة؛ اضغط تحديث للتحقق من آخر الأعداد.`,
        !refreshed,
      );
    } catch (error) {
      await load(true);
      failure(error);
    } finally {
      busy = false;
      render();
    }
  }
  function openNameDialog(work: (() => Promise<void>) | null) {
    deferred = work;
    nameError.textContent = '';
    if (dialogName) dialogName.value = savedName;
    editNote.hidden = Boolean(work);
    accept.textContent = work ? 'سأنضم' : 'حفظ الاسم';
    consent.showModal();
    (dialogName ?? accept).focus();
  }
  async function authorize(work: () => Promise<void>, needsName = true) {
    expireIdentity();
    try {
      if (!staging && !savedName)
        savedName = firstName(localStorage.getItem(NAME_STORAGE));
    } catch {
      /* Ask on first use. */
    }
    if (needsName && (staging ? !identity : !savedName)) {
      openNameDialog(work);
      return;
    }
    try {
      await ensureIdentity();
      void work();
    } catch (error) {
      failure(error);
    }
  }
  nameForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!nameForm.reportValidity()) return;
    try {
      if (!staging) rememberName(firstName(dialogName!.value));
      await ensureIdentity();
      const work = deferred;
      deferred = null;
      consent.close();
      nameState();
      if (work) void work();
    } catch (error) {
      const key = error instanceof Error ? error.message : 'UNAVAILABLE';
      nameError.textContent =
        communityErrors[key] ?? communityErrors.UNAVAILABLE!;
    }
  });
  root
    .querySelector('[data-name-cancel]')!
    .addEventListener('click', () => consent.close());
  consent.addEventListener('close', () => {
    deferred = null;
  });
  changeName?.addEventListener('click', () => openNameDialog(null));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || loading || !loaded || !form.reportValidity()) return;
    let startsAt: string,
      name = '',
      note = '';
    try {
      startsAt = berlinToUtc(`${date.value}T${time.value}`);
      if (!staging) {
        name = firstName(nameInput!.value);
        note = shortNote(noteInput!.value);
      }
      await ensureIdentity();
      if (!staging) rememberName(name);
      nameState();
    } catch (error) {
      failure(error);
      return;
    }
    const selectedPrayer = prayer.value;
    void mutate(async () => {
      const pending = identity!.pendingCreate;
      const command =
        pending?.prayer === selectedPrayer &&
        pending.startsAt === startsAt &&
        (staging || (pending.firstName === name && pending.note === note))
          ? pending
          : {
              prayer: selectedPrayer,
              startsAt,
              operationId: crypto.randomUUID(),
              ...(!staging ? { firstName: name, note } : {}),
            };
      identity!.pendingCreate = command;
      save();
      const response = await request('/gatherings', 'POST', {
        ...command,
        consent: staging ? 'prayer-v1' : 'prayer-v2',
      });
      delete identity!.pendingCreate;
      save();
      if (response.gathering.cancelled) throw new Error('EXPIRED');
      if (noteInput) noteInput.value = '';
    }, 'تم إنشاء الجماعة وانضمامك إليها.');
  });
  nameState();
  refresh.addEventListener('click', () => {
    void load();
  });
  const signIn = (event: Event) => {
    event.preventDefault();
    if (busy || loading || !login) return;
    const input = login.elements.namedItem('accessCode') as HTMLInputElement;
    const value = input.value.trim();
    input.value = '';
    if (!/^[A-Za-z0-9_-]{43}$/.test(value)) {
      failure(new Error('STAGING_ACCESS_REQUIRED'));
      return;
    }
    accessCredential = value;
    void load();
  };
  const signOut = () => {
    ++sequence;
    failure(new Error('STAGING_ACCESS_REQUIRED'));
    deferred = null;
    if (consent.open) consent.close();
    state();
    login?.querySelector<HTMLInputElement>('input')?.focus();
  };
  login?.addEventListener('submit', signIn);
  logout?.addEventListener('click', signOut);
  const accessFields = login?.querySelector<HTMLFieldSetElement>(
    '[data-staging-fields]',
  );
  if (accessFields) accessFields.disabled = false;
  const online = () => {
    void load();
  };
  const offline = () => {
    ++sequence;
    message(communityErrors.OFFLINE!, true);
    state();
  };
  window.addEventListener('online', online);
  window.addEventListener('offline', offline);
  const visible = () => {
    if (!document.hidden) void load();
  };
  document.addEventListener('visibilitychange', visible);
  const expiry = window.setInterval(() => {
    if (gatherings.some((g) => Date.parse(g.startsAt) <= Date.now() + offset)) {
      gatherings = gatherings.filter(
        (g) => Date.parse(g.startsAt) > Date.now() + offset,
      );
      render();
    }
  }, 1000);
  const poll = window.setInterval(() => {
    render();
    if (
      !document.hidden &&
      !busy &&
      navigator.onLine &&
      Date.now() >= retryAfter
    )
      void load(true);
  }, 30_000);
  void load();
  return () => {
    clearInterval(poll);
    clearInterval(expiry);
    ++sequence;
    window.removeEventListener('online', online);
    window.removeEventListener('offline', offline);
    document.removeEventListener('visibilitychange', visible);
    login?.removeEventListener('submit', signIn);
    logout?.removeEventListener('click', signOut);
  };
}
