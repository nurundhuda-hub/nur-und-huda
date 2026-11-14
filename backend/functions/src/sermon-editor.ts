import { createHash } from 'node:crypto';
import { ApiError } from './core.js';

export interface EditorContent {
  title: string;
  first: string;
  second: string;
  study: string | null;
}
export interface EditorSeed {
  id: string;
  title: string;
  path: string;
  studyPath: string | null;
  downloadPath: string;
  originalRevision: string;
  publishedAt: string;
  content: EditorContent;
  templates: { article: string; reader: string; study: string | null };
  originals: { first: string; second: string; study: string | null };
  testOnly?: boolean;
  managed?: boolean;
  friday?: string;
}
export interface EditorRevision {
  number: number;
  publishedAt: string;
  content: EditorContent;
  sha256: string;
  restoredFrom: number | null;
}
export interface EditorHead {
  version: number;
  published: EditorRevision | null;
  previous: EditorRevision | null;
  draft: { content: EditorContent; savedAt: string } | null;
  recent: { id: string; digest: string; version: number }[];
  writes: number[];
}
export interface EditorStore {
  read(id: string): Promise<EditorHead | null>;
  transact<T>(
    id: string,
    work: (head: EditorHead | null) => {
      head: EditorHead;
      archive?: EditorRevision[];
      result: T;
    },
  ): Promise<T>;
}
export const editorDigest = (value: unknown) =>
  createHash('sha256')
    .update(
      JSON.stringify(value, (_key, v) =>
        v && typeof v === 'object' && !Array.isArray(v)
          ? Object.fromEntries(
              Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
            )
          : v,
      ),
    )
    .digest('hex');
export function initialEditorHead(seed: EditorSeed): EditorHead {
  return {
    version: 0,
    published: seed.managed
      ? null
      : {
          number: 0,
          publishedAt: seed.publishedAt,
          content: seed.content,
          sha256: editorDigest(seed.content),
          restoredFrom: null,
        },
    previous: null,
    draft: null,
    recent: [],
    writes: [],
  };
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApiError(400, 'INVALID_INPUT');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, expected: string[]) {
  if (Object.keys(value).sort().join(',') !== expected.sort().join(','))
    throw new ApiError(400, 'INVALID_INPUT');
}
export function validateEditorContent(
  input: unknown,
  seed: EditorSeed,
  incomplete = false,
): EditorContent {
  const value = object(input);
  keys(value, ['title', 'first', 'second', 'study']);
  const text = (key: string, max: number) => {
    const v = value[key];
    // Validate only. Never trim, normalize Unicode, rewrite punctuation or interpret HTML.
    if (
      typeof v !== 'string' ||
      (!v.trim() && !(incomplete && key !== 'title')) ||
      v.length > max ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(v) ||
      Buffer.from(v, 'utf8').toString('utf8') !== v
    )
      throw new ApiError(400, 'INVALID_INPUT');
    return v;
  };
  if (!seed.managed && (seed.content.study === null) !== (value.study === null))
    throw new ApiError(400, 'INVALID_INPUT');
  const content = {
    title: text('title', 240),
    first: text('first', 40000),
    second: text('second', 40000),
    study: value.study === null ? null : text('study', 100000),
  };
  if (Buffer.byteLength(JSON.stringify(content), 'utf8') > 220000)
    throw new ApiError(413, 'INVALID_INPUT');
  return content;
}
export function createSermonEditor(
  store: EditorStore,
  seeds: () => Promise<EditorSeed[]>,
  now = Date.now,
  findManaged?: (id: string) => Promise<EditorSeed | null>,
) {
  async function seed(id: string) {
    const found =
      (await seeds()).find((s) => s.id === id) ?? (await findManaged?.(id));
    if (!found) throw new ApiError(404, 'NOT_FOUND');
    return found;
  }
  return {
    seeds,
    async published(id: string) {
      const s = await seed(id);
      const revision = ((await store.read(id)) ?? initialEditorHead(s))
        .published;
      if (!revision) throw new ApiError(404, 'NOT_FOUND');
      return { seed: s, revision };
    },
    async handle(method: string, id: string, action: string, input: unknown) {
      const s = await seed(id);
      if (method === 'GET' && action === '') {
        const h = (await store.read(id)) ?? initialEditorHead(s);
        return {
          id,
          title: s.title,
          path: s.path,
          studyPath: s.studyPath,
          originalRevision: s.originalRevision,
          version: h.version,
          published: h.published,
          previous: h.previous,
          draft: h.draft,
          testOnly: !!s.testOnly,
          managed: !!s.managed,
        };
      }
      if (
        method !== 'POST' ||
        !['draft', 'publish', 'restore', 'preview'].includes(action)
      )
        throw new ApiError(405, 'INVALID_INPUT');
      const body = object(input);
      if (action === 'preview') {
        keys(body, ['content']);
        const content = validateEditorContent(body.content, s, true);
        const revision = {
          number: -1,
          publishedAt: '',
          content,
          sha256: editorDigest(content),
          restoredFrom: null,
        };
        return { ...renderEditorRevision(s, revision), preview: true };
      }
      keys(
        body,
        action === 'restore'
          ? ['version', 'operationId']
          : ['version', 'operationId', 'content'],
      );
      if (
        !Number.isSafeInteger(body.version) ||
        (body.version as number) < 0 ||
        typeof body.operationId !== 'string' ||
        !/^[a-f0-9-]{36}$/.test(body.operationId)
      )
        throw new ApiError(400, 'INVALID_INPUT');
      const content =
        action === 'restore'
          ? null
          : validateEditorContent(body.content, s, action === 'draft');
      const commandDigest = editorDigest({ action, ...body });
      const time = now();
      return store.transact(id, (existing) => {
        const h = existing ?? initialEditorHead(s);
        const retry = h.recent.find((r) => r.id === body.operationId);
        if (retry) {
          if (retry.digest !== commandDigest)
            throw new ApiError(409, 'EDITOR_CONFLICT');
          return { head: h, result: { version: retry.version, replay: true } };
        }
        if (h.version !== body.version)
          throw new ApiError(409, 'EDITOR_CONFLICT');
        h.writes = h.writes.filter((t) => t > time - 3600000);
        if (h.writes.length >= 120)
          throw new ApiError(429, 'EDITOR_RATE_LIMIT');
        h.writes.push(time);
        let archive: EditorRevision[] | undefined;
        if (action === 'draft')
          h.draft = {
            content: content!,
            savedAt: new Date(time).toISOString(),
          };
        else {
          if (action === 'restore' && !h.previous)
            throw new ApiError(409, 'EDITOR_NO_PREVIOUS');
          const target = action === 'restore' ? h.previous!.content : content!;
          if (editorDigest(target) === h.published?.sha256)
            throw new ApiError(409, 'EDITOR_NO_CHANGE');
          const next = {
            number: (h.published?.number ?? 0) + 1,
            publishedAt: new Date(time).toISOString(),
            content: target,
            sha256: editorDigest(target),
            restoredFrom: action === 'restore' ? h.previous!.number : null,
          };
          archive = h.published ? [h.published, next] : [next];
          h.previous = h.published;
          h.published = next;
          h.draft = null;
        }
        h.version++;
        h.recent = [
          ...h.recent,
          {
            id: body.operationId as string,
            digest: commandDigest,
            version: h.version,
          },
        ].slice(-50);
        return {
          head: h,
          ...(archive ? { archive } : {}),
          result: { version: h.version, replay: false },
        };
      });
    },
  };
}
export const escapeEditor = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
export function renderEditorRevision(
  seed: EditorSeed,
  revision: EditorRevision,
) {
  const c = revision.content;
  const label =
    revision.number < 0 ? 'معاينة — غير منشورة' : `تعديل ${revision.number}`;
  const metadata = `<p class="status">${label}</p>${revision.publishedAt ? `<p>تاريخ نشر التعديل: <time dir="ltr" datetime="${revision.publishedAt}">${revision.publishedAt}</time></p><p class="small">نشره أحد أعضاء المجموعة عبر الموقع الخاص. تبقى النسخة الأصلية محفوظة.</p>` : ''}`;
  const paragraph = (s: string) =>
    `<p class="content-block">${escapeEditor(s)}</p>`;
  const replacements: Record<string, string> = {
    TITLE: escapeEditor(c.title),
    FIRST:
      c.first === seed.content.first
        ? seed.originals.first
        : paragraph(c.first),
    SECOND:
      c.second === seed.content.second
        ? seed.originals.second
        : paragraph(c.second),
    STUDY:
      c.study === seed.content.study
        ? (seed.originals.study ?? '')
        : paragraph(c.study ?? ''),
    METADATA: metadata,
    REVISION: escapeEditor(label),
  };
  const fill = (s: string, reader = false) =>
    s.replace(
      /<!--EDITOR_(TITLE|FIRST|SECOND|STUDY|METADATA|REVISION)-->/g,
      (_, k: string) =>
        reader && (k === 'FIRST' || k === 'SECOND')
          ? replacements[k]!.replaceAll(
              '#sermon-reference-',
              '#reader-reference-',
            )
          : replacements[k]!,
    );
  return {
    article:
      seed.managed && c.study === null
        ? fill(seed.templates.article).replace(
            /<p class="study-link">[\s\S]*?<\/p>/,
            '',
          )
        : fill(seed.templates.article),
    reader: fill(seed.templates.reader, true),
    study:
      seed.templates.study && (!seed.managed || c.study !== null)
        ? fill(seed.templates.study)
        : null,
  };
}

/** Only trusted build-produced templates are HTML. Edited text is always escaped. */
export function applyEditorRevision(
  html: string,
  seed: EditorSeed,
  revision: EditorRevision,
  kind: 'sermon' | 'study' | 'download',
): string {
  if (revision.number === 0) return html;
  const rendered = renderEditorRevision(seed, revision);
  const replaceArticle = (source: string, article: string) =>
    source.replace(
      /(<article\b[^>]*class="[^"]*sermon-article[^"]*"[^>]*>)[\s\S]*?<\/article>/,
      (_, start: string) => start + article + '</article>',
    );
  if (kind === 'download') {
    return html
      .replace(
        /(<main id="main-content">)[\s\S]*?<\/main>/,
        (_, start: string) =>
          start +
          '<p class="offline-note">نسخة محفوظة؛ لا تتحدث تلقائياً.</p>' +
          rendered.article.replaceAll(
            'href="/nur-und-huda/',
            'href="https://nour-und-huda.web.app/nur-und-huda/',
          ) +
          '</main>',
      )
      .replace(
        /<title>[\s\S]*?<\/title>/,
        () =>
          `<title>${escapeEditor(revision.content.title)} — تعديل ${revision.number}</title>`,
      );
  }
  let out = replaceArticle(
    html,
    kind === 'study' ? rendered.study! : rendered.article,
  );
  if (kind === 'sermon')
    out = out.replace(
      /<div id="imam" data-sermon-reader>[\s\S]*?<\/dialog><\/div>/,
      () => rendered.reader,
    );
  if (kind === 'sermon')
    out = out.replace(
      /<title>[\s\S]*?<\/title>/,
      () => `<title>${escapeEditor(revision.content.title)} | نور وهدى</title>`,
    );
  return out;
}
