import { appendFileSync } from 'node:fs';
import { firstRelease } from '../src/lib/sermons/first-release.ts';
import { automaticGate } from '../src/lib/sermons/automatic-policy.ts';
const status = automaticGate(
  {
    repository: process.env.GITHUB_REPOSITORY ?? '',
    ref: process.env.GITHUB_REF ?? '',
    enabled: process.env.NUR_SERMON_AUTO_ENABLED ?? '',
    mode: process.env.NUR_RELEASE_MODE ?? '',
    scheduled: process.env.GITHUB_EVENT_NAME === 'schedule',
    now: Date.now(),
  },
  firstRelease.publishAt,
);
if (process.env.GITHUB_OUTPUT)
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `due=${status === 'due'}\nstatus=${status}\n`,
  );
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Sermon release\nStatus: **${status}**. Earliest release: ${firstRelease.publishAt}.\nNo release success is claimed by this gate.\n`,
  );
console.log(`Release gate: ${status}.`);
if (status === 'retry-window-ended')
  console.log(
    '::warning::Automatic retry window ended; inspect the last result and use manual release dispatch.',
  );
