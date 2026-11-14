// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createSermonManagement,
  friday,
  upcomingFridays,
  renderManagement,
  type ManagementState,
  type ManagementStore,
  type ScheduleEvent,
} from '../backend/functions/src/sermon-management';
import {
  createSermonEditor,
  type EditorSeed,
  type EditorHead,
  type EditorStore,
  type EditorRevision,
} from '../backend/functions/src/sermon-editor';
const content = {
  title: 'اختبار تقني',
  first: 'نَصٌّ أول\n\n<em>e\u0301</em>',
  second: 'نَصٌّ ثانٍ',
  study: null,
};
const seed: EditorSeed = {
  id: 'original',
  title: content.title,
  path: 'sermons/original/r1.html',
  studyPath: null,
  downloadPath: 'downloads/sermons/original/r1.html',
  originalRevision: 'r1',
  publishedAt: '2026-11-13T07:00:00Z',
  friday: '2026-11-13',
  content,
  templates: {
    article:
      '<h1><!--EDITOR_TITLE--></h1><!--EDITOR_FIRST--><!--EDITOR_SECOND-->',
    reader: '<!--EDITOR_FIRST--><!--EDITOR_SECOND-->',
    study: '<!--EDITOR_STUDY-->',
  },
  originals: {
    first: '<p>original</p>',
    second: '<p>original2</p>',
    study: null,
  },
};
const blueprint = { ...seed, id: 'editor-check', testOnly: true };
function setup() {
  let state: ManagementState | null = null,
    queue: Promise<unknown> = Promise.resolve();
  const heads = new Map<string, EditorHead>(),
    revisions = new Map<string, EditorRevision>(),
    events = new Map<number, ScheduleEvent>();
  const run = <T>(work: () => T) => {
    const p = queue.then(work);
    queue = p.catch(() => {});
    return p;
  };
  const edits: EditorStore = {
    read: async (id) => structuredClone(heads.get(id) ?? null),
    transact: (id, work) =>
      run(() => {
        const next = work(structuredClone(heads.get(id) ?? null));
        for (const revision of next.archive ?? []) {
          const key = id + '/' + revision.number;
          const old = revisions.get(key);
          if (old) expect(old).toEqual(revision);
          else revisions.set(key, structuredClone(revision));
        }
        heads.set(id, structuredClone(next.head));
        return next.result;
      }),
  };
  const store: ManagementStore = {
    read: async () => structuredClone(state),
    transact: (id, work) =>
      run(() => {
        const next = work(
          structuredClone(state),
          structuredClone(id ? (heads.get(id) ?? null) : null),
        );
        if (next.head && id) {
          expect(heads.has(id)).toBe(false);
          heads.set(id, structuredClone(next.head));
        }
        if (next.event) {
          expect(events.has(next.event.version)).toBe(false);
          events.set(next.event.version, structuredClone(next.event));
        }
        state = structuredClone(next.state);
        return next.result;
      }),
  };
  const seeds = async () => [seed, blueprint],
    clock = () => Date.parse('2026-11-14T12:00:00Z');
  const management = createSermonManagement(store, edits, seeds, clock),
    editor = createSermonEditor(edits, seeds, clock, management.resolve);
  const change = async (action: string, body: Record<string, unknown>) =>
    management.handle('POST', action, {
      version: (await management.inspect()).version,
      operationId: randomUUID(),
      ...body,
    }) as Promise<any>;
  const create = async (date: string | null = null) =>
    change('create', { content, date });
  return {
    management,
    editor,
    edits,
    store,
    heads,
    revisions,
    events,
    change,
    create,
  };
}
describe('private sermon management without publication or delivery inference', () => {
  it('creates an undated draft, reopens exact Unicode, previews without writes and publishes explicitly', async () => {
    const s = setup(),
      created = await s.create(),
      id = created.id;
    expect(
      (await s.management.inspect(false)).sermons.some((x) => x.id === id),
    ).toBe(false);
    await expect(s.editor.published(id)).rejects.toThrow('NOT_FOUND');
    const draft: any = await s.editor.handle('GET', id, '', null);
    expect(draft.published).toBeNull();
    expect(draft.draft.content).toEqual(content);
    const before = structuredClone(s.heads);
    const preview: any = await s.editor.handle('POST', id, 'preview', {
      content,
    });
    expect(preview.article).toContain('&lt;em&gt;');
    expect(s.heads).toEqual(before);
    await s.editor.handle('POST', id, 'publish', {
      version: 1,
      operationId: randomUUID(),
      content,
    });
    expect((await s.editor.published(id)).revision.content).toEqual(content);
    expect(
      (await s.management.inspect(false)).sermons.find((x) => x.id === id)
        ?.published,
    ).toBe(true);
    expect(Object.keys((await s.management.inspect()).assignments)).toEqual([
      '2026-11-13',
    ]);
  });
  it('allows unfinished drafts and optional study without publishing them', async () => {
    const s = setup(),
      c = { ...content, first: '', second: '', study: null };
    const created = await s.change('create', { content: c, date: null });
    await expect(
      s.editor.handle('POST', created.id, 'publish', {
        content: c,
        version: 1,
        operationId: randomUUID(),
      }),
    ).rejects.toThrow('INVALID_INPUT');
    const next = { ...content, study: 'مادة اختبار\n\nنصٌّ' };
    await s.editor.handle('POST', created.id, 'draft', {
      content: next,
      version: 1,
      operationId: randomUUID(),
    });
    expect(
      ((await s.editor.handle('GET', created.id, '', null)) as any).draft
        .content,
    ).toEqual(next);
    await expect(s.editor.published(created.id)).rejects.toThrow('NOT_FOUND');
  });
  it('moves November 13 to 20 without changing published content, revisions, sources or URL', async () => {
    const s = setup();
    await s.editor.handle('POST', 'original', 'publish', {
      content: { ...content, title: 'نسخة معدّلة من الموقع' },
      version: 0,
      operationId: randomUUID(),
    });
    const before = await s.editor.published('original'),
      heads = structuredClone(s.heads),
      revisions = structuredClone(s.revisions);
    await s.change('move', {
      sermonId: 'original',
      fromDate: '2026-11-13',
      date: '2026-11-20',
    });
    const after = await s.management.inspect();
    expect(after.assignments['2026-11-13']?.status).toBe('not-delivered');
    expect(after.assignments['2026-11-20']?.status).toBe('scheduled');
    expect(await s.editor.published('original')).toEqual(before);
    expect(s.heads).toEqual(heads);
    expect(s.revisions).toEqual(revisions);
    expect(after.sermons[0]?.path).toBe(seed.path);
    expect(s.events.get(1)?.before['2026-11-13']?.status).toBe('scheduled');
  });
  it('refuses a November 20 conflict atomically and never alters the conflicting sermon', async () => {
    const s = setup();
    await s.create('2026-11-20');
    const before = await s.store.read(),
      heads = structuredClone(s.heads);
    await expect(
      s.change('move', {
        sermonId: 'original',
        fromDate: '2026-11-13',
        date: '2026-11-20',
      }),
    ).rejects.toThrow('SCHEDULE_CONFLICT');
    expect(await s.store.read()).toEqual(before);
    expect(s.heads).toEqual(heads);
  });
  it('requires explicit delivery and supports not-delivered, reuse and date removal', async () => {
    const s = setup();
    expect(
      (await s.management.inspect()).assignments['2026-11-13']?.status,
    ).toBe('scheduled');
    await s.change('delivery', {
      sermonId: 'original',
      date: '2026-11-13',
      status: 'delivered',
    });
    await s.change('assign', { sermonId: 'original', date: '2026-11-20' });
    const view = await s.management.inspect();
    expect(view.assignments['2026-11-13']?.status).toBe('delivered');
    expect(view.assignments['2026-11-20']?.status).toBe('scheduled');
    await expect(
      s.change('delivery', {
        sermonId: 'original',
        date: '2026-11-20',
        status: 'delivered',
      }),
    ).rejects.toThrow('DELIVERY_IN_FUTURE');
    await s.change('delivery', {
      sermonId: 'original',
      date: '2026-11-13',
      status: 'not-delivered',
    });
    await s.change('remove', { sermonId: 'original', date: '2026-11-20' });
    expect(
      (await s.management.inspect()).assignments['2026-11-20'],
    ).toBeUndefined();
    expect(s.heads.size).toBe(0);
  });
  it('serializes concurrent reservations and replays operation IDs without duplication', async () => {
    const s = setup(),
      op = {
        version: 0,
        operationId: randomUUID(),
        content,
        date: '2026-11-20',
      };
    const outcomes = await Promise.allSettled([
      s.management.handle('POST', 'create', op),
      s.management.handle('POST', 'create', {
        ...op,
        operationId: randomUUID(),
      }),
    ]);
    expect(outcomes.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(s.heads.size).toBe(1);
    const replay: any = await s.management.handle('POST', 'create', op);
    expect(replay.replay).toBe(true);
    expect(s.events.size).toBe(1);
    await expect(
      s.management.handle('POST', 'create', { ...op, date: null }),
    ).rejects.toThrow('SCHEDULE_CONFLICT');
  });
  it('detects concurrent scheduling and content editing separately and retains recoverable history', async () => {
    const s = setup();
    await s.change('move', {
      sermonId: 'original',
      fromDate: '2026-11-13',
      date: '2026-11-20',
    });
    await s.editor.handle('POST', 'original', 'draft', {
      version: 0,
      operationId: randomUUID(),
      content: { ...content, title: 'مسودة خاصة' },
    });
    await s.change('undo', {});
    expect(
      (await s.management.inspect()).assignments['2026-11-20'],
    ).toBeUndefined();
    expect(
      (await s.management.inspect()).assignments['2026-11-13']?.status,
    ).toBe('scheduled');
    expect(s.events.size).toBe(2);
    expect(
      ((await s.editor.handle('GET', 'original', '', null)) as any).draft
        .content.title,
    ).toBe('مسودة خاصة');
    await expect(
      s.management.handle('POST', 'assign', {
        version: 1,
        operationId: randomUUID(),
        sermonId: 'original',
        date: '2026-11-27',
      }),
    ).rejects.toThrow('SCHEDULE_CHANGED');
  });
  it('validates dates and Berlin day boundaries across DST', () => {
    for (const bad of [
      '2026-11-14',
      '2026-02-30',
      '2026-11-20T00:00:00Z',
      '2026-1-2',
      '<script>',
    ])
      expect(() => friday(bad)).toThrow('FRIDAY_REQUIRED');
    expect(friday('2026-11-20')).toBe('2026-11-20');
    expect(upcomingFridays(Date.parse('2026-11-12T23:30:00Z'))[0]).toBe(
      '2026-11-13',
    );
    expect(upcomingFridays(Date.parse('2026-11-13T23:30:00Z'))[0]).toBe(
      '2026-11-20',
    );
    expect(upcomingFridays(Date.parse('2026-03-27T22:30:00Z'))[0]).toBe(
      '2026-03-27',
    );
    expect(upcomingFridays(Date.parse('2026-10-30T23:30:00Z'))[0]).toBe(
      '2026-11-06',
    );
  });
  it('escapes titles and does not leak draft text through the normal calendar', async () => {
    const s = setup();
    await s.change('create', {
      content: { ...content, title: 'PRIVATE_DRAFT <img>' },
      date: '2026-11-20',
    });
    const normal = renderManagement(await s.management.inspect(false));
    expect(normal).not.toContain('PRIVATE_DRAFT');
    expect(normal).not.toContain(content.first);
    const edit = renderManagement(await s.management.inspect());
    expect(edit).toContain('PRIVATE_DRAFT &lt;img&gt;');
    expect(edit).not.toContain('<img>');
  });
  it('enforces bounded request data and rejects unknown sermons', async () => {
    const s = setup();
    await expect(
      s.change('assign', { sermonId: 'missing', date: '2026-11-20' }),
    ).rejects.toThrow('NOT_FOUND');
    await expect(
      s.change('create', { content, date: null, extra: true }),
    ).rejects.toThrow('INVALID_INPUT');
    await expect(
      s.management.handle('POST', 'create', {
        version: 0,
        operationId: 'bad',
        content,
        date: null,
      }),
    ).rejects.toThrow('INVALID_INPUT');
    expect(s.events.size).toBe(0);
  });
});
