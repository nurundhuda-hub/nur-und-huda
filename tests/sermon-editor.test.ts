// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createSermonEditor,
  applyEditorRevision,
  initialEditorHead,
  validateEditorContent,
  renderEditorRevision,
  type EditorSeed,
  type EditorHead,
  type EditorStore,
  type EditorRevision,
} from '../backend/functions/src/sermon-editor';
const seed: EditorSeed = {
  id: 'synthetic',
  title: 'اختبار تقني',
  path: 'sermons/synthetic/r1.html',
  studyPath: 'studies/synthetic/r1.html',
  downloadPath: 'downloads/sermons/synthetic/r1.html',
  originalRevision: 'r1',
  publishedAt: '2026-11-13T00:00:00Z',
  content: {
    title: 'اختبار تقني',
    first: 'نَصٌّ تجريبي\n\nUnicode café e\u0301',
    second: 'ليس خطبة',
    study: 'دراسة اختبار',
  },
  originals: {
    first: '<p>الأصل الأول</p>',
    second: '<p>الأصل الثاني</p>',
    study: '<section>الأصل</section>',
  },
  templates: {
    article:
      '<h1><!--EDITOR_TITLE--></h1><!--EDITOR_METADATA--><!--EDITOR_FIRST--><!--EDITOR_SECOND-->',
    reader:
      '<h2 id="reader-title"><!--EDITOR_TITLE--></h2><!--EDITOR_FIRST--><!--EDITOR_SECOND-->',
    study: '<h1>دراسة</h1><!--EDITOR_STUDY-->',
  },
};
function setup() {
  let head: EditorHead | null = null;
  const archive = new Map<number, EditorRevision>();
  let queue: Promise<unknown> = Promise.resolve();
  let now = Date.parse('2026-11-13T10:00:00Z');
  const store: EditorStore = {
    read: async () => structuredClone(head),
    transact: (_id, work) => {
      const result = queue.then(() => {
        const next = work(structuredClone(head));
        head = next.head;
        next.archive?.forEach((r) => {
          if (!archive.has(r.number)) archive.set(r.number, structuredClone(r));
        });
        return next.result;
      });
      queue = result.catch(() => {});
      return result;
    },
  };
  const api = createSermonEditor(
    store,
    async () => [seed],
    () => now,
  );
  const mutate = (
    action: string,
    version: number,
    content = {
      ...seed.content,
      first: 'تَجْرِبَةٌ\n\n<svg onload=alert(1)> & "العربية"\n',
    },
  ) =>
    api.handle('POST', seed.id, action, {
      version,
      operationId: randomUUID(),
      ...(action === 'restore' ? {} : { content }),
    });
  return {
    api,
    store,
    archive,
    mutate,
    advance: () => {
      now += 3600001;
    },
  };
}
describe('shared-session sermon editor state machine', () => {
  it('does not create or alter the published record when opening, previewing or saving a draft', async () => {
    const s = setup();
    const initial = await s.api.published(seed.id);
    const content = {
      ...seed.content,
      title: 'مسودة غير منشورة',
      first: '\nنَصٌّ e\u0301  \n',
    };
    expect(await s.store.read(seed.id)).toBeNull();
    await s.api.handle('POST', seed.id, 'preview', { content });
    expect(await s.store.read(seed.id)).toBeNull();
    await s.mutate('draft', 0, content);
    expect(
      ((await s.api.handle('GET', seed.id, '', null)) as any).draft.content,
    ).toEqual(content);
    expect(await s.api.published(seed.id)).toEqual(initial);
    expect(s.archive.size).toBe(0);
  });
  it('publishes exact Unicode, preserves immutable original and restores as a new version', async () => {
    const s = setup();
    await s.mutate('publish', 0);
    const edited = await s.api.published(seed.id);
    expect(edited.revision.number).toBe(1);
    expect(edited.revision.content.first).toContain('تَجْرِبَةٌ\n\n<svg');
    expect(s.archive.get(0)?.content).toEqual(seed.content);
    expect(s.archive.get(1)).toEqual(edited.revision);
    await s.mutate('restore', 1);
    const restored = await s.api.published(seed.id);
    expect(restored.revision.content).toEqual(seed.content);
    expect(restored.revision.number).toBe(2);
    expect(restored.revision.restoredFrom).toBe(0);
    expect(s.archive.get(1)).toEqual(edited.revision);
    expect(s.archive.size).toBe(3);
  });
  it('rejects concurrent draft/publish/restore edits and preserves the winning change', async () => {
    const s = setup();
    const results = await Promise.allSettled([
      s.mutate('draft', 0),
      s.mutate('publish', 0),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    await expect(s.mutate('publish', 0)).rejects.toThrow('EDITOR_CONFLICT');
    await s.mutate('publish', 1);
    await expect(s.mutate('restore', 1)).rejects.toThrow('EDITOR_CONFLICT');
  });
  it('makes retries idempotent and rejects operation-id reuse for different text', async () => {
    const s = setup(),
      operationId = randomUUID();
    const body = {
      version: 0,
      operationId,
      content: { ...seed.content, title: 'جديد' },
    };
    await s.api.handle('POST', seed.id, 'publish', body);
    expect(await s.api.handle('POST', seed.id, 'publish', body)).toEqual({
      version: 1,
      replay: true,
    });
    expect(s.archive.size).toBe(2);
    await expect(
      s.api.handle('POST', seed.id, 'publish', {
        ...body,
        content: seed.content,
      }),
    ).rejects.toThrow('EDITOR_CONFLICT');
    await expect(s.mutate('publish', 1, body.content)).rejects.toThrow(
      'EDITOR_NO_CHANGE',
    );
  });
  it('enforces limits, known IDs, complete fields and unpublished study exclusion', async () => {
    const s = setup();
    await expect(s.api.handle('GET', 'missing', '', null)).rejects.toThrow(
      'NOT_FOUND',
    );
    for (const content of [
      { ...seed.content, first: '' },
      { ...seed.content, title: 'x'.repeat(241) },
      { ...seed.content, first: '\u0000' },
      { ...seed.content, first: '\ud800' },
      { ...seed.content, study: null },
      { ...seed.content, injected: true },
    ]) {
      expect(() => validateEditorContent(content, seed)).toThrow(
        'INVALID_INPUT',
      );
    }
    expect(() =>
      validateEditorContent(seed.content, {
        ...seed,
        content: { ...seed.content, study: null },
      }),
    ).toThrow('INVALID_INPUT');
    expect(() =>
      validateEditorContent(
        {
          ...seed.content,
          first: 'ع'.repeat(40000),
          second: 'ع'.repeat(40000),
          study: 'ع'.repeat(100000),
        },
        seed,
      ),
    ).toThrow('INVALID_INPUT');
    await expect(s.mutate('restore', 0)).rejects.toThrow('EDITOR_NO_PREVIOUS');
    for (let v = 0; v < 120; v++) await s.mutate('draft', v);
    await expect(s.mutate('draft', 120)).rejects.toThrow('EDITOR_RATE_LIMIT');
    s.advance();
    await s.mutate('draft', 120);
  });
  it('escapes edited HTML without rewriting Unicode and serves only published content', async () => {
    const s = setup();
    await s.mutate('publish', 0);
    const { revision } = await s.api.published(seed.id);
    const html = renderEditorRevision(seed, revision);
    expect(html.article).toContain('&lt;svg onload=alert(1)&gt;');
    expect(html.article).not.toContain('<svg');
    expect(html.reader).toContain('تَجْرِبَةٌ');
    const page =
      '<title>old</title><article class="reading-panel sermon-article">original</article>';
    expect(
      applyEditorRevision(
        page,
        seed,
        initialEditorHead(seed).published,
        'sermon',
      ),
    ).toBe(page);
    const published = applyEditorRevision(page, seed, revision, 'sermon');
    expect(published).toContain('تَجْرِبَةٌ');
    await s.mutate('draft', 1, {
      ...seed.content,
      title: 'NEVER_SERVE_THIS_DRAFT',
    });
    expect(
      applyEditorRevision(
        page,
        seed,
        (await s.api.published(seed.id)).revision,
        'sermon',
      ),
    ).not.toContain('NEVER_SERVE_THIS_DRAFT');
  });
});
