import { afterEach, describe, expect, it } from 'vitest';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
  mkdirSync,
  statSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { educationalSeries } from '../src/content/educational-series';
import {
  createPrivateSermonDraft,
  sourceDigest,
} from '../src/lib/sermons/drafts';
import {
  createPrivateStudyRevision,
  studyBlocks,
  STUDY_PREVIEW_PATH,
  STUDY_SOURCE_FILE,
  STUDY_REVISION_FILE,
} from '../src/lib/sermons/private-study';
import { renderLocalStudy } from '../src/lib/sermons/dev-study-preview';
import {
  renderLocalSermon,
  PREVIEW_PATH,
} from '../src/lib/sermons/dev-preview';
import { loadLocalStudy } from '../scripts/local-study';
import { localReviewStatus } from '../scripts/local-sermon-review-status';
import { initPreviewControls } from '../src/dev/preview-controls';

const marker = 'SERMON_TEST_ONLY_NOT_RELIGIOUS_CONTENT';
const raw = `# تَجْرِبَةٌ ${marker}\n## ${marker} subtitle\n\n**${marker}** first\nsecond  \n\n### ${marker} section\n\n1. ${marker} one\n2. ${marker} two\n\n- ${marker} reference\n\n---\n\n<img src=x onerror=alert(1)> & ${marker}\n`;
const sermonSource = Buffer.from(
  `# ${marker}\n\n### الخطبة الأولى\n\n${marker} ONE\n\n---\n\n### الخطبة الثانية\n\n${marker} TWO\n`,
);
const topic = educationalSeries.topics[0]!;
const bundle = createPrivateSermonDraft(
  sermonSource,
  {
    sourceSha256: sourceDigest(sermonSource),
    checkedAt: '2026-01-01T00:00:00Z',
    series: { id: educationalSeries.id, topicId: topic.id },
    revision: 'r1',
    references: [
      {
        id: 'synthetic',
        kind: 'book',
        locator: marker,
        url: 'https://example.invalid',
        finding: 'attribution-only',
        note: marker,
      },
    ],
    sections: [{ heading: marker, note: marker, excerpts: [] }],
    blockers: ['SYNTHETIC UNVERIFIED EVIDENCE'],
  },
  educationalSeries,
  '2026-01-02T00:00:00Z',
);
const make = (source = Buffer.from(raw)) =>
  createPrivateStudyRevision(
    source,
    sermonSource,
    bundle,
    '2026-11-01T00:00:00Z',
    true,
  );
afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('supplied private study import and rendering', () => {
  it('CLI requires editorial acknowledgement, writes privately once and never edits public content', () => {
    const cwd = mkdtempSync(path.join(tmpdir(), 'nur-study-cli-'));
    const root = path.join(cwd, '.sermon-review');
    mkdirSync(root);
    const publicBefore = readFileSync('src/content/sermons.ts');
    const cli = path.resolve('scripts/study-import.ts');
    try {
      writeFileSync(path.join(root, STUDY_SOURCE_FILE), raw);
      writeFileSync(path.join(root, 'first-sermon-approved.txt'), sermonSource);
      writeFileSync(
        path.join(root, 'first-sermon-r1.bundle.json'),
        JSON.stringify(bundle),
      );
      const run = (args: string[]) =>
        spawnSync(
          process.execPath,
          ['--experimental-strip-types', cli, ...args],
          { cwd, encoding: 'utf8' },
        );
      expect(run([]).status).not.toBe(0);
      const first = run(['--editorial-approval']);
      expect(first.status).toBe(0);
      expect(first.stdout).not.toContain(marker);
      const output = path.join(root, STUDY_REVISION_FILE),
        original = readFileSync(output);
      expect(JSON.parse(original.toString()).source.rawMarkdown).toBe(raw);
      expect(statSync(output).mode & 0o777).toBe(0o600);
      expect(run(['--editorial-approval']).status).not.toBe(0);
      expect(readFileSync(output)).toEqual(original);
      expect(readFileSync('src/content/sermons.ts')).toEqual(publicBefore);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
  it.each([raw, raw.replaceAll('\n', '\r\n')])(
    'retains the exact source, spans, structure and private revision link (%#)',
    (source) => {
      const bytes = Buffer.from(source),
        study = make(bytes);
      expect(Buffer.from(study.source.rawMarkdown)).toEqual(bytes);
      expect(study.source.sha256).toBe(sourceDigest(bytes));
      expect(
        study.blocks
          .map((block) => source.slice(block.start, block.end))
          .join(''),
      ).toBe(source);
      expect(study).toMatchObject({
        revision: 'r2',
        supersedes: 'r1',
        approval: { status: 'draft' },
        publishAt: null,
        evidence: { references: 'unverified', rights: 'pending' },
        sermon: {
          id: topic.sermonId,
          revision: 'r1',
          sourceSha256: sourceDigest(sermonSource),
        },
      });
      const doc = new DOMParser().parseFromString(
        renderLocalStudy(study),
        'text/html',
      );
      const root = doc.querySelector('article [data-private-study-body]')!;
      const displayed = [...root.querySelectorAll('h1,h2,h3,p,li')].map(
        (node) => node.textContent,
      );
      const expected = study.blocks
        .filter((block) => !['blank', 'rule'].includes(block.kind))
        .map((block) =>
          block.text
            .replace(/\*\*([^\n]+?)\*\*/g, '$1')
            .replaceAll('\r\n', '\n'),
        );
      expect(displayed).toEqual(expected);
      expect(root.querySelectorAll('ol li')).toHaveLength(2);
      expect(root.querySelectorAll('ul li')).toHaveLength(1);
      expect(root.querySelectorAll('hr')).toHaveLength(1);
      expect(doc.querySelector('img,iframe,form,[download]')).toBeNull();
      expect(doc.querySelector('[data-study-status]')!.textContent).toContain(
        'موافقة تحريرية',
      );
      expect(
        doc.querySelector<HTMLAnchorElement>('nav a')!.getAttribute('href'),
      ).toBe(PREVIEW_PATH);
    },
  );
  it('requires explicit editorial acknowledgement and exact linked sermon intake', () => {
    expect(() =>
      createPrivateStudyRevision(
        Buffer.from(raw),
        sermonSource,
        bundle,
        '2026-11-01T00:00:00Z',
        false,
      ),
    ).toThrow(/Explicit/);
    expect(() =>
      createPrivateStudyRevision(
        Buffer.from(raw),
        Buffer.from('changed'),
        bundle,
        '2026-11-01T00:00:00Z',
        true,
      ),
    ).toThrow();
    expect(() => make(Buffer.from([0xff]))).toThrow();
    expect(() => studyBlocks('no title')).toThrow();
    expect(() => studyBlocks('# title\n# duplicate')).toThrow();
  });
  it('links only a present imported study and initializes the same responsive reader controls', () => {
    const review = {
      state: 'blocked' as const,
      revision: 'r1',
      missing: ['SYNTHETIC UNVERIFIED EVIDENCE'],
    };
    const sermon = new DOMParser().parseFromString(
      renderLocalSermon(sermonSource, {
        ...review,
        study: { state: 'present', revision: 'r2' },
      }),
      'text/html',
    );
    expect(sermon.querySelector('.study-link a')!.textContent).toBe(
      'اقرأ الموضوع كاملاً',
    );
    expect(sermon.querySelector('.study-link a')!.getAttribute('href')).toBe(
      STUDY_PREVIEW_PATH,
    );
    for (const state of ['missing', 'invalid'] as const)
      expect(
        renderLocalSermon(sermonSource, { ...review, study: { state } }),
      ).not.toContain(`href="${STUDY_PREVIEW_PATH}"`);
    document.body.innerHTML = new DOMParser().parseFromString(
      renderLocalStudy(make()),
      'text/html',
    ).body.innerHTML;
    const original = document.querySelector(
      'article [data-private-study-body]',
    )!.textContent;
    const cleanup = initPreviewControls(document);
    try {
      document
        .querySelector<HTMLButtonElement>('[data-preview-step="2"]')!
        .click();
      expect(
        document
          .querySelector<HTMLElement>('[data-preview-article]')!
          .style.getPropertyValue('--reader-font'),
      ).toBe('2.125rem');
      expect(
        document.querySelector('article [data-private-study-body]')!
          .textContent,
      ).toBe(original);
      expect(document.querySelector('[data-preview-approval]')).toBeNull();
      expect(
        document
          .querySelector('[data-preview-toolbar] a')!
          .getAttribute('href'),
      ).toBe(PREVIEW_PATH);
    } finally {
      cleanup();
    }
  });
  it('rejects missing, changed and symlinked local artifacts without treating presence as verified evidence', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'nur-study-'));
    const write = (name: string, value: unknown) =>
      writeFileSync(
        path.join(root, name),
        typeof value === 'string' ? value : JSON.stringify(value),
      );
    try {
      expect((await loadLocalStudy(root, sermonSource)).state).toBe('missing');
      write(STUDY_SOURCE_FILE, raw);
      write(STUDY_REVISION_FILE, make());
      write('first-sermon-r1.bundle.json', bundle);
      expect((await loadLocalStudy(root, sermonSource)).state).toBe('present');
      expect(await localReviewStatus(sermonSource, root)).toMatchObject({
        state: 'blocked',
        missing: ['SYNTHETIC UNVERIFIED EVIDENCE'],
      });
      write(STUDY_SOURCE_FILE, raw + 'changed');
      expect((await loadLocalStudy(root, sermonSource)).state).toBe('invalid');
      write(STUDY_SOURCE_FILE, raw);
      const changed = make();
      changed.approval.status = 'approved' as 'draft';
      write(STUDY_REVISION_FILE, changed);
      expect((await loadLocalStudy(root, sermonSource)).state).toBe('invalid');
      rmSync(path.join(root, STUDY_REVISION_FILE));
      symlinkSync(
        path.join(root, 'first-sermon-r1.bundle.json'),
        path.join(root, STUDY_REVISION_FILE),
      );
      expect((await loadLocalStudy(root, sermonSource)).state).toBe('invalid');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('keeps the study preview and its marker out of production', () => {
    for (const page of [
      'index',
      'sermons',
      'together',
      'quran',
      'library',
      'legal',
    ]) {
      const html = readFileSync(`dist/${page}.html`, 'utf8');
      expect(html).not.toContain(STUDY_PREVIEW_PATH);
      expect(html).not.toContain('data-private-study-body');
      expect(html).not.toContain('STUDY_PRIVATE_EDITORIAL_ONLY');
    }
  });
});
