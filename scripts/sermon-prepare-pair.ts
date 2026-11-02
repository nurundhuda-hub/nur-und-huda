import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { privateReviewRoot, privateFile } from './local-study.ts';
import { prepareEditorialPair } from '../src/lib/sermons/publication-pair.ts';
import { workflowDigest } from '../src/lib/sermons/approval-workflow.ts';
import {
  STUDY_SOURCE_FILE,
  STUDY_REVISION_FILE,
} from '../src/lib/sermons/private-study.ts';

const { values } = parseArgs({
  options: { 'owner-editorial-approval': { type: 'boolean' } },
});
const root = await privateReviewRoot();
const prepared = prepareEditorialPair(
  await privateFile(root, 'first-sermon-approved.txt'),
  JSON.parse(
    (await privateFile(root, 'first-sermon-r1.bundle.json')).toString(),
  ),
  await privateFile(root, STUDY_SOURCE_FILE),
  JSON.parse((await privateFile(root, STUDY_REVISION_FILE)).toString()),
  new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  values['owner-editorial-approval'] === true,
);
const result = { ...prepared, sha256: workflowDigest(prepared) };
await writeFile(
  path.join(root, 'publication-preparation-r1-r2.json'),
  JSON.stringify(result, null, 2) + '\n',
  { flag: 'wx', mode: 0o600 },
);
console.log(
  `Private pair recorded: sermon r1 -> study r2. SHA-256: ${result.sha256}. Blocked preparation only; no reviewer, dates or formal approval invented.`,
);
