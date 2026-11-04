import type { SermonCatalog, PublicSermonCatalog } from './model.ts';
import { workflowDigest } from './approval-workflow.ts';
import {
  selectPublicCatalog,
  sermonPath,
  utcInstant,
  validateCatalog,
} from './publication.ts';

/** Separate owner authorization for the access-controlled group. It does not
 * change content approvals or authorize earlier anonymous/public publication. */
export interface PrivateReleaseGrant {
  audience: 'private-group';
  origin: 'https://nour-und-huda.web.app';
  authorizedAt: string;
  authorization: string;
  catalogSha256: string;
  contentApprovalSha256: string;
  sources: { sermonSha256: string; studySha256: string };
  sermon: { id: string; revision: string };
  study: { id: string; revision: string };
  sha256: string;
}

export function selectPrivateCatalog(
  catalog: SermonCatalog,
  grant: PrivateReleaseGrant,
  asOf: string,
  options: { groupBuild: boolean; allowTestFixtures?: boolean },
): PublicSermonCatalog {
  const { sha256, ...body } = grant;
  if (
    !options.groupBuild ||
    grant.audience !== 'private-group' ||
    grant.origin !== 'https://nour-und-huda.web.app' ||
    workflowDigest(body) !== sha256 ||
    !grant.authorization?.trim() ||
    grant.catalogSha256 !== workflowDigest(catalog) ||
    utcInstant(grant.authorizedAt) > utcInstant(asOf)
  )
    throw new Error('Invalid private-group release authorization.');
  validateCatalog(catalog, options.allowTestFixtures);
  const sermon = catalog.sermons[0],
    study = catalog.studies[0];
  if (
    catalog.sermons.length !== 1 ||
    catalog.studies.length !== 1 ||
    catalog.announcements.length ||
    !sermon ||
    !study ||
    sermon.approval.status !== 'approved' ||
    study.approval.status !== 'approved' ||
    sermon.id !== grant.sermon.id ||
    sermon.revision !== grant.sermon.revision ||
    study.id !== grant.study.id ||
    study.revision !== grant.study.revision ||
    sermon.study.id !== study.id ||
    sermon.study.revision !== study.revision ||
    utcInstant(sermon.approval.reviewedAt!) > utcInstant(grant.authorizedAt) ||
    utcInstant(study.approval.reviewedAt!) > utcInstant(grant.authorizedAt)
  )
    throw new Error('Private release must bind only the exact approved pair.');
  // Real build clock. No mutation of publishAt, approval seals or history.
  const release = selectPublicCatalog(catalog, asOf, options);
  const pair = structuredClone({ sermon, study });
  release.published = [pair];
  release.privateAvailability = {
    authorizedAt: grant.authorizedAt,
    origin: grant.origin,
  };
  release.schedule = release.schedule.map((item) =>
    item.date === sermon.friday
      ? {
          date: item.date,
          status: 'published',
          title: sermon.title,
          path: sermonPath(sermon.id, sermon.revision),
        }
      : item,
  );
  return release;
}
