import { describe, expect, it } from 'vitest';
import { educationalSeries } from '../src/content/educational-series';
import {
  createPrivateSermonDraft,
  sourceDigest,
  type DraftIntakeReview,
} from '../src/lib/sermons/drafts';
import {
  reviewStandalone,
  approveStandalone,
  authorizeStandalone,
  appendStandalone,
} from '../src/lib/sermons/private-standalone';
import {
  selectPublicCatalog,
  releasePaths,
  validateCatalog,
} from '../src/lib/sermons/publication';
import { sermonArticle, studyArticle } from '../src/lib/sermons/render';
import { readerMarkup } from '../src/lib/sermons/reader-markup';
import { renderOfflineSermon } from '../src/lib/sermons/offline';
import { sermonFixture } from './fixtures/sermon-content';
import type {
  PrivateStandaloneSermon,
  SermonCatalog,
} from '../src/lib/sermons/model';
const now = '2030-01-01T00:00:00Z';
function fixture() {
  const series = structuredClone(educationalSeries);
  const source = Buffer.from(
    'SYNTHETIC ONLY — not religious content\nالخطبة الأولى\nFIRST أَ test <script>unsafe</script>\n— SYNTHETIC sitting direction —\n\nالخطبة الثانية\nSECOND test\nREFERENCES remain verbatim\n',
  );
  const refs = (['quran', 'hadith', 'book'] as const).map((kind) => ({
    id: kind,
    kind,
    locator: 'SYNTHETIC ONLY',
    url: 'https://example.invalid/reference',
    finding: 'attribution-only' as const,
    note: 'SYNTHETIC source observation',
  }));
  const intake: DraftIntakeReview = {
    sourceSha256: sourceDigest(source),
    checkedAt: now,
    series: { id: series.id, topicId: 'testimony' },
    revision: 'r1',
    references: refs,
    sections: [{ heading: 'WITHHELD', note: 'SYNTHETIC', excerpts: [] }],
    blockers: ['Not approved at intake'],
  };
  const bundle = createPrivateSermonDraft(source, intake, series, now);
  const base = selectPublicCatalog(sermonFixture(), now, {
    allowTestFixtures: true,
  });
  base.privateAvailability = {
    authorizedAt: now,
    origin: 'https://nour-und-huda.web.app',
  };
  const candidate: PrivateStandaloneSermon = {
    ...sermonFixture().sermons[0]!,
    purpose: 'production',
    id: bundle.sermon.id,
    title: bundle.sermon.title,
    series: bundle.sermon.series,
    editedAt: now,
    publishAt: now,
    approval: { status: 'draft' },
    parts: bundle.sermon.parts,
    introduction: bundle.sermon.introduction,
    references: refs.map((r) => ({
      ...r,
      label: 'SYNTHETIC',
      verifiedBy: 'SYNTHETIC',
      verifiedAt: now,
    })),
    study: null,
    studyStatus: 'withheld-by-owner',
    duration: {
      basis: 'owner-approved-estimate',
      humanTimed: false,
      minutes: 10,
      approvedBy: 'SYNTHETIC',
      recordedAt: now,
      note: 'Not timed',
    },
  };
  const evidence = {
    source: 'SYNTHETIC',
    references: 'SYNTHETIC',
    rights: 'SYNTHETIC',
    context: 'SYNTHETIC',
    reportSha256: 'a'.repeat(64),
    unresolved: [],
  };
  const review = () =>
    reviewStandalone(source, bundle, candidate, series, evidence, base, now);
  const reviewed = review();
  const approved = approveStandalone(
    reviewed,
    reviewed.sha256,
    'SYNTHETIC',
    'SYNTHETIC content-only instruction',
    now,
  );
  const authorization = authorizeStandalone(
    approved,
    approved.sha256,
    'SYNTHETIC',
    'SYNTHETIC private publication instruction',
    now,
    'withhold-until-separately-approved',
  );
  return {
    source,
    bundle,
    base,
    candidate,
    evidence,
    review,
    reviewed,
    approved,
    authorization,
  };
}
describe('explicit private sermon-only authorization', () => {
  it('preserves prior records, both exact parts, preamble and source diacritics; exposes no study', () => {
    const f = fixture(),
      before = structuredClone(f.base);
    const release = appendStandalone(
      f.base,
      f.reviewed,
      f.approved,
      f.authorization,
      true,
    );
    expect(f.base).toEqual(before);
    expect(release.published[0]).toEqual(before.published[0]);
    const item = release.published[1]!;
    expect(item.study).toBeNull();
    expect(item.sermon.parts).toEqual(f.bundle.sermon.parts);
    const paths = releasePaths(release);
    expect(paths.pages).toContain('sermons/meaning-of-testimony/r1.html');
    expect(
      paths.pages.some((p) => p.includes('meaning-of-testimony-study')),
    ).toBe(false);
    const article = sermonArticle(
      release,
      item.sermon.id,
      'r1',
      '/nur-und-huda/',
    );
    expect(article).toContain('الشرح الموسّع غير منشور');
    expect(article).not.toContain(
      'href="/nur-und-huda/studies/meaning-of-testimony-study',
    );
    expect(article).toContain('&lt;script&gt;unsafe&lt;/script&gt;');
    expect(readerMarkup(item)).toContain('SECOND test');
    expect(readerMarkup(item)).toContain('FIRST أَ');
    expect(renderOfflineSermon(release, item.sermon.id, 'r1')).toContain(
      'REFERENCES remain verbatim',
    );
    expect(() =>
      studyArticle(release, 'meaning-of-testimony-study', 'r1', '/'),
    ).toThrow();
  });
  it('rejects edited source, parts, preamble and unresolved evidence', () => {
    for (const edit of [
      (f: ReturnType<typeof fixture>) => {
        f.source[0] = 88;
      },
      (f: ReturnType<typeof fixture>) => {
        f.candidate.parts = structuredClone(f.candidate.parts);
        f.candidate.parts[1][0]!.text += ' changed';
      },
      (f: ReturnType<typeof fixture>) => {
        f.candidate.introduction = [];
      },
      (f: ReturnType<typeof fixture>) => {
        f.evidence.unresolved.push('missing evidence' as never);
      },
      (f: ReturnType<typeof fixture>) => {
        f.candidate.rights.status = 'pending';
      },
      (f: ReturnType<typeof fixture>) => {
        f.candidate.references = [];
      },
    ]) {
      const f = fixture();
      edit(f);
      expect(f.review).toThrow();
    }
  });
  it('requires separate explicit content and publication confirmations', () => {
    const f = fixture();
    expect(() =>
      approveStandalone(
        f.reviewed,
        '0'.repeat(64),
        'SYNTHETIC',
        'approve',
        now,
      ),
    ).toThrow();
    expect(() =>
      approveStandalone(f.reviewed, f.reviewed.sha256, '', 'approve', now),
    ).toThrow();
    expect(() =>
      authorizeStandalone(
        f.approved,
        f.approved.sha256,
        'SYNTHETIC',
        '',
        now,
        'withhold-until-separately-approved',
      ),
    ).toThrow();
    expect(() =>
      appendStandalone(
        f.base,
        f.reviewed,
        f.approved,
        { ...f.authorization, sha256: '0'.repeat(64) },
        true,
      ),
    ).toThrow();
  });
  it('keeps anonymous/public pair gates unchanged and enforces release clock', () => {
    const f = fixture();
    expect(() =>
      appendStandalone(f.base, f.reviewed, f.approved, f.authorization, false),
    ).toThrow();
    expect(() =>
      appendStandalone(
        { ...f.base, asOf: '2029-12-31T23:59:59Z' },
        f.reviewed,
        f.approved,
        f.authorization,
        true,
      ),
    ).toThrow();
    const release = appendStandalone(
      f.base,
      f.reviewed,
      f.approved,
      f.authorization,
      true,
    );
    expect(() =>
      releasePaths({ ...release, privateAvailability: undefined }),
    ).toThrow();
    const invalid = {
      ...sermonFixture(),
      sermons: [f.approved.sermon],
      studies: [],
    } as unknown as SermonCatalog;
    expect(() => validateCatalog(invalid)).toThrow();
    expect(() =>
      appendStandalone(release, f.reviewed, f.approved, f.authorization, true),
    ).toThrow();
  });
});
