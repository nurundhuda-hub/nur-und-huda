import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { describe, expect, it } from 'vitest';
import { educationalSeries } from '../src/content/educational-series';
import type { SermonCatalog } from '../src/lib/sermons/model';
import {
  createPrivateSermonDraft,
  sourceDigest,
  splitSuppliedSermon,
  type DraftIntakeReview,
} from '../src/lib/sermons/drafts';
import { selectPublicCatalog } from '../src/lib/sermons/publication';
import { assertPrivateSermonAbsent } from '../scripts/sermon-privacy.mjs';

const marker = 'SERMON_TEST_ONLY_NOT_RELIGIOUS_CONTENT';
// Deliberately no real sermon text, scripture or hadith in this fixture.
const raw = `# SYNTHETIC TITLE\n\n### الخطبة الأولى\n\n${marker} تَجْرِبَةٌ  **format**\n\n${marker} ${'software-only text '.repeat(8)}\n\n---\n\n### الخطبة الثانية\n\n${marker} ثَانِيَةٌ\n`;
const now = '2030-01-02T00:00:00Z';
function fixture(source = raw): DraftIntakeReview {
  const span = splitSuppliedSermon(source)[0];
  return {
    sourceSha256: sourceDigest(Buffer.from(source)),
    checkedAt: '2030-01-01T00:00:00Z',
    series: { id: 'ma-la-yasa', topicId: 'introduction' },
    revision: 'r1',
    references: [
      {
        id: 'synthetic',
        kind: 'book',
        locator: marker,
        url: 'https://example.invalid/test',
        finding: 'attribution-only',
        note: marker,
      },
    ],
    sections: [
      {
        heading: marker,
        note: marker,
        excerpts: [{ ...span, citations: ['synthetic'] }],
      },
      { heading: 'UNRESOLVED TEST SECTION', note: marker, excerpts: [] },
    ],
    blockers: [marker],
  };
}
const create = (source = raw, review = fixture(source)) =>
  createPrivateSermonDraft(Buffer.from(source), review, educationalSeries, now);

describe('private undated sermon intake', () => {
  it.each([raw, raw.replaceAll('\n', '\r\n'), '\uFEFF' + raw])(
    'preserves UTF-8 bytes, diacritics, formatting and both source slices (%#)',
    (source) => {
      const draft = create(source);
      expect(Buffer.from(draft.source.rawText)).toEqual(Buffer.from(source));
      expect(draft.source.sha256).toBe(sourceDigest(Buffer.from(source)));
      expect(draft.source.byteLength).toBe(Buffer.byteLength(source));
      draft.source.partSpans.forEach((span, i) => {
        expect(draft.sermon.parts[i]![0]!.text).toBe(
          source.slice(span.start, span.end),
        );
      });
      expect(draft.study.sections[0]!.blocks[0]!.text).toBe(
        draft.sermon.parts[0][0]!.text,
      );
      expect(draft.study.sections[1]!.blocks).toEqual([]);
      expect(draft.sermon.friday).toBeNull();
      expect(draft.sermon.duration).toBeNull();
      for (const record of [draft.sermon, draft.study]) {
        expect(record.approval).toEqual({ status: 'draft' });
        expect(record.publishAt).toBeNull();
        expect(record.purpose).toBe('private-review');
        expect(record.rights.status).toBe('pending');
        expect(record.series).toEqual({
          id: 'ma-la-yasa',
          topicId: 'introduction',
        });
        expect(record.references[0]).not.toHaveProperty('verifiedBy');
      }
      expect(draft.sermon.study).toEqual({
        id: draft.study.id,
        revision: draft.study.revision,
      });
    },
  );
  it('rejects changed source, invalid UTF-8 and ambiguous/missing part boundaries', () => {
    expect(() => create(raw + 'changed', fixture())).toThrow(/SHA-256/);
    expect(() =>
      createPrivateSermonDraft(
        new Uint8Array([0xff]),
        fixture(),
        educationalSeries,
        now,
      ),
    ).toThrow();
    for (const bad of [
      raw.replace('### الخطبة الثانية', 'MISSING'),
      raw + '\n### الخطبة الأولى\n',
      raw.replace('---', 'MISSING'),
      raw.slice(0, raw.indexOf('### الخطبة الثانية')) + '### الخطبة الثانية\n',
    ])
      expect(() => splitSuppliedSermon(bad)).toThrow();
  });
  it('rejects unknown references, source spans, series bindings, research dates and approval inputs', () => {
    for (const mutate of [
      (r: DraftIntakeReview) => {
        r.sections[0]!.excerpts[0]!.start = 0;
      },
      (r: DraftIntakeReview) => {
        r.sections[0]!.excerpts[0]!.end = raw.length + 1;
      },
      (r: DraftIntakeReview) => {
        r.sections[0]!.excerpts[0]!.citations = ['missing'];
      },
      (r: DraftIntakeReview) => {
        r.references[0]!.url = 'javascript:alert(1)';
      },
      (r: DraftIntakeReview) => {
        r.series.topicId = 'missing';
      },
      (r: DraftIntakeReview) => {
        r.checkedAt = '2031-01-01T00:00:00Z';
      },
      (r: DraftIntakeReview) => {
        Object.assign(r, { friday: '2030-01-04' });
      },
      (r: DraftIntakeReview) => {
        Object.assign(r, { approval: { status: 'approved' } });
      },
    ]) {
      const review = fixture();
      mutate(review);
      expect(() => create(raw, review)).toThrow();
    }
  });
  it('cannot enter the public catalog even if someone changes the approval label', () => {
    const draft = create();
    for (const status of ['draft', 'approved']) {
      const sermon = { ...draft.sermon, approval: { status } };
      const study = { ...draft.study, approval: { status } };
      const catalog = {
        series: [educationalSeries],
        sermons: [sermon],
        studies: [study],
        announcements: [],
        history: [],
      };
      expect(() =>
        selectPublicCatalog(catalog as unknown as SermonCatalog, now),
      ).toThrow(/identity|fixture/);
    }
  });
  it('detects leaked private paragraphs without modifying the supplied source', () => {
    expect(() =>
      assertPrivateSermonAbsent('public outline only', raw),
    ).not.toThrow();
    expect(() => assertPrivateSermonAbsent(raw, raw)).toThrow(/Private sermon/);
    expect(() =>
      assertPrivateSermonAbsent(
        raw.replaceAll('**', '').replaceAll('\n', ' '),
        raw,
      ),
    ).toThrow(/Private sermon/);
    expect(() =>
      assertPrivateSermonAbsent('public outline only', null),
    ).not.toThrow();
  });
});

it('CLI saves private drafts, refuses overwrites/symlinks/public outputs, and leaves production unchanged', () => {
  mkdirSync('.sermon-review', { recursive: true });
  const prefix = `.sermon-review/test-${randomUUID()}`;
  const input = `${prefix}.txt`,
    review = `${prefix}-review.json`,
    output = `${prefix}-bundle.json`,
    link = `${prefix}-link.txt`;
  const before = readFileSync('src/content/sermons.ts');
  const reviewValue = fixture();
  reviewValue.checkedAt = '2020-01-01T00:00:00Z';
  writeFileSync(input, raw);
  writeFileSync(review, JSON.stringify(reviewValue));
  const args = [
    '--experimental-strip-types',
    'scripts/sermon-import.ts',
    '--input',
    input,
    '--review',
    review,
    '--out',
    output,
  ];
  try {
    const log = execFileSync(process.execPath, args, { encoding: 'utf8' });
    expect(log).not.toContain(marker);
    const bytes = readFileSync(output);
    const result = JSON.parse(bytes.toString());
    expect(result.sermon.friday).toBeNull();
    expect(result.source.rawText).toBe(raw);
    expect(spawnSync(process.execPath, args).status).not.toBe(0);
    expect(readFileSync(output)).toEqual(bytes);
    for (const blocked of [
      'public/draft.json',
      'src/content/sermons.ts',
      '.sermon-review/../public/draft.json',
    ]) {
      const rejected = spawnSync(
        process.execPath,
        [...args.slice(0, -1), blocked],
        { encoding: 'utf8' },
      );
      expect(rejected.status).not.toBe(0);
      expect(rejected.stderr).toContain('no public output');
    }
    symlinkSync(input.split('/').at(-1)!, link);
    const symlinkArgs = [...args];
    symlinkArgs[3] = link;
    const rejected = spawnSync(process.execPath, symlinkArgs, {
      encoding: 'utf8',
    });
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toContain('not symlinks');
    expect(readFileSync(input, 'utf8')).toBe(raw);
    expect(readFileSync('src/content/sermons.ts')).toEqual(before);
  } finally {
    for (const file of [input, review, output, link])
      rmSync(file, { force: true });
  }
});
