/** Local, server-build-only approval of a sermon whose study the owner withholds.
 * Public catalog/pair gates are deliberately unchanged. Never imported by a client. */
import { workflowDigest } from './approval-workflow.ts';
import {
  createPrivateSermonDraft,
  type PrivateSermonBundle,
} from './drafts.ts';
import {
  contentDigest,
  revisionSeal,
  sermonPath,
  utcInstant,
} from './publication.ts';
import { validateSeries, type EducationalSeries } from './series.ts';
import type { PrivateStandaloneSermon, PublicSermonCatalog } from './model.ts';

export interface StandaloneEvidence {
  source: string;
  references: string;
  rights: string;
  context: string;
  unresolved: string[];
  reportSha256: string;
}
export interface StandaloneReview {
  state: 'reviewed-private-sermon';
  sourceSha256: string;
  intakeSha256: string;
  baselineSha256: string;
  series: EducationalSeries;
  candidate: PrivateStandaloneSermon;
  evidence: StandaloneEvidence;
  reviewedAt: string;
  sha256: string;
}
export interface StandaloneApproval {
  state: 'content-approved-only';
  reviewSha256: string;
  sermon: PrivateStandaloneSermon;
  historySeal: string;
  attestation: string;
  sha256: string;
}
export interface StandaloneAuthorization {
  state: 'authorized-private-sermon';
  audience: 'private-group';
  origin: 'https://nour-und-huda.web.app';
  approvalSha256: string;
  publisher: string;
  authorizedAt: string;
  authorization: string;
  studyDecision: 'withhold-until-separately-approved';
  sha256: string;
}
const text = (s: unknown): s is string => typeof s === 'string' && !!s.trim();
const hash = (s: string) => /^[a-f0-9]{64}$/.test(s);
function seal<T extends object>(body: T): T & { sha256: string } {
  return { ...body, sha256: workflowDigest(body) };
}
function checkSeal(record: { sha256: string }) {
  const { sha256, ...body } = record;
  if (sha256 !== workflowDigest(body))
    throw Error('Private record seal mismatch.');
}
export function reviewStandalone(
  source: Uint8Array,
  bundle: PrivateSermonBundle,
  candidate: PrivateStandaloneSermon,
  series: EducationalSeries,
  evidence: StandaloneEvidence,
  baseline: PublicSermonCatalog,
  reviewedAt: string,
): StandaloneReview {
  if (!baseline.privateAvailability) throw Error('Private baseline required.');
  const rebuilt = createPrivateSermonDraft(
    source,
    bundle.review,
    series,
    bundle.sermon.editedAt,
  );
  if (workflowDigest(rebuilt) !== workflowDigest(bundle))
    throw Error('Source/intake changed.');
  validateSeries({
    series: [series],
    sermons: [],
    studies: [],
    announcements: [],
    history: [],
  });
  const draft = bundle.sermon;
  if (
    candidate.purpose !== 'production' ||
    candidate.kind !== 'sermon' ||
    candidate.id !== draft.id ||
    candidate.revision !== draft.revision ||
    candidate.title !== draft.title ||
    workflowDigest(candidate.parts) !== workflowDigest(draft.parts) ||
    workflowDigest(candidate.introduction ?? []) !==
      workflowDigest(draft.introduction ?? []) ||
    workflowDigest(candidate.series) !== workflowDigest(draft.series) ||
    candidate.study !== null ||
    candidate.studyStatus !== 'withheld-by-owner' ||
    candidate.approval.status !== 'draft' ||
    candidate.editedAt !== draft.editedAt
  )
    throw Error('Exact supplied sermon and explicit withheld study required.');
  if (
    utcInstant(candidate.editedAt) > utcInstant(reviewedAt) ||
    utcInstant(reviewedAt) > utcInstant(candidate.publishAt) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(candidate.friday) ||
    new Date(`${candidate.friday}T12:00:00Z`).toISOString().slice(0, 10) !==
      candidate.friday ||
    new Date(`${candidate.friday}T12:00:00Z`).getUTCDay() !== 5
  )
    throw Error('Invalid review/publication/Friday dates.');
  if (baseline.published.some((p) => p.sermon.id === candidate.id))
    throw Error('Cannot overwrite an existing approved sermon.');
  if (
    candidate.rights.status !== 'confirmed' ||
    !text(candidate.rights.evidenceRef) ||
    !text(candidate.rights.attribution) ||
    !hash(evidence.reportSha256) ||
    ![
      evidence.source,
      evidence.references,
      evidence.rights,
      evidence.context,
    ].every(text) ||
    !Array.isArray(evidence.unresolved) ||
    evidence.unresolved.length
  )
    throw Error('Unresolved content/rights evidence.');
  const refs = candidate.references;
  if (
    refs.length !== bundle.review.references.length ||
    new Set(refs.map((r) => r.id)).size !== refs.length ||
    !['quran', 'hadith', 'book'].every((kind) =>
      refs.some((r) => r.kind === kind),
    )
  )
    throw Error('Missing reference evidence.');
  for (const ref of refs) {
    const checked = bundle.review.references.find((r) => r.id === ref.id);
    if (
      !checked ||
      checked.kind !== ref.kind ||
      checked.locator !== ref.locator ||
      checked.url !== ref.url ||
      !text(ref.label) ||
      !text(ref.verifiedBy) ||
      utcInstant(ref.verifiedAt) > utcInstant(reviewedAt)
    )
      throw Error('Reference differs from checked intake.');
  }
  const d = candidate.duration;
  if (
    d.basis !== 'owner-approved-estimate' ||
    d.humanTimed !== false ||
    !Number.isFinite(d.minutes) ||
    d.minutes <= 0 ||
    !text(d.approvedBy) ||
    !text(d.note) ||
    utcInstant(d.recordedAt) < utcInstant(candidate.editedAt) ||
    utcInstant(d.recordedAt) > utcInstant(reviewedAt)
  )
    throw Error('Owner-approved estimated duration required.');
  return seal({
    state: 'reviewed-private-sermon' as const,
    sourceSha256: bundle.source.sha256,
    intakeSha256: workflowDigest(bundle),
    baselineSha256: workflowDigest(baseline.published),
    series: structuredClone(series),
    candidate: structuredClone(candidate),
    evidence: structuredClone(evidence),
    reviewedAt,
  });
}
export function approveStandalone(
  review: StandaloneReview,
  expectedHash: string,
  reviewer: string,
  attestation: string,
  approvedAt: string,
): StandaloneApproval {
  checkSeal(review);
  if (
    expectedHash !== review.sha256 ||
    !text(reviewer) ||
    !text(attestation) ||
    utcInstant(approvedAt) < utcInstant(review.reviewedAt) ||
    utcInstant(approvedAt) > utcInstant(review.candidate.publishAt)
  )
    throw Error('Explicit exact-revision content approval required.');
  const sermon = structuredClone(review.candidate);
  sermon.approval = {
    status: 'approved',
    revision: sermon.revision,
    reviewer,
    reviewedAt: approvedAt,
    sha256: contentDigest(sermon),
  };
  return seal({
    state: 'content-approved-only' as const,
    reviewSha256: review.sha256,
    sermon,
    historySeal: revisionSeal(sermon),
    attestation,
  });
}
export function authorizeStandalone(
  approval: StandaloneApproval,
  expectedHash: string,
  publisher: string,
  authorization: string,
  authorizedAt: string,
  studyDecision: StandaloneAuthorization['studyDecision'],
): StandaloneAuthorization {
  checkSeal(approval);
  if (
    expectedHash !== approval.sha256 ||
    !text(publisher) ||
    !text(authorization) ||
    approval.sermon.approval.sha256 !== contentDigest(approval.sermon) ||
    approval.historySeal !== revisionSeal(approval.sermon) ||
    utcInstant(authorizedAt) <
      utcInstant(approval.sermon.approval.reviewedAt!) ||
    studyDecision !== 'withhold-until-separately-approved'
  )
    throw Error('Separate private publication authorization required.');
  return seal({
    state: 'authorized-private-sermon' as const,
    audience: 'private-group' as const,
    origin: 'https://nour-und-huda.web.app' as const,
    approvalSha256: approval.sha256,
    publisher,
    authorization,
    authorizedAt,
    studyDecision,
  });
}
export function appendStandalone(
  baseline: PublicSermonCatalog,
  review: StandaloneReview,
  approval: StandaloneApproval,
  authorization: StandaloneAuthorization,
  groupBuild: boolean,
): PublicSermonCatalog {
  [review, approval, authorization].forEach(checkSeal);
  if (
    !groupBuild ||
    !baseline.privateAvailability ||
    authorization.audience !== 'private-group' ||
    authorization.origin !== baseline.privateAvailability.origin ||
    approval.reviewSha256 !== review.sha256 ||
    authorization.approvalSha256 !== approval.sha256 ||
    review.baselineSha256 !== workflowDigest(baseline.published) ||
    authorization.studyDecision !== 'withhold-until-separately-approved' ||
    utcInstant(authorization.authorizedAt) > utcInstant(baseline.asOf) ||
    utcInstant(approval.sermon.publishAt) > utcInstant(baseline.asOf)
  )
    throw Error('Private release gate not satisfied.');
  const release = structuredClone(baseline);
  const item = { sermon: structuredClone(approval.sermon), study: null };
  release.published.push(item);
  release.series = [structuredClone(review.series)];
  release.schedule = release.schedule.map((day) =>
    day.date === item.sermon.friday
      ? {
          date: day.date,
          status: 'published' as const,
          title: item.sermon.title,
          path: sermonPath(item.sermon.id, item.sermon.revision),
        }
      : day,
  );
  if (!release.schedule.some((day) => day.date === item.sermon.friday))
    release.archive.push(item);
  return release;
}
