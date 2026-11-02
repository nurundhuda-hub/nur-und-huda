import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadLocalStudy } from './local-study.ts';
import { sermonCatalog } from '../src/content/sermons.ts';
import { educationalSeries } from '../src/content/educational-series.ts';
import { createPrivateSermonDraft } from '../src/lib/sermons/drafts.ts';
import {
  approveRevision,
  preparePublication,
  reviewRevision,
  workflowDigest,
} from '../src/lib/sermons/approval-workflow.ts';
import {
  unavailableReview,
  type PreviewReviewStatus,
} from '../src/lib/sermons/preview-status.ts';

/** The caller has already verified the private root. Never write or approve here. */
export async function localReviewStatus(
  source: Uint8Array,
  root: string,
  now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
): Promise<PreviewReviewStatus> {
  const json = async (name: string) => {
    const file = path.join(root, name);
    if (!(await lstat(file)).isFile())
      throw new Error('Invalid private record');
    return JSON.parse(await readFile(file, 'utf8'));
  };
  let status = unavailableReview();
  try {
    const bundle = await json('first-sermon-r1.bundle.json');
    const rebuilt = createPrivateSermonDraft(
      source,
      bundle.review,
      educationalSeries,
      bundle.sermon.editedAt,
    );
    if (workflowDigest(rebuilt) !== workflowDigest(bundle)) return status;
    status = {
      state: 'blocked',
      revision: bundle.sermon.revision,
      missing: [...bundle.review.blockers],
    };
    let review;
    try {
      review = await json('reviewed-r1.json');
    } catch {
      return status;
    }
    const reviewed = reviewRevision(
      source,
      bundle,
      review.candidate,
      review.checks,
      sermonCatalog,
      educationalSeries,
      review.reviewedAt,
      review.studyRevision
        ? await (async () => {
            const study = await loadLocalStudy(root, source);
            if (
              study.state !== 'present' ||
              workflowDigest(study.revision) !==
                workflowDigest(review.studyRevision)
            )
              throw new Error('Changed study review source.');
            return {
              source: Buffer.from(study.revision.source.rawMarkdown),
              revision: study.revision,
            };
          })()
        : undefined,
    );
    if (workflowDigest(reviewed) !== workflowDigest(review))
      throw new Error('Changed review');
    // Intake resolutions are now recorded. Do not keep labelling them unresolved
    // if a later publication/history gate fails.
    status = { ...status, reviewRecorded: true, missing: [] };
    // Pure validation only: discard the result, never persist an approval.
    approveRevision(review, review.sha256, sermonCatalog, now);
    try {
      const approved = await json('approved-r1.json');
      if (workflowDigest(approved.review) !== workflowDigest(review))
        throw new Error('Changed approval');
      preparePublication(approved, sermonCatalog, now);
      return {
        state: 'approved',
        revision: status.revision,
        reviewRecorded: true,
        missing: [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    return {
      state: 'ready',
      revision: status.revision,
      missing: [],
      reviewedSha256: review.sha256,
      reviewRecorded: true,
    };
  } catch {
    return {
      ...status,
      missing: [
        ...status.missing,
        'تعذّر التحقق من سجل المراجعة أو الاعتماد؛ أعد المراجعة المحلية قبل الاعتماد.',
      ],
    };
  }
}
