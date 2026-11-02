import { appendFile, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import type { SermonCatalog } from '../src/lib/sermons/model.ts';
import {
  firstRelease,
  firstReleaseCatalogSha256,
} from '../src/lib/sermons/first-release.ts';
import { automaticGate } from '../src/lib/sermons/automatic-policy.ts';
import { decryptCatalog, signReceipt } from './automatic-release-crypto.ts';
import { probeLiveRelease, receiptName } from './automatic-release-support.ts';
import {
  inspectReleaseOutput,
  repository,
  requireReleaseTime,
  retryVerification,
  validateReleaseCatalog,
} from './pages-release-support.ts';

const action = process.argv[2];
let phase = 'guard';
const output = async (name: string, value: string) => {
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
};
const summary = async (text: string) => {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, text + '\n');
};
const binding = {
  repository,
  catalogSha256: firstReleaseCatalogSha256,
  publishAt: firstRelease.publishAt,
};
const run = (args: string[]) =>
  execFileSync('npm', args, {
    stdio: 'pipe',
    timeout: 180000,
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      NUR_RELEASE_KEY: undefined,
      NUR_RELEASE_PAYLOAD: undefined,
      SERMON_BUILD_AT: undefined,
      BASE_URL: undefined,
      MODE: undefined,
      DEV: undefined,
      PROD: undefined,
      NODE_ENV: 'production',
    },
  });
let original: Buffer | undefined;
try {
  // Recheck independently of job conditions and earlier outputs. No secret reads before this.
  if (
    automaticGate(
      {
        repository: process.env.GITHUB_REPOSITORY ?? '',
        ref: process.env.GITHUB_REF ?? '',
        enabled: process.env.NUR_SERMON_AUTO_ENABLED ?? '',
        mode: 'release',
        scheduled: process.env.GITHUB_EVENT_NAME === 'schedule',
        now: Date.now(),
      },
      firstRelease.publishAt,
    ) !== 'due'
  )
    throw new Error();
  requireReleaseTime(firstRelease);
  if (
    !['prepare', 'verify'].includes(action ?? '') ||
    !/^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA ?? '')
  )
    throw new Error();
  phase = 'decrypt-and-validate';
  const key = process.env.NUR_RELEASE_KEY ?? '',
    payload = process.env.NUR_RELEASE_PAYLOAD ?? '';
  delete process.env.NUR_RELEASE_KEY;
  delete process.env.NUR_RELEASE_PAYLOAD;
  const catalog = decryptCatalog(payload, key, binding) as SermonCatalog;
  validateReleaseCatalog(catalog, firstRelease, firstReleaseCatalogSha256);
  phase = 'check-live';
  if (action === 'verify') {
    await retryVerification(
      async () => {
        if (
          (await probeLiveRelease(key, binding, catalog, firstRelease)) !==
          'already-live'
        )
          throw new Error('Not live');
      },
      () => new Promise((resolve) => setTimeout(resolve, 10000)),
      18,
    );
    await summary(
      '**Verified live:** approved sermon r1, study r2, navigation, offline download and site assets match the authenticated release receipt.',
    );
  } else {
    const live = await probeLiveRelease(key, binding, catalog, firstRelease);
    if (live === 'already-live') {
      await output('publish', 'false');
      await summary(
        '**Already live and verified.** Duplicate run skipped; no artifact upload or deployment.',
      );
    } else {
      requireReleaseTime(firstRelease);
      phase = 'build';
      original = await readFile('src/content/sermons.ts');
      await writeFile(
        'src/content/sermons.ts',
        `export const sermonCatalog = ${JSON.stringify(catalog)} as import('../lib/sermons/model.ts').SermonCatalog;\n`,
        { mode: 0o600 },
      );
      run(['run', 'build']);
      run(['run', 'validate']);
      const checked = await inspectReleaseOutput('dist', catalog, firstRelease);
      const receipt = signReceipt(
        {
          version: 1,
          catalogSha256: firstReleaseCatalogSha256,
          publishAt: firstRelease.publishAt,
          sourceCommit: process.env.GITHUB_SHA,
          manifest: checked.manifest,
          files: checked.files,
        },
        key,
        binding,
      );
      await writeFile(`dist/${receiptName}`, JSON.stringify(receipt), {
        mode: 0o644,
      });
      requireReleaseTime(firstRelease);
      await output('publish', 'true');
      await summary(
        '**Validated for deployment:** exact approved pair; embargo elapsed. Public availability is not yet verified.',
      );
    }
  }
} catch {
  // Never print subprocess buffers, decrypted JSON, exception snippets or secrets.
  if (action === 'prepare') await rm('dist', { recursive: true, force: true });
  await summary(
    `::error::Release failed during ${phase}. No live success is claimed. Inspect configuration; a later scheduled run or manual dispatch can retry. Private diagnostics are suppressed.`,
  );
  process.exitCode = 1;
} finally {
  if (original) await writeFile('src/content/sermons.ts', original);
}
