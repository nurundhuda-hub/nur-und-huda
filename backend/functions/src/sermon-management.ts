import { ApiError } from './core.js';
import {
  editorDigest,
  escapeEditor,
  initialEditorHead,
  renderEditorRevision,
  validateEditorContent,
  type EditorSeed,
  type EditorHead,
  type EditorStore,
} from './sermon-editor.js';
export type Delivery = 'scheduled' | 'delivered' | 'not-delivered';
export interface Assignment {
  sermonId: string;
  status: Delivery;
  updatedAt: string;
}
export interface ManagedEntry {
  id: string;
  title: string;
  createdAt: string;
}
export interface ScheduleEvent {
  version: number;
  action: string;
  at: string;
  before: Record<string, Assignment | null>;
  after: Record<string, Assignment | null>;
}
export interface ManagementState {
  version: number;
  created: ManagedEntry[];
  assignments: Record<string, Assignment>;
  previous: ScheduleEvent | null;
  recent: {
    id: string;
    digest: string;
    result: { version: number; id?: string };
  }[];
  writes: number[];
}
export interface ManagementStore {
  read(): Promise<ManagementState | null>;
  transact<T>(
    id: string | null,
    work: (
      state: ManagementState | null,
      head: EditorHead | null,
    ) => {
      state: ManagementState;
      head?: EditorHead;
      event?: ScheduleEvent;
      result: T;
    },
  ): Promise<T>;
}
const fail = (code: string, status = 409): never => {
  throw new ApiError(status, code);
};
export function friday(value: unknown): string {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value))
    return fail('FRIDAY_REQUIRED', 400);
  const d = new Date(value + 'T12:00:00Z');
  if (
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== value ||
    d.getUTCDay() !== 5
  )
    return fail('FRIDAY_REQUIRED', 400);
  return value;
}
export function berlinDate(time: number) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(time);
}
export function upcomingFridays(time: number) {
  const day = new Date(berlinDate(time) + 'T12:00:00Z');
  day.setUTCDate(day.getUTCDate() + ((5 - day.getUTCDay() + 7) % 7));
  return Array.from({ length: 8 }, (_, i) =>
    new Date(day.getTime() + i * 7 * 86400000).toISOString().slice(0, 10),
  );
}
export function initialManagement(seeds: EditorSeed[]): ManagementState {
  const assignments: Record<string, Assignment> = {};
  for (const seed of seeds.filter((s) => !s.testOnly && s.friday)) {
    const date = friday(seed.friday);
    if (assignments[date]) fail('SCHEDULE_CONFLICT');
    // A historical publication date is NOT delivery evidence.
    assignments[date] = {
      sermonId: seed.id,
      status: 'scheduled',
      updatedAt: seed.publishedAt,
    };
  }
  return {
    version: 0,
    created: [],
    assignments,
    previous: null,
    recent: [],
    writes: [],
  };
}
export function managedSeed(id: string, blueprint: EditorSeed): EditorSeed {
  const path = `sermons/${id}.html`,
    studyPath = `studies/${id}.html`,
    downloadPath = `downloads/sermons/${id}.html`;
  const swap = (s: string) =>
    s
      .replaceAll('editor-check-study.html', studyPath)
      .replaceAll('editor-check-download.html', downloadPath)
      .replaceAll('editor-check.html', path);
  return {
    ...blueprint,
    id,
    title: '',
    path,
    studyPath,
    downloadPath,
    managed: true,
    testOnly: false,
    friday: undefined,
    originalRevision: 'website',
    publishedAt: '',
    content: { title: '', first: '', second: '', study: null },
    originals: { first: '', second: '', study: null },
    templates: {
      article: swap(blueprint.templates.article),
      reader: swap(blueprint.templates.reader),
      study: swap(blueprint.templates.study!).replace(
        'دراسة الاختبار',
        'الشرح الموسّع',
      ),
    },
  };
}
export function createSermonManagement(
  store: ManagementStore,
  edits: EditorStore,
  seeds: () => Promise<EditorSeed[]>,
  now = Date.now,
) {
  const source = async () => {
    const all = await seeds();
    const blueprint = all.find((s) => s.testOnly);
    if (!blueprint) fail('UNAVAILABLE', 503);
    return { all, blueprint: blueprint! };
  };
  async function resolve(id: string) {
    const { blueprint } = await source();
    return (await store.read())?.created.some((s) => s.id === id)
      ? managedSeed(id, blueprint)
      : null;
  }
  async function inspect(includeDrafts = true) {
    const { all, blueprint } = await source(),
      state = (await store.read()) ?? initialManagement(all);
    const catalog = await Promise.all(
      [
        ...all.filter((s) => !s.testOnly),
        ...state.created.map((s) => managedSeed(s.id, blueprint)),
      ].map(async (seed) => {
        const head = (await edits.read(seed.id)) ?? initialEditorHead(seed);
        return {
          id: seed.id,
          title:
            head.published?.content.title ??
            (includeDrafts ? (head.draft?.content.title ?? '') : ''),
          published: !!head.published,
          hasDraft: includeDrafts && !!head.draft,
          path: head.published ? seed.path : null,
          studyPath: head.published?.content.study ? seed.studyPath : null,
        };
      }),
    );
    const result = {
      version: state.version,
      assignments: state.assignments,
      sermons: catalog.filter((s) => includeDrafts || s.published),
      fridays: upcomingFridays(now()),
      today: berlinDate(now()),
      canUndo: !!state.previous,
      previous: state.previous,
    };
    return result;
  }
  return {
    resolve,
    inspect,
    async handle(method: string, action: string, input: unknown) {
      if (method === 'GET' && action === '') {
        const view = await inspect();
        return { ...view, html: renderManagement(view) };
      }
      if (
        method !== 'POST' ||
        ![
          'create',
          'preview',
          'assign',
          'move',
          'remove',
          'delivery',
          'undo',
        ].includes(action)
      )
        fail('INVALID_INPUT', 405);
      if (!input || typeof input !== 'object' || Array.isArray(input))
        fail('INVALID_INPUT', 400);
      const body = input as Record<string, unknown>;
      const { all, blueprint } = await source();
      const blank = managedSeed('new-preview', blueprint);
      if (action === 'preview') {
        if (Object.keys(body).join() !== 'content') fail('INVALID_INPUT', 400);
        const content = validateEditorContent(body.content, blank, true);
        return {
          ...renderEditorRevision(blank, {
            number: -1,
            publishedAt: '',
            content,
            sha256: editorDigest(content),
            restoredFrom: null,
          }),
          preview: true,
        };
      }
      const extra: Record<string, string[]> = {
        create: ['content', 'date'],
        assign: ['sermonId', 'date'],
        move: ['sermonId', 'date', 'fromDate'],
        remove: ['sermonId', 'date'],
        delivery: ['sermonId', 'date', 'status'],
        undo: [],
      };
      if (
        Object.keys(body).sort().join() !==
          ['version', 'operationId', ...extra[action]!].sort().join() ||
        !Number.isSafeInteger(body.version) ||
        (body.version as number) < 0 ||
        typeof body.operationId !== 'string' ||
        !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(body.operationId)
      )
        fail('INVALID_INPUT', 400);
      const id =
        action === 'create'
          ? 's-' + body.operationId
          : (body.sermonId as string);
      if (
        action !== 'undo' &&
        (typeof id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(id))
      )
        fail('INVALID_INPUT', 400);
      const date =
        action === 'undo' || (action === 'create' && body.date === null)
          ? null
          : friday(body.date);
      const from = action === 'move' ? friday(body.fromDate) : null;
      const content =
        action === 'create'
          ? validateEditorContent(body.content, blank, true)
          : null;
      const time = now(),
        at = new Date(time).toISOString(),
        commandDigest = editorDigest({ action, ...body });
      return store.transact(
        action === 'create' ? id : null,
        (saved, existing) => {
          const state = saved ?? initialManagement(all);
          const retry = state.recent.find((r) => r.id === body.operationId);
          if (retry) {
            if (retry.digest !== commandDigest) fail('SCHEDULE_CONFLICT');
            return { state, result: { ...retry.result, replay: true } };
          }
          if (state.version !== body.version) fail('SCHEDULE_CHANGED');
          state.writes = state.writes.filter((t) => t > time - 3600000);
          if (state.writes.length >= 120) fail('EDITOR_RATE_LIMIT', 429);
          if (
            action !== 'create' &&
            action !== 'undo' &&
            !all.some((s) => s.id === id && !s.testOnly) &&
            !state.created.some((s) => s.id === id)
          )
            fail('NOT_FOUND', 404);
          const before: ScheduleEvent['before'] = {},
            after: ScheduleEvent['after'] = {};
          const change = (day: string, value: Assignment | null) => {
            before[day] = state.assignments[day] ?? null;
            after[day] = value;
            if (value) state.assignments[day] = value;
            else delete state.assignments[day];
          };
          const current = date ? state.assignments[date] : undefined;
          let head: EditorHead | undefined;
          if (action === 'create') {
            if (existing || state.created.some((s) => s.id === id))
              fail('SCHEDULE_CONFLICT');
            if (state.created.length >= 100) fail('SERMON_LIMIT', 429);
            state.created.push({ id, title: content!.title, createdAt: at });
            head = {
              ...initialEditorHead(managedSeed(id, blueprint)),
              version: 1,
              draft: { content: content!, savedAt: at },
            };
          }
          if (action === 'create' || action === 'assign' || action === 'move') {
            if (date) {
              if (current) fail('SCHEDULE_CONFLICT');
              if (from) {
                const old = state.assignments[from];
                if (
                  !old ||
                  old.sermonId !== id ||
                  old.status === 'delivered' ||
                  from === date
                )
                  fail('SCHEDULE_CHANGED');
                change(from, {
                  ...old!,
                  status: 'not-delivered',
                  updatedAt: at,
                });
              }
              change(date, {
                sermonId: id,
                status: 'scheduled',
                updatedAt: at,
              });
            }
          } else if (action === 'remove' || action === 'delivery') {
            if (!current || current.sermonId !== id) fail('SCHEDULE_CHANGED');
            if (action === 'remove') change(date!, null);
            else {
              if (
                !['delivered', 'not-delivered'].includes(body.status as string)
              )
                fail('INVALID_INPUT', 400);
              if (date! > berlinDate(time)) fail('DELIVERY_IN_FUTURE');
              change(date!, {
                ...current!,
                status: body.status as Delivery,
                updatedAt: at,
              });
            }
          } else if (action === 'undo') {
            if (!state.previous) fail('NO_SCHEDULE_HISTORY');
            for (const [day, value] of Object.entries(state.previous!.before))
              change(day, value);
          }
          if (Object.keys(state.assignments).length > 512)
            fail('SCHEDULE_LIMIT', 429);
          state.version++;
          state.writes.push(time);
          const event: ScheduleEvent = {
            version: state.version,
            action,
            at,
            before,
            after,
          };
          // Creation is retained; undo affects dates only, never deletes content.
          if (Object.keys(after).length) state.previous = event;
          const result = {
            version: state.version,
            ...(action === 'create' ? { id } : {}),
          };
          state.recent = [
            ...state.recent,
            { id: body.operationId as string, digest: commandDigest, result },
          ].slice(-100);
          return {
            state,
            ...(head ? { head } : {}),
            event,
            result: { ...result, replay: false },
          };
        },
      );
    },
  };
}
export type ManagementView = Awaited<
  ReturnType<ReturnType<typeof createSermonManagement>['inspect']>
>;
const base = '/nur-und-huda/';
export function renderManagement(view: ManagementView) {
  const e = escapeEditor,
    find = (id: string) => view.sermons.find((s) => s.id === id);
  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat('ar', {
      timeZone: 'Europe/Berlin',
      dateStyle: 'full',
    }).format(new Date(date + 'T12:00:00Z'));
  const buttons = (id: string, date = '') =>
    `<div class="sermon-actions"><a class="button button-outline" href="${base}sermon-editor.html?id=${e(id)}">تعديل</a><button type="button" class="button button-outline" data-schedule-id="${e(id)}" data-schedule-from="${e(date)}">تغيير الموعد</button></div>`;
  const title = (id: string) => {
    const s = find(id);
    return s?.path
      ? `<a href="${base}${e(s.path)}">${e(s.title)}</a>`
      : e(s?.title || 'خطبة غير منشورة');
  };
  const slot = (date: string, a?: Assignment) =>
    `<li><time datetime="${date}">${dateLabel(date)}</time>${a ? `<p>${title(a.sermonId)}</p><span class="status">${a.status === 'delivered' ? 'تم إلقاؤها' : a.status === 'not-delivered' ? 'لم تُلقَ / مؤجلة' : 'مجدولة — الإلقاء غير مؤكد'}</span>${buttons(a.sermonId, date)}${date <= view.today ? `<div class="sermon-actions"><button class="button button-outline" data-delivery="delivered" data-date="${date}" data-id="${e(a.sermonId)}">تم إلقاء الخطبة</button><button class="button button-outline" data-delivery="not-delivered" data-date="${date}" data-id="${e(a.sermonId)}">لم تُلقَ الخطبة</button></div>` : ''}` : '<p>لم تُحدد خطبة</p>'}</li>`;
  const future = [
    ...new Set([
      ...view.fridays.slice(1),
      ...Object.keys(view.assignments).filter((d) => d > view.fridays[0]!),
    ]),
  ].sort();
  const next = view.fridays[0]!,
    current = view.assignments[next];
  return `<section class="reading-panel light-surface" aria-labelledby="next-sermon-title"><h2 id="next-sermon-title">الجمعة القادمة</h2><ul class="sermon-schedule">${slot(next, current)}</ul></section>
<section class="reading-panel light-surface" id="schedule"><h2>برنامج الخطب</h2><p class="small">المواعيد بتوقيت برلين. النشر مستقل عن الإلقاء؛ تأكيد الإلقاء يدوي.</p><ol class="sermon-schedule">${future
    .map((d) => slot(d, view.assignments[d]))
    .join('')}</ol></section>
<section class="reading-panel light-surface"><h2>خطب بانتظار الموعد</h2><ul class="sermon-schedule">${
    view.sermons
      .filter(
        (s) =>
          !Object.entries(view.assignments).some(
            ([d, a]) =>
              a.sermonId === s.id &&
              a.status === 'scheduled' &&
              d >= view.today,
          ),
      )
      .map(
        (s) =>
          `<li>${title(s.id)} <span class="status">${s.published ? 'منشورة' : 'مسودة — غير منشورة'}${s.hasDraft && s.published ? ' · توجد مسودة تعديل' : ''}</span>${buttons(s.id)}${s.path ? `<a href="${base}${e(s.path)}#imam">وضع الإمام</a>` : ''}</li>`,
      )
      .join('') || '<li>لا توجد خطب بانتظار الموعد.</li>'
  }</ul></section>
<section class="reading-panel light-surface"><h2>سجل المواعيد والإلقاء</h2><ul class="sermon-schedule">${
    Object.entries(view.assignments)
      .filter(([d, a]) => d < view.today || a.status !== 'scheduled')
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([d, a]) => slot(d, a))
      .join('') || '<li>لا توجد سجلات إلقاء مؤكدة.</li>'
  }</ul></section>
<section class="reading-panel light-surface" id="archive"><h2>الخطب المنشورة</h2><ul>${view.sermons
    .filter((s) => s.published)
    .map(
      (s) =>
        `<li>${title(s.id)}${s.studyPath ? ` · <a href="${base}${e(s.studyPath)}">اقرأ الموضوع كاملاً</a>` : ''}</li>`,
    )
    .join('')}</ul></section>`;
}
