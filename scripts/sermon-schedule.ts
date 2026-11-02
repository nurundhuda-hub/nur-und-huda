import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { privateFile, privateReviewRoot } from './local-study.ts';
import {
  prepareContentReview,
  validateCorrectedContentApproval,
} from '../src/lib/sermons/content-review.ts';
import { prepareEditorialPair } from '../src/lib/sermons/publication-pair.ts';
import {
  publicationSchedule,
  schedulePrivatePair,
} from '../src/lib/sermons/scheduled-release.ts';

const { values } = parseArgs({
  options: Object.fromEntries(
    [
      'approval',
      'original-approval',
      'confirm-approval-sha256',
      'review',
      'evidence',
      'report',
      'friday',
      'time',
      'out',
    ].map((name) => [name, { type: 'string' as const }]),
  ),
});
const root = await privateReviewRoot();
const required = (name: keyof typeof values) => {
  const value = values[name];
  if (!value) throw new Error(`Missing --${name}`);
  return value;
};
const filename = (name: keyof typeof values) => {
  const value = required(name);
  if (path.basename(value) !== value || ['.', '..'].includes(value))
    throw new Error('Private filenames only.');
  return value;
};
const json = async (name: string) =>
  JSON.parse((await privateFile(root, name)).toString());
const source = await privateFile(root, 'first-sermon-approved.txt'),
  studySource = await privateFile(root, 'study-001-approved.md');
const bundle = await json('first-sermon-r1.bundle.json'),
  study = await json('study-001-r2.bundle.json');
const review = await json(filename('review')),
  approval = await json(filename('approval'));
const current = prepareContentReview(
  source,
  bundle,
  studySource,
  study,
  await json(filename('evidence')),
  await privateFile(root, filename('report')),
  review.recordedAt,
  true,
);
if (JSON.stringify(current) !== JSON.stringify(review))
  throw new Error('Current review changed.');
validateCorrectedContentApproval(
  approval,
  required('confirm-approval-sha256'),
  await privateFile(root, filename('original-approval')),
  current,
);
const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const result = schedulePrivatePair(
  prepareEditorialPair(source, bundle, studySource, study, now, true),
  approval,
  publicationSchedule(required('friday'), required('time')),
  now,
);
await writeFile(
  path.join(root, filename('out')),
  JSON.stringify(result, null, 2) + '\n',
  { flag: 'wx', mode: 0o600 },
);
console.log(
  `Private scheduled preparation: ${result.sha256}; not before ${result.schedule.publishAt}. No activation, public content write or deployment.`,
);
