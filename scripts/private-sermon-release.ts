// Build/predeploy only. Never imported by browser code or a public build.
import { readFileSync } from 'node:fs';
import { loadStandaloneRelease } from './private-standalone-release.ts';
import { sermonCatalog as baseline } from '../src/content/sermons.ts';
import { educationalSeries } from '../src/content/educational-series.ts';
import {
  prepareContentReview,
  validateCorrectedContentApproval,
} from '../src/lib/sermons/content-review.ts';
import {
  reviewRevision,
  approveRevision,
  preparePublication,
  authorizePublication,
  workflowDigest,
} from '../src/lib/sermons/approval-workflow.ts';
import {
  firstRelease,
  firstReleaseCatalogSha256,
} from '../src/lib/sermons/first-release.ts';
import {
  selectPrivateCatalog,
  type PrivateReleaseGrant,
} from '../src/lib/sermons/private-release.ts';
import {
  publicBuildInstant,
  releasePaths,
} from '../src/lib/sermons/publication.ts';

export function loadPrivateRelease(groupBuild: boolean) {
  if (!groupBuild)
    throw new Error('Private release requires the server-gated group build.');
  const raw = (name: string) => readFileSync(`.sermon-review/${name}`);
  const json = (name: string) => JSON.parse(raw(name).toString('utf8'));
  const same = (a: unknown, b: unknown) => {
    if (workflowDigest(a) !== workflowDigest(b))
      throw new Error('Private release chain mismatch.');
  };
  const source = raw('first-sermon-approved.txt');
  const bundle = json('first-sermon-r1.bundle.json');
  const study = raw('study-001-approved.md');
  const studyBundle = json('study-001-r2.bundle.json');
  const corrected = json('content-approved-r1-r2.v2.json');
  const review = prepareContentReview(
    source,
    bundle,
    study,
    studyBundle,
    json('task21-content-evidence.json'),
    raw('task21-content-report.md'),
    corrected.review.recordedAt,
    true,
  );
  validateCorrectedContentApproval(
    corrected,
    '4008249eb6bc4213b1dea67c669f8e2a8c382357833584992f8cbb186f4af827',
    raw('content-approved-r1-r2.json'),
    review,
  );
  const reviewed = json('task27-reviewed.json');
  same(
    reviewRevision(
      source,
      bundle,
      reviewed.candidate,
      reviewed.checks,
      baseline,
      educationalSeries,
      reviewed.reviewedAt,
      { source: study, revision: studyBundle },
    ),
    reviewed,
  );
  const approved = json('task27-approved.json');
  same(
    approveRevision(reviewed, reviewed.sha256, baseline, approved.approvedAt),
    approved,
  );
  const prepared = json('task27-prepared.json');
  same(preparePublication(approved, baseline, prepared.preparedAt), prepared);
  const authorized = json('task27-authorized.json');
  same(
    authorizePublication(
      prepared,
      prepared.sha256,
      authorized.publisher,
      baseline,
      authorized.authorizedAt,
    ),
    authorized,
  );
  const catalog = json('task27-public-catalog.json');
  same(authorized.catalog, catalog);
  if (workflowDigest(catalog) !== firstReleaseCatalogSha256)
    throw new Error('First-release catalog changed.');
  const grant = json('private-site-release.json') as PrivateReleaseGrant;
  same(grant.sources, review.sources);
  same(grant.sermon, firstRelease.sermon);
  same(grant.study, firstRelease.study);
  if (grant.contentApprovalSha256 !== corrected.sha256)
    throw new Error(
      'Private authorization references a different content approval.',
    );
  const release = selectPrivateCatalog(
    catalog,
    grant,
    publicBuildInstant(undefined),
    { groupBuild },
  );
  const additional = loadStandaloneRelease(release, groupBuild);
  const paths = releasePaths(additional.release);
  return {
    release: additional.release,
    grantSha256: workflowDigest([grant.sha256, additional.sha256]),
    paths: [...paths.pages, ...paths.downloads],
  };
}
