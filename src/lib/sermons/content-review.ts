import { workflowDigest } from './approval-workflow.ts';
import {
  sourceDigest,
  splitSuppliedSermon,
  type PrivateSermonBundle,
} from './drafts.ts';
import { validateStudyPair } from './publication-pair.ts';
import type { PrivateStudyRevision } from './private-study.ts';
import { utcInstant } from './publication.ts';

export const CONTENT_REVIEW_MARKER = 'SERMON_PRIVATE_CONTENT_REVIEW_ONLY';
export const CONTENT_CHECKS = [
  'quran',
  'hadith',
  'book',
  'rights',
  'consistency',
  'context',
] as const;
export interface ContentEvidence {
  sources: { sermonSha256: string; studySha256: string };
  reportSha256: string;
  findings: Record<
    (typeof CONTENT_CHECKS)[number],
    {
      status: 'checked' | 'unresolved';
      basis: string;
      locations: string[];
    }
  >;
}
/** Explicit arithmetic scenarios, not measured speaking rates or human timing. */
export function estimateReading(source: Uint8Array) {
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(source);
  const parts = splitSuppliedSermon(raw).map(
    (span) =>
      (
        raw
          .slice(span.start, span.end)
          .replace(/\[[^\]]*\]/g, '')
          .replace(/\*\*/g, '')
          .match(/[\p{Script=Arabic}\p{M}]+/gu) ?? []
      ).filter((word) => /\p{L}/u.test(word)).length,
  );
  const words = parts.reduce((sum, value) => sum + value, 0);
  return {
    method:
      'Arabic letter runs in body parts; omit bracketed locators and Markdown delimiters',
    parts,
    words,
    humanTimed: false as const,
    scenarios: [80, 100, 120].map((wordsPerMinute) => ({
      wordsPerMinute,
      minutes: Math.round((words / wordsPerMinute) * 100) / 100,
    })),
    pausesIncluded: false as const,
  };
}
export function prepareContentReview(
  sermon: Uint8Array,
  bundle: PrivateSermonBundle,
  studySource: Uint8Array,
  study: PrivateStudyRevision,
  evidence: ContentEvidence,
  report: Uint8Array,
  now: string,
  editorialAcknowledged: boolean,
) {
  utcInstant(now);
  if (!editorialAcknowledged)
    throw new Error(
      'Explicit acknowledgement of the existing owner editorial decision is required.',
    );
  validateStudyPair(studySource, sermon, bundle, study);
  const sources = {
    sermonSha256: sourceDigest(sermon),
    studySha256: sourceDigest(studySource),
  };
  if (
    workflowDigest(sources) !== workflowDigest(evidence.sources) ||
    evidence.reportSha256 !== sourceDigest(report)
  )
    throw new Error('Evidence must bind the exact sources and report.');
  if (
    Object.keys(evidence.findings).length !== CONTENT_CHECKS.length ||
    CONTENT_CHECKS.some((key) => {
      const finding = evidence.findings[key];
      return (
        !finding ||
        !['checked', 'unresolved'].includes(finding.status) ||
        !finding.basis?.trim() ||
        !Array.isArray(finding.locations) ||
        !finding.locations.length ||
        finding.locations.some(
          (location) => typeof location !== 'string' || !location.trim(),
        )
      );
    })
  )
    throw new Error(
      'Every content evidence category requires a substantive finding and location.',
    );
  const blockers = CONTENT_CHECKS.filter(
    (key) => evidence.findings[key].status === 'unresolved',
  );
  const body = {
    warning: CONTENT_REVIEW_MARKER,
    state: blockers.length
      ? ('blocked-content-review' as const)
      : ('awaiting-owner-content-confirmation' as const),
    recordedAt: now,
    sources,
    pair: {
      sermon: { id: bundle.sermon.id, revision: bundle.sermon.revision },
      study: { id: study.id, revision: study.revision },
    },
    bundleSha256: workflowDigest(bundle),
    studyRevisionSha256: workflowDigest(study),
    editorial: {
      status: 'owner-approved' as const,
      basis: 'Task 19 and Task 20 explicit owner decisions',
      ownerApprovedAt: null,
    },
    evidence: structuredClone(evidence),
    blockers,
    durationEstimate: estimateReading(sermon),
    formalContentApproval: null,
    friday: null,
    publishAt: null,
    publicationAuthorized: false as const,
  };
  return { ...body, sha256: workflowDigest(body) };
}
export type ContentReview = ReturnType<typeof prepareContentReview>;

/** Local owner action only. This record is not a public ContentApproval or catalog. */
export function confirmContentReview(
  review: ContentReview,
  exactHash: string,
  reviewer: string,
  attestation: string,
  now: string,
) {
  const { sha256, ...body } = review;
  if (
    review.warning !== CONTENT_REVIEW_MARKER ||
    workflowDigest(body) !== sha256 ||
    exactHash !== sha256
  )
    throw new Error('Confirm the exact unchanged content-review hash.');
  if (
    review.state !== 'awaiting-owner-content-confirmation' ||
    review.blockers.length ||
    CONTENT_CHECKS.some(
      (key) => review.evidence.findings[key]?.status !== 'checked',
    )
  )
    throw new Error('Unresolved content evidence cannot be approved.');
  if (!reviewer.trim() || !attestation.trim())
    throw new Error(
      'A real reviewer and explicit review attestation are required.',
    );
  if (utcInstant(now) < utcInstant(review.recordedAt))
    throw new Error('Approval cannot precede review.');
  const approved = {
    warning: CONTENT_REVIEW_MARKER,
    state: 'content-approved-only' as const,
    review: structuredClone(review),
    reviewer,
    attestation,
    approvedAt: now,
    friday: null,
    publishAt: null,
    publicationAuthorized: false as const,
  };
  return { ...approved, sha256: workflowDigest(approved) };
}

export type ContentOnlyApproval = ReturnType<typeof confirmContentReview>;
export interface CorrectedContentApproval extends ContentOnlyApproval {
  correction: {
    recordVersion: 2;
    kind: 'reviewer-identifier-correction';
    originalApprovalFile: string;
    originalApprovalSha256: string;
    originalFileSha256: string;
    previousReviewer: string;
    correctedAt: string;
    authorization: string;
    reason: string;
  };
}
/** Reconstruct both approval versions and the current source/evidence-bound review.
 * Hashes detect changes; they are not authentication or a grant to publish. */
export function validateCorrectedContentApproval(
  corrected: CorrectedContentApproval,
  expectedSeal: string,
  originalBytes: Uint8Array,
  currentReview: ContentReview,
): void {
  const original = JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(originalBytes),
  ) as ContentOnlyApproval;
  const { sha256, correction, ...body } = corrected;
  if (
    sha256 !== expectedSeal ||
    workflowDigest({ ...body, correction }) !== sha256
  )
    throw new Error('Corrected approval seal mismatch.');
  const rebuiltOriginal = confirmContentReview(
    currentReview,
    currentReview.sha256,
    original.reviewer,
    original.attestation,
    original.approvedAt,
  );
  if (
    workflowDigest(rebuiltOriginal) !== workflowDigest(original) ||
    correction.recordVersion !== 2 ||
    correction.kind !== 'reviewer-identifier-correction' ||
    correction.originalApprovalSha256 !== original.sha256 ||
    correction.originalFileSha256 !== sourceDigest(originalBytes) ||
    correction.previousReviewer !== original.reviewer ||
    !correction.originalApprovalFile?.trim() ||
    !correction.authorization?.trim() ||
    !correction.reason?.trim() ||
    utcInstant(correction.correctedAt) < utcInstant(original.approvedAt)
  )
    throw new Error('Invalid original approval or correction chain.');
  const { sha256: _seal, ...rebuiltBody } = confirmContentReview(
    currentReview,
    currentReview.sha256,
    corrected.reviewer,
    original.attestation,
    original.approvedAt,
  );
  if (workflowDigest(body) !== workflowDigest(rebuiltBody))
    throw new Error(
      'Reviewer correction changed content, attestation or approval scope.',
    );
}
