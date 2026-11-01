import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { privateReviewRoot, privateFile } from './local-study.ts';
import {
  createPrivateStudyRevision,
  STUDY_SOURCE_FILE,
  STUDY_REVISION_FILE,
} from '../src/lib/sermons/private-study.ts';

const { values } = parseArgs({
  options: { 'editorial-approval': { type: 'boolean' } },
});
const root = await privateReviewRoot();
const study = createPrivateStudyRevision(
  await privateFile(root, STUDY_SOURCE_FILE),
  await privateFile(root, 'first-sermon-approved.txt'),
  JSON.parse(
    (await privateFile(root, 'first-sermon-r1.bundle.json')).toString(),
  ),
  new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  values['editorial-approval'] === true,
);
await writeFile(
  path.join(root, STUDY_REVISION_FILE),
  `${JSON.stringify(study, null, 2)}\n`,
  { flag: 'wx', mode: 0o600 },
);
console.log(
  `Saved private study ${study.revision}, linked to sermon ${study.sermon.revision}. Source SHA-256: ${study.source.sha256}. Editorial approval only; evidence unverified, publication draft.`,
);
