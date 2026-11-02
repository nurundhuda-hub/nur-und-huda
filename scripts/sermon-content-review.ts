import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { privateFile, privateReviewRoot } from './local-study.ts';
import {
  prepareContentReview,
  confirmContentReview,
  type ContentReview,
} from '../src/lib/sermons/content-review.ts';
import { workflowDigest } from '../src/lib/sermons/approval-workflow.ts';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    'owner-editorial-approval': { type: 'boolean' },
    evidence: { type: 'string' },
    report: { type: 'string' },
    out: { type: 'string' },
    input: { type: 'string' },
    'confirm-sha256': { type: 'string' },
    reviewer: { type: 'string' },
    attestation: { type: 'string' },
  },
});
const action = positionals[0];
if (positionals.length !== 1 || !['prepare', 'confirm'].includes(action!))
  throw new Error('Choose prepare or confirm.');
const root = await privateReviewRoot();
const name = (key: keyof typeof values) => {
  const value = values[key];
  if (
    typeof value !== 'string' ||
    !value ||
    value === '.' ||
    value === '..' ||
    path.basename(value) !== value
  )
    throw new Error(
      'Use filenames directly within .sermon-review, never public paths.',
    );
  return value;
};
const json = async (file: string) =>
  JSON.parse((await privateFile(root, file)).toString());
const sermon = await privateFile(root, 'first-sermon-approved.txt');
const bundle = await json('first-sermon-r1.bundle.json');
const study = await privateFile(root, 'study-001-approved.md');
const revision = await json('study-001-r2.bundle.json');
const evidence = await json(name('evidence'));
const report = await privateFile(root, name('report'));
const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
let result;
if (action === 'prepare') {
  if (
    values.input ||
    values['confirm-sha256'] ||
    values.reviewer ||
    values.attestation
  )
    throw new Error('Confirmation options are not valid for preparation.');
  result = prepareContentReview(
    sermon,
    bundle,
    study,
    revision,
    evidence,
    report,
    now,
    values['owner-editorial-approval'] === true,
  );
} else {
  if (values['owner-editorial-approval'])
    throw new Error('Editorial acknowledgement is not formal approval.');
  const review = (await json(name('input'))) as ContentReview;
  const rebuilt = prepareContentReview(
    sermon,
    bundle,
    study,
    revision,
    evidence,
    report,
    review.recordedAt,
    true,
  );
  if (workflowDigest(rebuilt) !== workflowDigest(review))
    throw new Error(
      'Current source, evidence or review changed. Prepare a new immutable review.',
    );
  result = confirmContentReview(
    review,
    values['confirm-sha256'] ?? '',
    values.reviewer ?? '',
    values.attestation ?? '',
    now,
  );
}
await writeFile(
  path.join(root, name('out')),
  JSON.stringify(result, null, 2) + '\n',
  { flag: 'wx', mode: 0o600 },
);
console.log(
  `${result.state}: ${result.sha256}. Private content scope only; no scheduling, public catalog write or publication authorization.`,
);
