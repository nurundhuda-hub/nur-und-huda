import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  mkdtempSync,
  readdirSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { localReviewStatus } from '../scripts/local-sermon-review-status';
import { randomUUID } from 'node:crypto';
import { educationalSeries } from '../src/content/educational-series';
import { sermonFixture, SERMON_MARKER } from './fixtures/sermon-content';
import {
  createPrivateSermonDraft,
  sourceDigest,
} from '../src/lib/sermons/drafts';
import {
  CHECKS,
  reviewRevision,
  approveRevision,
  preparePublication,
  authorizePublication,
  workflowDigest,
  type ReviewChecks,
} from '../src/lib/sermons/approval-workflow';
import { validateCatalog } from '../src/lib/sermons/publication';
import type { SermonCatalog } from '../src/lib/sermons/model';
import { createPrivateStudyRevision } from '../src/lib/sermons/private-study';
import {
  prepareEditorialPair,
  studyPublicationContent,
} from '../src/lib/sermons/publication-pair';
import { selectPublicCatalog } from '../src/lib/sermons/publication';
import { sermonArticle, studyArticle } from '../src/lib/sermons/render';
import { readerMarkup } from '../src/lib/sermons/reader-markup';
import { renderOfflineSermon } from '../src/lib/sermons/offline';
import {
  CONTENT_CHECKS,
  estimateReading,
  prepareContentReview,
  confirmContentReview,
  validateCorrectedContentApproval,
  type ContentEvidence,
} from '../src/lib/sermons/content-review';
import {
  publicationSchedule,
  schedulePrivatePair,
} from '../src/lib/sermons/scheduled-release';

const baseline: SermonCatalog = {
  series: [educationalSeries],
  sermons: [],
  studies: [],
  announcements: [],
  history: [],
};
function fixture() {
  const data = sermonFixture(),
    topic = educationalSeries.topics[0]!;
  const sermon = data.sermons[0]!,
    study = data.studies[0]!;
  sermon.id = topic.sermonId;
  study.id = topic.studyId;
  sermon.study = { id: study.id, revision: study.revision };
  for (const record of [sermon, study]) {
    record.series = { id: educationalSeries.id, topicId: topic.id };
    record.purpose = 'production'; // Test-only in-memory public shape; every body retains the synthetic marker.
    record.title = topic.sermonTitle;
    record.approval = { status: 'draft' };
    record.editedAt = '2019-12-26T00:00:00Z';
    record.publishAt = '2099-01-01T00:00:00Z';
    record.references.forEach((ref) => {
      ref.verifiedAt = '2019-12-26T00:00:00Z';
    });
  }
  sermon.duration.reviewedAt = '2019-12-27T00:00:00Z';
  const source = Buffer.from(
    `# ${SERMON_MARKER}\n\n### الخطبة الأولى\n\n${sermon.parts[0].map((b) => b.text).join('\n\n')}\n\n---\n\n### الخطبة الثانية\n\n${sermon.parts[1].map((b) => b.text).join('\n\n')}\n`,
  );
  const bundle = createPrivateSermonDraft(
    source,
    {
      sourceSha256: sourceDigest(source),
      checkedAt: '2019-12-28T00:00:00Z',
      series: sermon.series!,
      revision: 'r1',
      references: [
        {
          id: 'synthetic',
          kind: 'book',
          locator: SERMON_MARKER,
          url: 'https://example.invalid',
          finding: 'attribution-only',
          note: SERMON_MARKER,
        },
      ],
      sections: [{ heading: SERMON_MARKER, note: SERMON_MARKER, excerpts: [] }],
      blockers: ['SYNTHETIC REVIEW BLOCKER'],
    },
    educationalSeries,
    '2020-01-01T00:00:00Z',
  );
  const checks: ReviewChecks = {
    reviewer: 'SYNTHETIC-REVIEWER',
    confirmations: Object.fromEntries(
      CHECKS.map((key) => [key, { confirmed: true, evidence: SERMON_MARKER }]),
    ) as ReviewChecks['confirmations'],
    resolutions: [
      { blocker: bundle.review.blockers[0]!, resolution: SERMON_MARKER },
    ],
  };
  return { source, bundle, candidate: { sermon, study }, checks };
}
const reviewed = () => {
  const f = fixture();
  return reviewRevision(
    f.source,
    f.bundle,
    f.candidate,
    f.checks,
    baseline,
    educationalSeries,
    '2020-01-02T00:00:00Z',
  );
};

function r2Fixture() {
  const f = fixture();
  const source = Buffer.from(
    `# ${SERMON_MARKER}\n## SYNTHETIC EXPLANATION\n\n${SERMON_MARKER} paragraph\n\n**﴿${SERMON_MARKER} NOT SCRIPTURE﴾**\n\n**«${SERMON_MARKER} NOT HADITH»**\n\n1. ${SERMON_MARKER} LIST\n\n---\n`,
  );
  const revision = createPrivateStudyRevision(
    source,
    f.source,
    f.bundle,
    '2020-01-01T00:00:00Z',
    true,
  );
  const mapped = studyPublicationContent(revision);
  f.candidate.study = { ...f.candidate.study, ...mapped, revision: 'r2' };
  f.candidate.study.sections.forEach((section) =>
    section.blocks.forEach((block) => {
      block.citations = [
        block.kind === 'paragraph' ? 'book-test' : `${block.kind}-test`,
      ];
    }),
  );
  f.candidate.sermon.study = { id: revision.id, revision: 'r2' };
  return { ...f, studyInput: { source, revision } };
}
const reviewR2 = (f: ReturnType<typeof r2Fixture>) =>
  reviewRevision(
    f.source,
    f.bundle,
    f.candidate,
    f.checks,
    baseline,
    educationalSeries,
    '2020-01-02T00:00:00Z',
    f.studyInput,
  );

describe('content approval independent of Friday scheduling', () => {
  const setup = () => {
    const f = r2Fixture();
    const report = Buffer.from(SERMON_MARKER + ' EVIDENCE REPORT');
    const evidence: ContentEvidence = {
      sources: {
        sermonSha256: sourceDigest(f.source),
        studySha256: sourceDigest(f.studyInput.source),
      },
      reportSha256: sourceDigest(report),
      findings: Object.fromEntries(
        CONTENT_CHECKS.map((key) => [
          key,
          {
            status: 'checked',
            basis: SERMON_MARKER,
            locations: ['SYNTHETIC:1'],
          },
        ]),
      ) as ContentEvidence['findings'],
    };
    const prepare = () =>
      prepareContentReview(
        f.source,
        f.bundle,
        f.studyInput.source,
        f.studyInput.revision,
        evidence,
        report,
        '2020-01-02T00:00:00Z',
        true,
      );
    return { f, report, evidence, prepare };
  };
  it('permits explicit content-only confirmation without dates but cannot enter the release workflow', () => {
    const s = setup(),
      review = s.prepare();
    expect(review.state).toBe('awaiting-owner-content-confirmation');
    expect(review.formalContentApproval).toBeNull();
    expect(review.durationEstimate.humanTimed).toBe(false);
    expect(review.durationEstimate.pausesIncluded).toBe(false);
    expect(review.durationEstimate.words).toBe(0); // This fixture's body is English.
    const estimate = estimateReading(
      Buffer.from(
        '# SYNTHETIC\n### الخطبة الأولى\n\nنص تجريبي غير ديني [مرجع تجريبي]\n\n---\n\n### الخطبة الثانية\n\nنص تجريبي غير ديني\n',
      ),
    );
    expect(estimate.parts).toEqual([4, 4]);
    expect(estimate.words).toBe(8);
    expect(review.durationEstimate.scenarios[1]!.minutes).toBe(
      Math.round((review.durationEstimate.words / 100) * 100) / 100,
    );
    const confirmed = confirmContentReview(
      review,
      review.sha256,
      'SYNTHETIC-OWNER',
      SERMON_MARKER,
      '2020-01-03T00:00:00Z',
    );
    expect(confirmed).toMatchObject({
      state: 'content-approved-only',
      friday: null,
      publishAt: null,
      publicationAuthorized: false,
    });
    expect(confirmed).not.toHaveProperty('catalog');
    expect(() =>
      preparePublication(
        confirmed as unknown as Parameters<typeof preparePublication>[0],
        baseline,
        '2020-01-04T00:00:00Z',
      ),
    ).toThrow();
    expect(baseline.sermons).toEqual([]);
  });
  it('rejects missing evidence, source/report changes and unresolved findings without inventing completion', () => {
    const s = setup();
    s.evidence.findings.rights.status = 'unresolved';
    const review = s.prepare();
    expect(review.blockers).toEqual(['rights']);
    expect(() =>
      confirmContentReview(
        review,
        review.sha256,
        'SYNTHETIC',
        SERMON_MARKER,
        '2020-01-03T00:00:00Z',
      ),
    ).toThrow(/Unresolved/);
    s.evidence.findings.rights.status = 'checked';
    s.evidence.findings.quran.locations = [];
    expect(s.prepare).toThrow(/category/);
    s.evidence.findings.quran.locations = ['SYNTHETIC:1'];
    s.evidence.reportSha256 = 'changed';
    expect(s.prepare).toThrow(/exact/);
    s.evidence.reportSha256 = sourceDigest(s.report);
    s.f.studyInput.source = Buffer.from('changed');
    expect(s.prepare).toThrow();
  });
  it('resolves only the owner-confirmed evidence while retaining the old packet and separate approval gate', () => {
    const s = setup();
    s.evidence.findings.rights.status = 'unresolved';
    s.evidence.findings.context.status = 'unresolved';
    const blocked = s.prepare();
    const historical = structuredClone(blocked);
    s.evidence.findings.context = {
      status: 'checked',
      basis: 'SYNTHETIC OWNER confirms the fictional local context.',
      locations: ['SYNTHETIC OWNER CONFIRMATION:context'],
    };
    expect(s.prepare().blockers).toEqual(['rights']);
    s.evidence.findings.rights = {
      status: 'checked',
      basis:
        "SYNTHETIC OWNER confirms provenance to the owner's knowledge; no blanket license inferred.",
      locations: ['SYNTHETIC OWNER CONFIRMATION:provenance'],
    };
    const ready = s.prepare();
    expect(ready.state).toBe('awaiting-owner-content-confirmation');
    expect(ready.blockers).toEqual([]);
    expect(ready.sha256).not.toBe(blocked.sha256);
    expect(ready.evidence.findings.rights.basis).toContain(
      "to the owner's knowledge",
    );
    expect(ready).toMatchObject({
      formalContentApproval: null,
      friday: null,
      publishAt: null,
      publicationAuthorized: false,
    });
    expect(ready).not.toHaveProperty('reviewer');
    expect(ready).not.toHaveProperty('approvedAt');
    expect(ready).not.toHaveProperty('catalog');
    expect(blocked).toEqual(historical);
    for (const key of ['quran', 'hadith', 'book', 'consistency'] as const)
      expect(ready.evidence.findings[key]).toEqual(
        blocked.evidence.findings[key],
      );
    s.evidence.findings.quran.status = 'unresolved';
    expect(s.prepare().blockers).toEqual(['quran']);
    expect(baseline.sermons).toEqual([]);
  });
  it('requires the exact hash, actual reviewer attestation and chronological confirmation', () => {
    const review = setup().prepare();
    expect(() =>
      confirmContentReview(
        review,
        'wrong',
        'SYNTHETIC',
        SERMON_MARKER,
        '2020-01-03T00:00:00Z',
      ),
    ).toThrow(/hash/);
    expect(() =>
      confirmContentReview(
        review,
        review.sha256,
        '',
        SERMON_MARKER,
        '2020-01-03T00:00:00Z',
      ),
    ).toThrow(/reviewer/);
    expect(() =>
      confirmContentReview(
        review,
        review.sha256,
        'SYNTHETIC',
        '',
        '2020-01-03T00:00:00Z',
      ),
    ).toThrow(/attestation/);
    expect(() =>
      confirmContentReview(
        review,
        review.sha256,
        'SYNTHETIC',
        SERMON_MARKER,
        '2019-01-01T00:00:00Z',
      ),
    ).toThrow(/precede/);
    review.evidence.findings.context.basis += ' changed';
    expect(() =>
      confirmContentReview(
        review,
        review.sha256,
        'SYNTHETIC',
        SERMON_MARKER,
        '2020-01-03T00:00:00Z',
      ),
    ).toThrow(/hash/);
  });
  it('validates a corrected approval chain and prepares a private schedule without inventing release approval or duration', () => {
    const s = setup(),
      review = s.prepare();
    const original = confirmContentReview(
      review,
      review.sha256,
      review.sha256,
      SERMON_MARKER,
      '2020-01-03T00:00:00Z',
    );
    const bytes = Buffer.from(JSON.stringify(original));
    const { sha256: originalSeal, ...originalBody } = original;
    const body = {
      ...originalBody,
      reviewer: 'SYNTHETIC-CORRECTED-OWNER',
      correction: {
        recordVersion: 2 as const,
        kind: 'reviewer-identifier-correction' as const,
        originalApprovalFile: 'original.json',
        originalApprovalSha256: originalSeal,
        originalFileSha256: sourceDigest(bytes),
        previousReviewer: original.reviewer,
        correctedAt: '2020-01-04T00:00:00Z',
        authorization: SERMON_MARKER,
        reason: SERMON_MARKER,
      },
    };
    const approval = { ...body, sha256: workflowDigest(body) };
    expect(() =>
      validateCorrectedContentApproval(
        approval,
        approval.sha256,
        bytes,
        review,
      ),
    ).not.toThrow();
    expect(() =>
      validateCorrectedContentApproval(approval, 'wrong', bytes, review),
    ).toThrow(/seal/);
    expect(() =>
      validateCorrectedContentApproval(
        approval,
        approval.sha256,
        Buffer.concat([bytes, Buffer.from(' ')]),
        review,
      ),
    ).toThrow(/chain/);
    for (const field of ['attestation', 'approvedAt'] as const) {
      const changed = {
        ...body,
        [field]: field === 'attestation' ? 'changed' : '2020-01-03T01:00:00Z',
      };
      const resealed = { ...changed, sha256: workflowDigest(changed) };
      expect(() =>
        validateCorrectedContentApproval(
          resealed,
          resealed.sha256,
          bytes,
          review,
        ),
      ).toThrow(/changed/);
    }
    const prep = prepareEditorialPair(
      s.f.source,
      s.f.bundle,
      s.f.studyInput.source,
      s.f.studyInput.revision,
      '2020-01-05T00:00:00Z',
      true,
    );
    const scheduled = schedulePrivatePair(
      prep,
      approval,
      publicationSchedule('2030-01-04', '08:00'),
      '2020-01-05T00:00:00Z',
    );
    expect(scheduled.candidate.sermon.publishAt).toBe('2030-01-04T07:00:00Z');
    expect(scheduled.candidate.study.publishAt).toBe(
      scheduled.candidate.sermon.publishAt,
    );
    expect(scheduled.candidate.sermon.duration).toBeNull();
    expect(scheduled.candidate.sermon.approval.status).toBe('draft');
    expect(scheduled.candidate.study.approval.status).toBe('draft');
    expect(scheduled.candidate.sermon.parts).toEqual(
      prep.candidate.sermon.parts,
    );
    expect(scheduled.candidate.study.sections).toEqual(
      prep.candidate.study.sections,
    );
    expect(scheduled.publicationAuthorized).toBe(false);
    expect(scheduled.activationReady).toBe(false);
    expect(() =>
      schedulePrivatePair(
        prep,
        approval,
        { ...scheduled.schedule, publishAt: '2030-01-04T06:00:00Z' },
        '2020-01-05T00:00:00Z',
      ),
    ).toThrow(/UTC/);
    expect(() =>
      schedulePrivatePair(
        prep,
        approval,
        scheduled.schedule,
        '2030-01-04T07:00:00Z',
      ),
    ).toThrow(/future/);
    const cwd = mkdtempSync(path.join(tmpdir(), 'nur-schedule-cli-')),
      root = path.join(cwd, '.sermon-review');
    mkdirSync(root);
    const write = (name: string, value: unknown) =>
      writeFileSync(path.join(root, name), JSON.stringify(value));
    try {
      writeFileSync(path.join(root, 'first-sermon-approved.txt'), s.f.source);
      writeFileSync(
        path.join(root, 'study-001-approved.md'),
        s.f.studyInput.source,
      );
      write('first-sermon-r1.bundle.json', s.f.bundle);
      write('study-001-r2.bundle.json', s.f.studyInput.revision);
      writeFileSync(path.join(root, 'original.json'), bytes);
      write('corrected.json', approval);
      write('review.json', review);
      write('evidence.json', s.evidence);
      writeFileSync(path.join(root, 'report.md'), s.report);
      const future = new Date('2099-01-01T12:00:00Z');
      while (future.getUTCDay() !== 5)
        future.setUTCDate(future.getUTCDate() + 1);
      const args = [
        '--experimental-strip-types',
        path.resolve('scripts/sermon-schedule.ts'),
        '--approval',
        'corrected.json',
        '--original-approval',
        'original.json',
        '--confirm-approval-sha256',
        approval.sha256,
        '--review',
        'review.json',
        '--evidence',
        'evidence.json',
        '--report',
        'report.md',
        '--friday',
        future.toISOString().slice(0, 10),
        '--time',
        '08:00',
        '--out',
        'schedule.json',
      ];
      expect(
        spawnSync(process.execPath, args, { cwd, encoding: 'utf8' }).status,
      ).toBe(0);
      const result = JSON.parse(
        readFileSync(path.join(root, 'schedule.json'), 'utf8'),
      );
      expect(result.publicationAuthorized).toBe(false);
      expect(result.candidate.sermon.duration).toBeNull();
      expect(spawnSync(process.execPath, args, { cwd }).status).not.toBe(0);
      expect(
        spawnSync(process.execPath, [...args.slice(0, -1), '../public.json'], {
          cwd,
        }).status,
      ).not.toBe(0);
      expect(readdirSync(root)).not.toContain('content-approved-r1-r2.json');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
  it('keeps CLI preparation and confirmation private, immutable and bound to current sources', () => {
    const s = setup(),
      cwd = mkdtempSync(path.join(tmpdir(), 'nur-content-review-'));
    const root = path.join(cwd, '.sermon-review');
    mkdirSync(root);
    const write = (name: string, value: unknown) =>
      writeFileSync(path.join(root, name), JSON.stringify(value));
    const run = (args: string[]) =>
      spawnSync(
        process.execPath,
        [
          '--experimental-strip-types',
          path.resolve('scripts/sermon-content-review.ts'),
          ...args,
        ],
        { cwd, encoding: 'utf8' },
      );
    const common = ['--evidence', 'evidence.json', '--report', 'report.md'];
    try {
      writeFileSync(path.join(root, 'first-sermon-approved.txt'), s.f.source);
      writeFileSync(
        path.join(root, 'study-001-approved.md'),
        s.f.studyInput.source,
      );
      writeFileSync(path.join(root, 'report.md'), s.report);
      write('first-sermon-r1.bundle.json', s.f.bundle);
      write('study-001-r2.bundle.json', s.f.studyInput.revision);
      write('evidence.json', s.evidence);
      expect(
        run(['prepare', ...common, '--out', 'review.json']).status,
      ).not.toBe(0);
      const args = [
        'prepare',
        ...common,
        '--owner-editorial-approval',
        '--out',
        'review.json',
      ];
      expect(run(args).status).toBe(0);
      expect(run(args).status).not.toBe(0);
      expect(run([...args.slice(0, -1), '../public.json']).status).not.toBe(0);
      const review = JSON.parse(
        readFileSync(path.join(root, 'review.json'), 'utf8'),
      );
      const confirm = [
        'confirm',
        ...common,
        '--input',
        'review.json',
        '--confirm-sha256',
        review.sha256,
        '--reviewer',
        'SYNTHETIC-OWNER',
        '--attestation',
        SERMON_MARKER,
        '--out',
        'approved.json',
      ];
      expect(run(confirm).status).toBe(0);
      const result = JSON.parse(
        readFileSync(path.join(root, 'approved.json'), 'utf8'),
      );
      expect(result.state).toBe('content-approved-only');
      expect(result.publicationAuthorized).toBe(false);
      writeFileSync(
        path.join(root, 'study-001-approved.md'),
        'SYNTHETIC CHANGED',
      );
      expect(run([...confirm.slice(0, -1), 'stale.json']).status).not.toBe(0);
      expect(readdirSync(root)).not.toContain('stale.json');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe('exact sermon r1 and supplied study r2 publication pair', () => {
  it('creates an immutable private preparation through the CLI without approving or changing public content', () => {
    const cwd = mkdtempSync(path.join(tmpdir(), 'nur-pair-cli-'));
    const root = path.join(cwd, '.sermon-review');
    mkdirSync(root);
    const f = r2Fixture();
    const publicFile = path.resolve('src/content/sermons.ts');
    const before = readFileSync(publicFile);
    const script = path.resolve('scripts/sermon-prepare-pair.ts');
    const run = (args: string[]) =>
      spawnSync(
        process.execPath,
        ['--experimental-strip-types', script, ...args],
        { cwd, encoding: 'utf8' },
      );
    try {
      writeFileSync(path.join(root, 'first-sermon-approved.txt'), f.source);
      writeFileSync(
        path.join(root, 'first-sermon-r1.bundle.json'),
        JSON.stringify(f.bundle),
      );
      writeFileSync(
        path.join(root, 'study-001-approved.md'),
        f.studyInput.source,
      );
      writeFileSync(
        path.join(root, 'study-001-r2.bundle.json'),
        JSON.stringify(f.studyInput.revision),
      );
      expect(run([]).status).not.toBe(0);
      expect(run(['--owner-editorial-approval']).status).toBe(0);
      const output = path.join(root, 'publication-preparation-r1-r2.json');
      const bytes = readFileSync(output);
      const pair = JSON.parse(bytes.toString());
      expect(pair.state).toBe('blocked-preparation');
      expect(pair.candidate.sermon.approval.status).toBe('draft');
      expect(pair.candidate.study.approval.status).toBe('draft');
      expect(pair.candidate.sermon.friday).toBeNull();
      expect(pair.editorial.ownerApprovedAt).toBeNull();
      expect(run(['--owner-editorial-approval']).status).not.toBe(0);
      expect(readFileSync(output)).toEqual(bytes);
      writeFileSync(
        path.join(root, 'candidate.json'),
        JSON.stringify(f.candidate),
      );
      writeFileSync(path.join(root, 'checks.json'), JSON.stringify(f.checks));
      const reviewArgs = [
        '--experimental-strip-types',
        path.resolve('scripts/sermon-workflow.ts'),
        'review',
        '--source',
        '.sermon-review/first-sermon-approved.txt',
        '--bundle',
        '.sermon-review/first-sermon-r1.bundle.json',
        '--candidate',
        '.sermon-review/candidate.json',
        '--checks',
        '.sermon-review/checks.json',
        '--out',
        '.sermon-review/reviewed-r1.json',
        '--study-source',
        '.sermon-review/study-001-approved.md',
      ];
      expect(spawnSync(process.execPath, reviewArgs, { cwd }).status).not.toBe(
        0,
      );
      expect(
        spawnSync(
          process.execPath,
          [
            ...reviewArgs,
            '--study-bundle',
            '.sermon-review/study-001-r2.bundle.json',
          ],
          { cwd },
        ).status,
      ).toBe(0);
      const review = JSON.parse(
        readFileSync(path.join(root, 'reviewed-r1.json'), 'utf8'),
      );
      expect(review.candidate.sermon.study.revision).toBe('r2');
      expect(review.studyRevision.source.sha256).toBe(
        sourceDigest(f.studyInput.source),
      );
      expect(review.state).toBe('reviewed');
      expect(readFileSync(publicFile)).toEqual(before);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
  it('revalidates the current private study before the preview reports review readiness', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'nur-pair-status-'));
    const f = r2Fixture();
    const write = (name: string, value: unknown) =>
      writeFileSync(path.join(root, name), JSON.stringify(value));
    const get = () => localReviewStatus(f.source, root, '2020-01-03T00:00:00Z');
    try {
      write('first-sermon-r1.bundle.json', f.bundle);
      write('reviewed-r1.json', reviewR2(f));
      expect((await get()).state).toBe('blocked');
      write('study-001-r2.bundle.json', f.studyInput.revision);
      writeFileSync(
        path.join(root, 'study-001-approved.md'),
        f.studyInput.source,
      );
      expect((await get()).state).toBe('ready');
      writeFileSync(
        path.join(root, 'study-001-approved.md'),
        'SYNTHETIC CHANGED SOURCE',
      );
      expect((await get()).state).toBe('blocked');
      expect(readdirSync(root)).not.toContain('approved-r1.json');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('records editorial approval with exact hashes but leaves evidence, dates and formal approval unset', () => {
    const f = r2Fixture();
    const prep = prepareEditorialPair(
      f.source,
      f.bundle,
      f.studyInput.source,
      f.studyInput.revision,
      '2020-01-02T00:00:00Z',
      true,
    );
    expect(prep.editorial).toMatchObject({
      ownerApprovedAt: null,
      formalApproval: false,
    });
    expect(prep.sources).toEqual({
      sermonSha256: sourceDigest(f.source),
      studySha256: sourceDigest(f.studyInput.source),
    });
    expect(prep.candidate.sermon.study.revision).toBe('r2');
    expect(prep.candidate.sermon).toMatchObject({
      revision: 'r1',
      friday: null,
      publishAt: null,
      duration: null,
      approval: { status: 'draft' },
      references: [],
      rights: { status: 'pending' },
    });
    expect(prep.candidate.study).toMatchObject({
      revision: 'r2',
      publishAt: null,
      approval: { status: 'draft' },
      references: [],
      rights: { status: 'pending' },
    });
    expect(() =>
      prepareEditorialPair(
        f.source,
        f.bundle,
        f.studyInput.source,
        f.studyInput.revision,
        '2020-01-02T00:00:00Z',
        false,
      ),
    ).toThrow(/owner editorial/);
    expect(() =>
      validateCatalog({
        ...baseline,
        sermons: [prep.candidate.sermon],
        studies: [prep.candidate.study],
      } as unknown as SermonCatalog),
    ).toThrow();
    expect(f.bundle.study.revision).toBe('r1');
  });
  it('preserves source binding and all existing approval gates for r2', () => {
    for (const mutate of [
      (f: ReturnType<typeof r2Fixture>) => {
        f.studyInput.source = Buffer.from('changed');
      },
      (f: ReturnType<typeof r2Fixture>) => {
        f.studyInput.revision.sermon.revision = 'r2' as 'r1';
      },
      (f: ReturnType<typeof r2Fixture>) => {
        f.candidate.study.sections[0]!.blocks[0]!.text += ' changed';
      },
      (f: ReturnType<typeof r2Fixture>) => {
        f.candidate.study.sections[0]!.blocks.reverse();
      },
      (f: ReturnType<typeof r2Fixture>) => {
        f.candidate.sermon.study.revision = 'r1';
      },
      (f: ReturnType<typeof r2Fixture>) => {
        f.checks.confirmations.rights.evidence = '';
      },
    ]) {
      const f = r2Fixture();
      mutate(f);
      expect(() => reviewR2(f)).toThrow();
    }
    const f = r2Fixture();
    expect(() =>
      reviewRevision(
        f.source,
        f.bundle,
        f.candidate,
        f.checks,
        baseline,
        educationalSeries,
        '2020-01-02T00:00:00Z',
      ),
    ).toThrow(/identities/);
    for (const change of ['rights', 'citation'] as const) {
      const test = r2Fixture();
      if (change === 'rights') test.candidate.study.rights.status = 'pending';
      else
        test.candidate.study.sections[0]!.blocks.find(
          (block) => block.kind === 'quran',
        )!.citations = [];
      const review = reviewR2(test);
      expect(() =>
        approveRevision(
          review,
          review.sha256,
          baseline,
          '2020-01-03T00:00:00Z',
        ),
      ).toThrow();
    }
  });
  it('renders the approved synthetic pair through existing public, imam and offline presentation', () => {
    const f = r2Fixture(),
      review = reviewR2(f);
    const approval = approveRevision(
      review,
      review.sha256,
      baseline,
      '2020-01-03T00:00:00Z',
    );
    expect(approval.review.studyRevision!.source.sha256).toBe(
      sourceDigest(f.studyInput.source),
    );
    const release = selectPublicCatalog(
      approval.catalog,
      '2099-01-02T00:00:00Z',
    );
    const item = release.published[0]!;
    const sermon = sermonArticle(
      release,
      item.sermon.id,
      'r1',
      '/nur-und-huda/',
    );
    expect(sermon).toContain('اقرأ الموضوع كاملاً');
    expect(sermon).toContain(`/studies/${item.study.id}/r2.html`);
    expect(sermon).toContain(educationalSeries.title);
    expect(sermon).toContain('الموضوع 1');
    expect(
      studyArticle(release, item.study.id, 'r2', '/nur-und-huda/'),
    ).toContain(`/sermons/${item.sermon.id}/r1.html`);
    expect(readerMarkup(item)).toContain('data-reader-size');
    const offline = renderOfflineSermon(release, item.sermon.id, 'r1');
    expect(offline).toContain('@media print');
    expect(offline).toContain('data:font/woff2');
    expect(offline).not.toContain('STUDY_PRIVATE_EDITORIAL_ONLY');
    expect(release.schedule).toHaveLength(8);
    expect(
      preparePublication(approval, baseline, '2020-01-04T00:00:00Z').state,
    ).toBe('prepared');
  });
});

it('local preview readiness validates exact source, all gates and approval history without writing', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'nur-preview-status-'));
  const f = fixture();
  const write = (name: string, value: unknown) =>
    writeFileSync(path.join(root, name), JSON.stringify(value));
  const get = () => localReviewStatus(f.source, root, '2020-01-03T00:00:00Z');
  try {
    expect((await get()).state).toBe('blocked');
    write('first-sermon-r1.bundle.json', f.bundle);
    expect((await get()).missing).toContain('SYNTHETIC REVIEW BLOCKER');
    const review = reviewed();
    write('reviewed-r1.json', review);
    expect(await get()).toMatchObject({
      state: 'ready',
      reviewedSha256: review.sha256,
      missing: [],
    });
    expect(readdirSync(root)).toHaveLength(2);
    expect(
      (await localReviewStatus(Buffer.from('changed source'), root)).state,
    ).toBe('blocked');
    write('reviewed-r1.json', { ...review, sha256: 'changed' });
    expect((await get()).state).toBe('blocked');
    const incomplete = fixture();
    incomplete.candidate.study.sections[0]!.blocks = [];
    write(
      'reviewed-r1.json',
      reviewRevision(
        incomplete.source,
        incomplete.bundle,
        incomplete.candidate,
        incomplete.checks,
        baseline,
        educationalSeries,
        '2020-01-02T00:00:00Z',
      ),
    );
    const incompleteStatus = await get();
    expect(incompleteStatus.state).toBe('blocked');
    expect(incompleteStatus.reviewRecorded).toBe(true);
    expect(incompleteStatus.missing).not.toContain('SYNTHETIC REVIEW BLOCKER');
    write('reviewed-r1.json', review);
    const approved = approveRevision(
      review,
      review.sha256,
      baseline,
      '2020-01-03T00:00:00Z',
    );
    write('approved-r1.json', approved);
    expect((await get()).state).toBe('approved');
    write('approved-r1.json', { ...approved, sha256: 'changed' });
    expect((await get()).state).toBe('blocked');
    rmSync(path.join(root, 'approved-r1.json'));
    symlinkSync(
      path.join(root, 'reviewed-r1.json'),
      path.join(root, 'approved-r1.json'),
    );
    expect((await get()).state).toBe('blocked');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('local approval state transitions', () => {
  it('requires separate review, exact-hash approval, preparation and publication authorization', () => {
    const review = reviewed();
    expect(review.candidate.sermon.approval.status).toBe('draft');
    const approval = approveRevision(
      review,
      review.sha256,
      baseline,
      '2020-01-03T00:00:00Z',
    );
    expect(approval.catalog.sermons[0]!.approval).toMatchObject({
      status: 'approved',
      revision: 'r1',
      reviewer: 'SYNTHETIC-REVIEWER',
    });
    expect(() => validateCatalog(approval.catalog)).not.toThrow();
    const prepared = preparePublication(
      approval,
      baseline,
      '2020-01-04T00:00:00Z',
    );
    const authorization = authorizePublication(
      prepared,
      prepared.sha256,
      'SYNTHETIC-PUBLISHER',
      baseline,
      '2020-01-05T00:00:00Z',
    );
    expect(authorization.state).toBe('publication-authorized');
    expect(authorization.catalog.history).toHaveLength(2);
    expect(authorization.catalog).not.toHaveProperty('source');
    expect(authorization.catalog).not.toHaveProperty('checks');
    expect(baseline.sermons).toEqual([]);
    expect(review.candidate.sermon.approval.status).toBe('draft');
  });
  it('rejects missing confirmations, unresolved blockers, private candidate fields and rewritten source', () => {
    for (const mutate of [
      (f: ReturnType<typeof fixture>) => {
        f.checks.confirmations.references.evidence = '';
      },
      (f: ReturnType<typeof fixture>) => {
        f.checks.resolutions = [];
      },
      (f: ReturnType<typeof fixture>) => {
        f.candidate.sermon.parts[0][0]!.text += ' changed';
      },
      (f: ReturnType<typeof fixture>) => {
        f.bundle.source.rawText += 'changed';
      },
      (f: ReturnType<typeof fixture>) => {
        Object.assign(f.candidate.study, { privateNotes: 'never export' });
      },
      (f: ReturnType<typeof fixture>) => {
        f.candidate.study.revision = 'r2';
      },
    ]) {
      const f = fixture();
      mutate(f);
      expect(() =>
        reviewRevision(
          f.source,
          f.bundle,
          f.candidate,
          f.checks,
          baseline,
          educationalSeries,
          '2020-01-02T00:00:00Z',
        ),
      ).toThrow();
    }
  });
  it('retains full production reference, rights, duration, date and study gates at approval', () => {
    for (const mutate of [
      (f: ReturnType<typeof fixture>) => {
        f.candidate.study.sections[0]!.blocks = [];
      },
      (f: ReturnType<typeof fixture>) => {
        f.candidate.sermon.rights.status = 'pending';
      },
      (f: ReturnType<typeof fixture>) => {
        f.candidate.sermon.friday = '2030-01-05';
      },
      (f: ReturnType<typeof fixture>) => {
        f.candidate.sermon.duration.reviewedBy = '';
      },
      (f: ReturnType<typeof fixture>) => {
        f.candidate.study.references[0]!.verifiedBy = '';
      },
    ]) {
      const f = fixture();
      mutate(f);
      const review = reviewRevision(
        f.source,
        f.bundle,
        f.candidate,
        f.checks,
        baseline,
        educationalSeries,
        '2020-01-02T00:00:00Z',
      );
      expect(() =>
        approveRevision(
          review,
          review.sha256,
          baseline,
          '2020-01-03T00:00:00Z',
        ),
      ).toThrow();
    }
  });
  it('rejects wrong confirmation hashes, changed approvals, changed baselines and reversed chronology', () => {
    const review = reviewed();
    expect(() =>
      approveRevision(review, 'wrong', baseline, '2020-01-03T00:00:00Z'),
    ).toThrow(/exact reviewed/);
    expect(() =>
      approveRevision(review, review.sha256, baseline, '2019-01-03T00:00:00Z'),
    ).toThrow(/chronology/);
    const changed = structuredClone(review);
    changed.candidate.sermon.title += ' changed';
    expect(() =>
      approveRevision(
        changed,
        changed.sha256,
        baseline,
        '2020-01-03T00:00:00Z',
      ),
    ).toThrow(/changed/);
    const approval = approveRevision(
      review,
      review.sha256,
      baseline,
      '2020-01-03T00:00:00Z',
    );
    const modified = structuredClone(approval);
    modified.catalog.sermons[0]!.approval.reviewer = 'OTHER';
    expect(() =>
      preparePublication(modified, baseline, '2020-01-04T00:00:00Z'),
    ).toThrow();
    const prepared = preparePublication(
      approval,
      baseline,
      '2020-01-04T00:00:00Z',
    );
    expect(() =>
      authorizePublication(
        prepared,
        'wrong',
        'owner',
        baseline,
        '2020-01-05T00:00:00Z',
      ),
    ).toThrow(/Separate/);
    expect(() =>
      authorizePublication(
        prepared,
        prepared.sha256,
        '',
        baseline,
        '2020-01-05T00:00:00Z',
      ),
    ).toThrow();
    expect(() =>
      preparePublication(
        approval,
        { ...baseline, series: [] },
        '2020-01-04T00:00:00Z',
      ),
    ).toThrow(/baseline/);
  });
});

it('CLI writes immutable private transitions only and never activates public source', () => {
  mkdirSync('.sermon-review', { recursive: true });
  const prefix = `.sermon-review/workflow-test-${randomUUID()}`;
  const files: string[] = [];
  const write = (name: string, value: unknown) => {
    const file = `${prefix}-${name}`;
    files.push(file);
    writeFileSync(
      file,
      typeof value === 'string' ? value : JSON.stringify(value),
    );
    return file;
  };
  const f = fixture(),
    before = readFileSync('src/content/sermons.ts');
  const source = write('source.txt', f.source.toString()),
    bundle = write('bundle.json', f.bundle),
    candidate = write('candidate.json', f.candidate),
    checks = write('checks.json', f.checks);
  const run = (action: string, args: string[], name: string) => {
    const out = `${prefix}-${name}.json`;
    files.push(out);
    const command = [
      '--experimental-strip-types',
      'scripts/sermon-workflow.ts',
      action,
      ...args,
      '--out',
      out,
    ];
    const log = execFileSync(process.execPath, command, { encoding: 'utf8' });
    expect(log).not.toContain(SERMON_MARKER);
    expect(spawnSync(process.execPath, command).status).not.toBe(0);
    return { out, value: JSON.parse(readFileSync(out, 'utf8')) };
  };
  try {
    const review = run(
      'review',
      [
        '--source',
        source,
        '--bundle',
        bundle,
        '--candidate',
        candidate,
        '--checks',
        checks,
      ],
      'reviewed',
    );
    const approval = run(
      'approve',
      ['--input', review.out, '--confirm-sha256', review.value.sha256],
      'approved',
    );
    const prepared = run('prepare', ['--input', approval.out], 'prepared');
    const exported = run(
      'authorize-publication',
      [
        '--input',
        prepared.out,
        '--confirm-sha256',
        prepared.value.sha256,
        '--publisher',
        'SYNTHETIC-PUBLISHER',
      ],
      'authorized',
    );
    expect(exported.value.state).toBe('publication-authorized');
    const rejected = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        'scripts/sermon-workflow.ts',
        'prepare',
        '--input',
        approval.out,
        '--out',
        'src/content/sermons.ts',
      ],
      { encoding: 'utf8' },
    );
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toContain('No public writes');
    expect(readFileSync('src/content/sermons.ts')).toEqual(before);
  } finally {
    files.forEach((file) => rmSync(file, { force: true }));
  }
});
