// Supervised local release. No cron, background job, server endpoint or stored credentials.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { privateFile, privateReviewRoot } from './local-study.ts';
import {
  firstRelease,
  firstReleaseCatalogSha256,
} from '../src/lib/sermons/first-release.ts';
import { checkScheduledRelease } from '../src/lib/sermons/scheduled-release.ts';
import {
  bytesDigest,
  inspectReleaseOutput,
  publicBase,
  repository,
  requireReleaseTime,
  retryVerification,
  validateReleaseCatalog,
  verifyPublicFiles,
} from './pages-release-support.ts';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    catalog: { type: 'string' },
    'confirm-sha256': { type: 'string' },
    receipt: { type: 'string' },
  },
});
const action = positionals[0];
if (
  positionals.length !== 1 ||
  !['check', 'publish', 'verify'].includes(action!)
)
  throw new Error('Choose check, publish or verify.');
const privateRoot = await privateReviewRoot();
const run = (
  command: string,
  args: string[],
  cwd = process.cwd(),
  input?: string | Buffer,
) =>
  execFileSync(command, args, {
    cwd,
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 180000,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      SERMON_BUILD_AT: undefined,
      BASE_URL: undefined,
      NODE_ENV: 'production',
      MODE: undefined,
      DEV: undefined,
      PROD: undefined,
    },
  }).trim();
const report = (message: string) => console.log(message);
const verifyDeployment = async (
  commit: string,
  files: Record<string, string>,
) => {
  const build = JSON.parse(
    run('gh', ['api', `repos/${repository}/pages/builds/latest`]),
  );
  if (build.status !== 'built' || build.commit !== commit)
    throw new Error(
      'Pages has not completed the expected distribution commit.',
    );
  await verifyPublicFiles(files);
};
let phase = 'preflight',
  temp: string | undefined,
  lockOwned = false;
const receipt: { [key: string]: unknown } = {
  state: 'started',
  startedAt: new Date().toISOString(),
  notBefore: firstRelease.publishAt,
};
const receiptFile = path.join(
  privateRoot,
  `release-run-${Date.now()}-${randomUUID()}.json`,
);
const save = async () =>
  writeFile(receiptFile, JSON.stringify(receipt, null, 2) + '\n', {
    mode: 0o600,
  });
try {
  if (action === 'verify') {
    requireReleaseTime(firstRelease);
    const saved = JSON.parse(
      (await privateFile(privateRoot, values.receipt ?? '')).toString(),
    );
    if (
      saved.catalogSha256 !== firstReleaseCatalogSha256 ||
      saved.repository !== repository ||
      !saved.files ||
      !/^[0-9a-f]{40}$/.test(saved.releaseCommit ?? '')
    )
      throw new Error('Invalid local release receipt.');
    const catalog = JSON.parse(
      (
        await privateFile(
          privateRoot,
          values.catalog ?? 'task27-public-catalog.json',
        )
      ).toString(),
    );
    validateReleaseCatalog(catalog, firstRelease, firstReleaseCatalogSha256);
    checkScheduledRelease(catalog, saved.manifest, firstRelease, Date.now());
    if (
      bytesDigest(Buffer.from(JSON.stringify(saved.manifest))) !==
        saved.files['sermon-publication.json'] ||
      [
        ...saved.manifest.pages,
        ...saved.manifest.downloads,
        'sermons.html',
      ].some((file) => !saved.files[file])
    )
      throw new Error('Receipt is missing or changed release output.');
    phase = 'verify';
    await retryVerification(
      () => verifyDeployment(saved.releaseCommit, saved.files),
      () => new Promise((resolve) => setTimeout(resolve, 10000)),
    );
    Object.assign(receipt, saved, {
      state: 'verified',
      verifiedAt: new Date().toISOString(),
      reverifiedFrom: values.receipt,
    });
    await save();
    report(`Verified public release ${saved.releaseCommit} at ${publicBase}`);
  } else {
    const catalog = JSON.parse(
      (
        await privateFile(
          privateRoot,
          values.catalog ?? 'task27-public-catalog.json',
        )
      ).toString(),
    );
    validateReleaseCatalog(catalog, firstRelease, firstReleaseCatalogSha256);
    report(
      'Exact approved catalog and owner-estimated duration validated; no human timing claimed.',
    );
    if (action === 'check') {
      requireReleaseTime(firstRelease);
      report('Embargo elapsed. Use publish explicitly to build and deploy.');
    } else {
      requireReleaseTime(firstRelease); // Before builds, Git/network writes or public payload transfer.
      if (values['confirm-sha256'] !== firstReleaseCatalogSha256)
        throw new Error('Confirm the exact public catalog SHA-256.');
      if (
        run('git', ['branch', '--show-current']) !==
          'codex/audit-and-rebuild' ||
        run('git', ['status', '--porcelain'])
      )
        throw new Error('Use a clean codex/audit-and-rebuild checkout.');
      const remote = run('git', ['remote', 'get-url', 'origin']);
      if (
        ![
          `https://github.com/${repository}.git`,
          `https://github.com/${repository}`,
          `git@github.com:${repository}.git`,
        ].includes(remote)
      )
        throw new Error('Wrong repository.');
      const sourceCommit = run('git', ['rev-parse', 'HEAD']);
      const tracked = run('git', [
        'ls-tree',
        '-r',
        '--name-only',
        sourceCommit,
      ]).split('\n');
      if (
        tracked.some(
          (file) =>
            file.startsWith('.sermon-review/') ||
            /(^|\/)\.env(?:$|\.(?!example$))/.test(file),
        )
      )
        throw new Error(
          'Private review or environment file tracked in release source.',
        );
      receipt.sourceCommit = sourceCommit;
      receipt.repository = repository;
      receipt.catalogSha256 = firstReleaseCatalogSha256;
      phase = 'verify-source';
      report('Running complete verification on safe source checkout.');
      run('npm', ['run', 'verify']);
      const pages = JSON.parse(run('gh', ['api', `repos/${repository}/pages`]));
      if (
        pages.build_type !== 'legacy' ||
        pages.cname ||
        !['main', 'gh-pages'].includes(pages.source?.branch) ||
        pages.source?.path !== '/'
      )
        throw new Error(
          'Unexpected Pages configuration; inspect before changing it.',
        );
      receipt.previousPagesSource = pages.source;
      const name = run('git', ['config', 'user.name']),
        email = run('git', ['config', 'user.email']);
      if (!name || !email)
        throw new Error('Configured Git author identity is required.');
      // A single local publisher; an interrupted process leaves a lock for deliberate recovery.
      await mkdir(path.join(privateRoot, 'release-publish.lock'));
      lockOwned = true;
      receipt.lockAcquired = true;
      temp = await mkdtemp(path.join(privateRoot, 'release-build-'));
      phase = 'build';
      const archive = execFileSync('git', ['archive', sourceCommit], {
        maxBuffer: 64 * 1024 * 1024,
      });
      run('tar', ['-xf', '-', '-C', temp], process.cwd(), archive);
      await symlink(
        path.resolve('node_modules'),
        path.join(temp, 'node_modules'),
        'dir',
      );
      await writeFile(
        path.join(temp, 'src/content/sermons.ts'),
        `export const sermonCatalog = ${JSON.stringify(catalog)} as import('../lib/sermons/model.ts').SermonCatalog;\n`,
        { mode: 0o600 },
      );
      report('Building authorized catalog in a private isolated directory.');
      run('npm', ['run', 'build'], temp);
      run('npm', ['run', 'validate'], temp);
      const dist = path.join(temp, 'dist');
      await writeFile(path.join(dist, '.nojekyll'), '');
      const checked = await inspectReleaseOutput(dist, catalog, firstRelease);
      receipt.files = checked.files;
      receipt.manifest = checked.manifest;
      const output = path.join(temp, 'publish');
      await mkdir(output);
      run('git', ['init', '-b', 'gh-pages'], output);
      run('git', ['remote', 'add', 'origin', remote], output);
      phase = 'prepare-push';
      const prior = run(
        'git',
        ['ls-remote', '--heads', 'origin', 'refs/heads/gh-pages'],
        output,
      );
      if (prior) {
        run(
          'git',
          ['fetch', '--depth=1', 'origin', 'refs/heads/gh-pages'],
          output,
        );
        run('git', ['checkout', '-B', 'gh-pages', 'FETCH_HEAD'], output);
        // Remove only files in the temporary distribution checkout, never the working tree.
        for (const file of await readdir(output))
          if (file !== '.git')
            await rm(path.join(output, file), { recursive: true, force: true });
      }
      await cp(dist, output, { recursive: true });
      run('git', ['add', '--all'], output);
      const staged = run('git', ['ls-files', '-z'], output)
        .split('\0')
        .filter(Boolean)
        .sort();
      if (
        JSON.stringify(staged) !==
        JSON.stringify(Object.keys(checked.files).sort())
      )
        throw new Error('Distribution contains unexpected or missing files.');
      for (const file of staged)
        if (
          bytesDigest(await readFile(path.join(output, file))) !==
          checked.files[file]
        )
          throw new Error('Distribution changed after verification.');
      run(
        'git',
        [
          '-c',
          `user.name=${name}`,
          '-c',
          `user.email=${email}`,
          'commit',
          '--allow-empty',
          '-m',
          `Release approved r1/r2 from ${sourceCommit}`,
        ],
        output,
      );
      receipt.releaseCommit = run('git', ['rev-parse', 'HEAD'], output);
      await save();
      requireReleaseTime(firstRelease);
      phase = 'push';
      report('Publishing checked static files to gh-pages; main is unchanged.');
      run('git', ['push', 'origin', 'HEAD:refs/heads/gh-pages'], output); // Fast-forward only; concurrent pushes fail safely.
      receipt.pushed = true;
      await save();
      requireReleaseTime(firstRelease);
      phase = 'configure-pages';
      run(
        'gh',
        ['api', `repos/${repository}/pages`, '--method', 'PUT', '--input', '-'],
        process.cwd(),
        JSON.stringify({
          build_type: 'legacy',
          source: { branch: 'gh-pages', path: '/' },
        }),
      );
      receipt.pagesSourceChanged = true;
      await save();
      phase = 'verify-public';
      report(
        'Waiting for actual public bytes; dispatch/push alone is not success.',
      );
      await retryVerification(
        () => verifyDeployment(String(receipt.releaseCommit), checked.files),
        () => new Promise((resolve) => setTimeout(resolve, 10000)),
      );
      receipt.state = 'verified';
      receipt.verifiedAt = new Date().toISOString();
      await save();
      for (const file of [
        ...checked.manifest.pages,
        ...checked.manifest.downloads,
      ])
        report(publicBase + file);
      report(
        `Verified deployment ${receipt.releaseCommit}. Receipt: ${path.basename(receiptFile)}`,
      );
    }
  }
} catch (error) {
  receipt.state = 'failed';
  receipt.failedPhase = phase;
  receipt.finishedAt = new Date().toISOString();
  // Avoid persisting command buffers which could contain content or credentials.
  receipt.error =
    error instanceof Error ? error.message.split('\n')[0] : 'Release failed';
  await save();
  console.error(
    `Release failed at ${phase}; publication is NOT verified. ${receipt.error}\nPrivate receipt: ${path.basename(receiptFile)}. Fix the cause and rerun; do not backdate or force-push.`,
  );
  process.exitCode = 1;
} finally {
  if (temp) await rm(temp, { recursive: true, force: true });
  if (lockOwned)
    await rm(path.join(privateRoot, 'release-publish.lock'), {
      recursive: true,
    });
}
