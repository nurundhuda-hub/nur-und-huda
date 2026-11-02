import { firstRelease } from '../src/lib/sermons/first-release.ts';
if (
  !Number.isFinite(Date.parse(firstRelease.publishAt)) ||
  Date.now() < Date.parse(firstRelease.publishAt)
) {
  console.error('Embargo active; artifact upload/deployment refused.');
  process.exitCode = 1;
} else console.log('Authorized release instant has elapsed.');
