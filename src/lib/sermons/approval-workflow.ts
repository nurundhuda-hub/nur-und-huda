import { createHash } from 'node:crypto';
import type { SermonCatalog, SermonRevision, StudyRevision } from './model.ts';
import {
  contentDigest,
  revisionSeal,
  utcInstant,
  validateCatalog,
} from './publication.ts';
import {
  createPrivateSermonDraft,
  sourceDigest,
  type PrivateSermonBundle,
} from './drafts.ts';
import type { EducationalSeries } from './series.ts';
import type { PrivateStudyRevision } from './private-study.ts';
import {
  validateStudyPair,
  studyPublicationContent,
} from './publication-pair.ts';

export const WORKFLOW_MARKER = 'SERMON_LOCAL_APPROVAL_ONLY';
export const CHECKS = [
  'sourceText',
  'references',
  'rights',
  'completeStudy',
  'duration',
  'dates',
  'context',
] as const;
export interface ReviewChecks {
  reviewer: string;
  confirmations: Record<
    (typeof CHECKS)[number],
    { confirmed: true; evidence: string }
  >;
  resolutions: { blocker: string; resolution: string }[];
}
export interface PublicationCandidate {
  sermon: SermonRevision;
  study: StudyRevision;
}
interface WorkflowBase {
  warning: typeof WORKFLOW_MARKER;
  sha256: string;
  baseSha256: string;
}
export interface ReviewedRevision extends WorkflowBase {
  state: 'reviewed';
  candidate: PublicationCandidate;
  sourceSha256: string;
  bundleSha256: string;
  reviewedAt: string;
  checks: ReviewChecks;
  studyRevision?: PrivateStudyRevision;
}
export interface ApprovedRevision extends WorkflowBase {
  state: 'approved';
  review: ReviewedRevision;
  approvedAt: string;
  catalog: SermonCatalog;
}
export interface PreparedPublication extends WorkflowBase {
  state: 'prepared';
  approval: ApprovedRevision;
  preparedAt: string;
}
export interface AuthorizedPublication extends WorkflowBase {
  state: 'publication-authorized';
  preparedSha256: string;
  authorizedAt: string;
  publisher: string;
  catalog: SermonCatalog;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export const workflowDigest = (value: unknown): string =>
  createHash('sha256').update(canonical(value)).digest('hex');
const nonempty = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0;
function keys(value: object, allowed: string[]): void {
  if (!value || Object.keys(value).some((key) => !allowed.includes(key)))
    throw new Error('Candidate contains unknown/private fields.');
}
function candidateFields(candidate: PublicationCandidate): void {
  keys(candidate, ['sermon', 'study']);
  for (const record of [candidate.sermon, candidate.study]) {
    keys(record, [
      'kind',
      'id',
      'revision',
      'title',
      'series',
      'purpose',
      'editedAt',
      'publishAt',
      'approval',
      'rights',
      'references',
      ...(record.kind === 'sermon'
        ? ['friday', 'duration', 'parts', 'study']
        : ['sections']),
    ]);
    keys(record.approval, ['status']);
    keys(record.rights, ['status', 'evidenceRef', 'attribution']);
    if (record.series) keys(record.series, ['id', 'topicId']);
    record.references.forEach((ref) =>
      keys(ref, [
        'id',
        'kind',
        'label',
        'locator',
        'url',
        'verifiedBy',
        'verifiedAt',
      ]),
    );
    const blocks =
      record.kind === 'sermon'
        ? record.parts.flat()
        : record.sections.flatMap((section) => {
            keys(section, ['heading', 'blocks']);
            return section.blocks;
          });
    blocks.forEach((block) => keys(block, ['kind', 'text', 'citations']));
    if (record.kind === 'sermon') {
      keys(record.study, ['id', 'revision']);
      keys(record.duration, [
        'basis',
        'humanTimed',
        'minutes',
        'approvedBy',
        'recordedAt',
        'note',
      ]);
    }
  }
}
function sealed<T extends object>(value: T): T & { sha256: string } {
  return { ...structuredClone(value), sha256: workflowDigest(value) };
}
function checkSeal(
  value: WorkflowBase,
  state: string,
  baseline: SermonCatalog,
): void {
  const { sha256, ...body } = value;
  if (
    value.warning !== WORKFLOW_MARKER ||
    !('state' in value) ||
    value.state !== state ||
    workflowDigest(body) !== sha256 ||
    value.baseSha256 !== workflowDigest(baseline)
  )
    throw new Error(
      'Wrong transition, changed revision/seal or changed public baseline. Review again.',
    );
}
function checkTime(now: string, previous: string): void {
  if (utcInstant(now) < utcInstant(previous))
    throw new Error('Workflow chronology must not run backwards.');
}
function mergePair(
  candidate: PublicationCandidate,
  baseline: SermonCatalog,
): SermonCatalog {
  const catalog = structuredClone(baseline);
  for (const record of [candidate.sermon, candidate.study]) {
    const collection =
      record.kind === 'sermon' ? catalog.sermons : catalog.studies;
    if (
      collection.some(
        (old) => old.id === record.id && old.revision === record.revision,
      )
    )
      throw new Error('Immutable revision already exists. Use a new revision.');
    if (record.kind === 'sermon') catalog.sermons.push(structuredClone(record));
    else catalog.studies.push(structuredClone(record));
    catalog.history.push({
      kind: record.kind,
      id: record.id,
      revision: record.revision,
      sha256: revisionSeal(record),
    });
  }
  return catalog;
}
const plain = (text: string) =>
  text
    .replace(/\*\*([^\n]+?)\*\*/g, '$1')
    .replaceAll('\r\n', '\n')
    .trim();

/** Human confirmations are input, never inferred from an AI review or a filename. */
export function reviewRevision(
  source: Uint8Array,
  bundle: PrivateSermonBundle,
  candidate: PublicationCandidate,
  checks: ReviewChecks,
  baseline: SermonCatalog,
  series: EducationalSeries,
  now: string,
  studyInput?: { source: Uint8Array; revision: PrivateStudyRevision },
): ReviewedRevision {
  validateCatalog(baseline);
  candidateFields(candidate);
  // Reconstruct the original private intake to detect edits to text, spans or metadata.
  const original = createPrivateSermonDraft(
    source,
    bundle.review,
    series,
    bundle.sermon.editedAt,
  );
  if (workflowDigest(original) !== workflowDigest(bundle))
    throw new Error(
      'Private source/bundle changed. Import and review the exact revision again.',
    );
  if (studyInput) {
    validateStudyPair(studyInput.source, source, bundle, studyInput.revision);
    const expected = studyPublicationContent(studyInput.revision);
    const actual = {
      title: candidate.study.title,
      sections: candidate.study.sections.map((section) => ({
        heading: section.heading,
        blocks: section.blocks.map((block) => ({
          kind: block.kind,
          text: block.text,
          citations: [],
        })),
      })),
    };
    if (workflowDigest(expected) !== workflowDigest(actual))
      throw new Error(
        'Study candidate wording, structure or quote kinds differ from the exact supplied r2.',
      );
  }
  if (
    !nonempty(checks.reviewer) ||
    CHECKS.some(
      (key) =>
        checks.confirmations?.[key]?.confirmed !== true ||
        !nonempty(checks.confirmations[key].evidence),
    )
  )
    throw new Error(
      'Every human source/reference/rights/study/duration/date/context check is required.',
    );
  if (
    !Array.isArray(checks.resolutions) ||
    checks.resolutions.length !== bundle.review.blockers.length ||
    new Set(checks.resolutions.map((r) => r.blocker)).size !==
      checks.resolutions.length ||
    bundle.review.blockers.some(
      (blocker) =>
        !checks.resolutions.some(
          (r) => r.blocker === blocker && nonempty(r.resolution),
        ),
    )
  )
    throw new Error('Resolve every recorded intake blocker explicitly.');
  if (candidate.sermon.kind !== 'sermon' || candidate.study.kind !== 'study')
    throw new Error('One sermon and its companion study are required.');
  for (const [record, draft] of [
    [candidate.sermon, bundle.sermon],
    [candidate.study, studyInput?.revision ?? bundle.study],
  ] as const) {
    if (
      record.purpose !== 'production' ||
      record.approval.status !== 'draft' ||
      record.id !== draft.id ||
      record.revision !== draft.revision ||
      (record.kind === 'sermon' && record.title !== bundle.sermon.title) ||
      workflowDigest(record.series) !== workflowDigest(draft.series)
    )
      throw new Error(
        'Candidate must be an unapproved, public-shaped version of the exact imported identities.',
      );
    checkTime(now, record.editedAt);
    if (utcInstant(record.publishAt) < utcInstant(now))
      throw new Error(
        'Choose an explicit publication time no earlier than review.',
      );
  }
  if (
    candidate.sermon.study.id !== candidate.study.id ||
    candidate.sermon.study.revision !== candidate.study.revision
  )
    throw new Error('Exact sermon/study revision pairing is required.');
  if (
    candidate.sermon.parts.length !== 2 ||
    candidate.sermon.parts.some(
      (part, i) =>
        plain(part.map((block) => block.text).join('\n\n')) !==
        plain(bundle.sermon.parts[i]!.map((block) => block.text).join('\n\n')),
    )
  )
    throw new Error(
      'Candidate sermon text differs from the supplied source. No rewriting is permitted.',
    );
  return sealed({
    warning: WORKFLOW_MARKER,
    state: 'reviewed' as const,
    candidate,
    sourceSha256: sourceDigest(source),
    bundleSha256: workflowDigest(bundle),
    baseSha256: workflowDigest(baseline),
    reviewedAt: now,
    checks,
    ...(studyInput ? { studyRevision: studyInput.revision } : {}),
  });
}

export function approveRevision(
  review: ReviewedRevision,
  confirmSha256: string,
  baseline: SermonCatalog,
  now: string,
): ApprovedRevision {
  checkSeal(review, 'reviewed', baseline);
  checkTime(now, review.reviewedAt);
  if (confirmSha256 !== review.sha256)
    throw new Error('Explicit approval requires the exact reviewed SHA-256.');
  const candidate = structuredClone(review.candidate);
  for (const record of [candidate.sermon, candidate.study])
    record.approval = {
      status: 'approved',
      revision: record.revision,
      reviewer: review.checks.reviewer,
      reviewedAt: now,
      sha256: contentDigest(record),
    };
  const catalog = mergePair(candidate, baseline);
  validateCatalog(catalog); // Existing full reference, rights, study, Friday and history gates stay authoritative.
  return sealed({
    warning: WORKFLOW_MARKER,
    state: 'approved' as const,
    review,
    baseSha256: review.baseSha256,
    approvedAt: now,
    catalog,
  });
}
function validateApproval(
  approval: ApprovedRevision,
  baseline: SermonCatalog,
): void {
  checkSeal(approval, 'approved', baseline);
  const rebuilt = approveRevision(
    approval.review,
    approval.review.sha256,
    baseline,
    approval.approvedAt,
  );
  if (workflowDigest(rebuilt) !== workflowDigest(approval))
    throw new Error('Approval artifact was changed.');
}
export function preparePublication(
  approval: ApprovedRevision,
  baseline: SermonCatalog,
  now: string,
): PreparedPublication {
  validateApproval(approval, baseline);
  checkTime(now, approval.approvedAt);
  return sealed({
    warning: WORKFLOW_MARKER,
    state: 'prepared' as const,
    approval,
    baseSha256: approval.baseSha256,
    preparedAt: now,
  });
}
/** A separate local authorization/export; it still does not write public source or deploy. */
export function authorizePublication(
  prepared: PreparedPublication,
  confirmSha256: string,
  publisher: string,
  baseline: SermonCatalog,
  now: string,
): AuthorizedPublication {
  checkSeal(prepared, 'prepared', baseline);
  validateApproval(prepared.approval, baseline);
  checkTime(prepared.preparedAt, prepared.approval.approvedAt);
  checkTime(now, prepared.preparedAt);
  if (confirmSha256 !== prepared.sha256 || !nonempty(publisher))
    throw new Error(
      'Separate publication authorization and publisher are required.',
    );
  return sealed({
    warning: WORKFLOW_MARKER,
    state: 'publication-authorized' as const,
    baseSha256: prepared.baseSha256,
    preparedSha256: prepared.sha256,
    authorizedAt: now,
    publisher,
    catalog: structuredClone(prepared.approval.catalog),
  });
}
