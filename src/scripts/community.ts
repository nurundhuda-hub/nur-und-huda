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
  pendingCreate?: { prayer: string; startsAt: string; operationId: string };
};
const STORAGE = 'nur-prayer-ownership-v1';
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
  const prayer = form.elements.namedItem('prayer') as HTMLSelectElement;
  const consent = root.querySelector<HTMLElement>('[data-consent]')!;
  const accept = root.querySelector<HTMLButtonElement>(
    '[data-consent-accept]',
  )!;
  if (!endpoint) return;
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
  function state() {
    const disabled = busy || loading || !navigator.onLine || !loaded;
    fieldset.disabled = disabled;
    accept.disabled = disabled;
    refresh.disabled = busy || loading || !navigator.onLine;
    root!
      .querySelectorAll<HTMLButtonElement>('[data-mutation]')
      .forEach((b) => {
        b.disabled = disabled;
      });
    time.min = berlinLocal(new Date(Date.now() + offset + 120_000));
    time.max = berlinLocal(new Date(Date.now() + offset + 24 * 3_600_000));
  }
  async function request(path: string, method = 'GET', body?: unknown) {
    if (!navigator.onLine) throw new Error('OFFLINE');
    expireIdentity();
    const controller = new AbortController(),
      timer = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(endpoint + path, {
        method,
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: {
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
    message(communityErrors[key] ?? communityErrors.UNAVAILABLE!, true);
  }
  function render() {
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
      join.textContent = item.joined ? 'إلغاء مشاركتي' : 'انضمام';
      join.addEventListener('click', () =>
        authorize(async () =>
          mutate(
            async () => {
              await request(`/gatherings/${item.id}/participation`, 'PUT', {
                joined: !item.joined,
                expectedRevision: item.participationRevision,
                operationId: crypto.randomUUID(),
                consent: 'prayer-v1',
              });
            },
            item.joined ? 'تم إلغاء مشاركتك.' : 'تم انضمامك إلى الجماعة.',
          ),
        ),
      );
      actions.append(join);
      if (item.organizer) {
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.dataset.mutation = 'true';
        cancel.className = 'secondary';
        cancel.textContent = 'إلغاء الجماعة';
        cancel.addEventListener('click', () => {
          if (window.confirm('إلغاء هذه الجماعة للجميع؟'))
            authorize(async () =>
              mutate(async () => {
                await request(`/gatherings/${item.id}`, 'DELETE');
              }, 'تم إلغاء الجماعة.'),
            );
        });
        actions.append(cancel);
      }
      card.append(title, when, count, actions);
      list.append(card);
    }
    empty.hidden = !loaded || list.childElementCount > 0;
    state();
  }
  async function load(silent = false): Promise<boolean> {
    if (loading) return false;
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
  function authorize(work: () => Promise<void>) {
    expireIdentity();
    if (identity) {
      void work();
      return;
    }
    deferred = work;
    consent.hidden = false;
    consent.scrollIntoView({ block: 'center', behavior: 'smooth' });
    accept.focus();
  }
  accept.addEventListener('click', () => {
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      identity = {
        token: btoa(String.fromCharCode(...bytes))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, ''),
        expiresAt: Date.now() + 26 * 3_600_000,
      };
      save();
      consent.hidden = true;
      const work = deferred;
      deferred = null;
      if (work) void work();
    } catch {
      identity = null;
      failure(new Error('STORAGE'));
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    let startsAt: string;
    try {
      startsAt = berlinToUtc(time.value);
    } catch (error) {
      failure(error);
      return;
    }
    const selectedPrayer = prayer.value;
    authorize(async () =>
      mutate(async () => {
        const pending = identity!.pendingCreate;
        const command =
          pending?.prayer === selectedPrayer && pending.startsAt === startsAt
            ? pending
            : {
                prayer: selectedPrayer,
                startsAt,
                operationId: crypto.randomUUID(),
              };
        identity!.pendingCreate = command;
        save();
        const response = await request('/gatherings', 'POST', {
          ...command,
          consent: 'prayer-v1',
        });
        delete identity!.pendingCreate;
        save();
        if (response.gathering.cancelled) throw new Error('EXPIRED');
      }, 'تم إنشاء الجماعة وانضمامك إليها.'),
    );
  });
  refresh.addEventListener('click', () => {
    void load();
  });
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
    ++sequence;
    window.removeEventListener('online', online);
    window.removeEventListener('offline', offline);
    document.removeEventListener('visibilitychange', visible);
  };
}
