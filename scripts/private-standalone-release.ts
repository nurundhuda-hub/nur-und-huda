// Explicit private allowlist, never discover or publish arbitrary review files.
import { readFileSync } from 'node:fs';
import { sourceDigest } from '../src/lib/sermons/drafts.ts';
import { workflowDigest } from '../src/lib/sermons/approval-workflow.ts';
import {
  reviewStandalone,
  approveStandalone,
  authorizeStandalone,
  appendStandalone,
} from '../src/lib/sermons/private-standalone.ts';
import type { PublicSermonCatalog } from '../src/lib/sermons/model.ts';
export function loadStandaloneRelease(
  baseline: PublicSermonCatalog,
  groupBuild: boolean,
) {
  if (!groupBuild) throw Error('Private build required.');
  const raw = (name: string) => readFileSync(`.sermon-review/${name}`);
  const json = (name: string) => JSON.parse(raw(name).toString('utf8'));
  const same = (a: unknown, b: unknown) => {
    if (workflowDigest(a) !== workflowDigest(b))
      throw Error('Standalone approval chain changed.');
  };
  const recorded = json('second-sermon-merged-reviewed.json');
  if (
    sourceDigest(raw('second-sermon-merged-evidence.md')) !==
    recorded.evidence.reportSha256
  )
    throw Error('Evidence report changed.');
  const review = reviewStandalone(
    raw('second-sermon-merged-approved.txt'),
    json('second-sermon-merged-r1.bundle.json'),
    recorded.candidate,
    recorded.series,
    recorded.evidence,
    baseline,
    recorded.reviewedAt,
  );
  same(review, recorded);
  const approved = json('second-sermon-merged-content-approved.json');
  same(
    approveStandalone(
      review,
      review.sha256,
      approved.sermon.approval.reviewer,
      approved.attestation,
      approved.sermon.approval.reviewedAt,
    ),
    approved,
  );
  const authorization = json(
    'second-sermon-merged-publication-authorized.json',
  );
  same(
    authorizeStandalone(
      approved,
      approved.sha256,
      authorization.publisher,
      authorization.authorization,
      authorization.authorizedAt,
      authorization.studyDecision,
    ),
    authorization,
  );
  return {
    release: appendStandalone(
      baseline,
      review,
      approved,
      authorization,
      groupBuild,
    ),
    sha256: authorization.sha256,
  };
}
