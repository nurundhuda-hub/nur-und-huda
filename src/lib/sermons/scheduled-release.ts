import { berlinWallTime } from '../prayer-calculation/calendar.ts';
import {
  utcInstant,
  releasePaths,
  selectPublicCatalog,
} from './publication.ts';
import { workflowDigest } from './approval-workflow.ts';
import type { PairPreparation } from './publication-pair.ts';
import type { CorrectedContentApproval } from './content-review.ts';
import type { PublicSermonCatalog, SermonCatalog } from './model.ts';

export function publicationSchedule(date: string, localTime: string) {
  const publishAt = berlinWallTime(date, localTime).replace('.000Z', 'Z');
  if (new Date(`${date}T12:00:00Z`).getUTCDay() !== 5)
    throw new Error('The sermon date must be Friday.');
  return {
    friday: date,
    localTime,
    timeZone: 'Europe/Berlin' as const,
    publishAt,
  };
}
/** Pure private preparation; caller must validate the corrected approval chain. */
export function schedulePrivatePair(
  preparation: PairPreparation,
  approval: CorrectedContentApproval,
  schedule: ReturnType<typeof publicationSchedule>,
  now: string,
) {
  if (
    workflowDigest(publicationSchedule(schedule.friday, schedule.localTime)) !==
    workflowDigest(schedule)
  )
    throw new Error('Schedule UTC instant does not match Europe/Berlin.');
  const { sha256, ...approvalBody } = approval;
  if (
    workflowDigest(approvalBody) !== sha256 ||
    approval.state !== 'content-approved-only' ||
    approval.publicationAuthorized !== false ||
    workflowDigest(preparation.sources) !==
      workflowDigest(approval.review.sources) ||
    preparation.candidate.sermon.id !== approval.review.pair.sermon.id ||
    preparation.candidate.sermon.revision !==
      approval.review.pair.sermon.revision ||
    preparation.candidate.study.id !== approval.review.pair.study.id ||
    preparation.candidate.study.revision !== approval.review.pair.study.revision
  )
    throw new Error('Schedule must bind the exact approved pair and sources.');
  if (
    utcInstant(now) < utcInstant(approval.correction.correctedAt) ||
    utcInstant(schedule.publishAt) <= utcInstant(now)
  )
    throw new Error(
      'Prepare a future release after content approval/correction.',
    );
  const candidate = structuredClone(preparation.candidate);
  // Deliberately retain draft approvals and pending metadata: scheduling is not release approval.
  const scheduled = {
    sermon: {
      ...candidate.sermon,
      friday: schedule.friday,
      publishAt: schedule.publishAt,
    },
    study: { ...candidate.study, publishAt: schedule.publishAt },
  };
  const body = {
    warning: 'SERMON_PRIVATE_SCHEDULE_PREPARATION_ONLY',
    state: 'scheduled-preparation-only',
    recordedAt: now,
    contentApprovalSha256: approval.sha256,
    sources: preparation.sources,
    schedule,
    candidate: scheduled,
    publicationAuthorized: false,
    activationReady: false,
    pending: [
      'Human reading-duration review',
      'Final public reference metadata and release approval',
      'Separate public-disclosure and deployment authorization',
    ],
  };
  return { ...body, sha256: workflowDigest(body) };
}
export function publicReleaseManifest(release: PublicSermonCatalog) {
  return {
    ...(release.privateAvailability
      ? {
          audience: 'private-group' as const,
          privateAvailableAt: release.privateAvailability.authorizedAt,
        }
      : {}),
    asOf: release.asOf,
    ...releasePaths(release),
    releases: release.published.map(({ sermon, study }) => ({
      sermon: { id: sermon.id, revision: sermon.revision },
      study: { id: study.id, revision: study.revision },
      friday: sermon.friday,
      sermonPublishAt: sermon.publishAt,
      studyPublishAt: study.publishAt,
    })),
  };
}
export interface ExpectedRelease {
  publishAt: string;
  sermon: { id: string; revision: string };
  study: { id: string; revision: string };
}
/** Deployment prerequisite, never deployment authorization. CLI supplies the actual clock. */
export function checkScheduledRelease(
  catalog: SermonCatalog,
  manifest: ReturnType<typeof publicReleaseManifest>,
  expected: ExpectedRelease,
  now: number,
) {
  if (manifest.audience === 'private-group')
    throw new Error(
      'A private-group artifact cannot be used for public publication.',
    );
  if (!Number.isFinite(now) || now < utcInstant(expected.publishAt))
    throw new Error('Release embargo has not elapsed.');
  const builtAt = utcInstant(manifest.asOf);
  if (builtAt < utcInstant(expected.publishAt) || builtAt > now)
    throw new Error(
      'Build is pre-release or uses a future clock. Rebuild after the embargo.',
    );
  const actual = publicReleaseManifest(
    selectPublicCatalog(catalog, manifest.asOf),
  );
  if (workflowDigest(actual) !== workflowDigest(manifest))
    throw new Error(
      'Built manifest differs from the currently validated public catalog.',
    );
  const item = actual.releases.find(
    (r) =>
      r.sermon.id === expected.sermon.id &&
      r.sermon.revision === expected.sermon.revision &&
      r.study.id === expected.study.id &&
      r.study.revision === expected.study.revision,
  );
  if (
    !item ||
    item.sermonPublishAt !== expected.publishAt ||
    item.studyPublishAt !== expected.publishAt
  )
    throw new Error(
      'Both exact approved revisions must share the scheduled instant.',
    );
  return actual;
}
