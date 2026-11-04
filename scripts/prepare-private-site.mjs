// Server-only packaging. An explicit flag permits the separately authorized exact pair.
import { execFileSync } from 'node:child_process';
import { readdir, readFile, mkdir, rm, cp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const includeSermon = process.argv.includes('--approved-sermon');
if (process.env.NUR_PRIVATE_SERMON_RELEASE && !includeSermon)
  throw Error('Use --approved-sermon explicitly.');
const approvedRelease = includeSermon
  ? (await import('./private-sermon-release.ts')).loadPrivateRelease(true)
  : null;
const env = {
  ...process.env,
  NUR_PRIVATE_SERMON_RELEASE: includeSermon ? 'true' : 'false',
  PUBLIC_PRAYER_MODE: 'group',
  PUBLIC_PRAYER_LIVE_APPROVED: 'true',
  PUBLIC_PRAYER_API_URL: '/nur-und-huda/api',
};
for (const command of ['build', 'validate'])
  execFileSync('npm', ['run', command], { env, stdio: 'inherit' });
const target = 'backend/functions/private-site';
// Fixed generated directory only; never points at private review sources.
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp('dist', path.join(target, 'site'), { recursive: true });
// GitHub Pages marker is not a website resource and is never served here.
await rm(path.join(target, 'site/.nojekyll'), { force: true });
const files = {};
async function walk(relative = '') {
  for (const item of await readdir(path.join(target, 'site', relative), {
    withFileTypes: true,
  })) {
    const name = path.posix.join(relative, item.name);
    if (
      item.isSymbolicLink() ||
      name.split('/').some((part) => part.startsWith('.'))
    )
      throw Error('Private package cannot contain hidden paths or links');
    if (item.isDirectory()) await walk(name);
    else
      files[name] = createHash('sha256')
        .update(await readFile(path.join(target, 'site', name)))
        .digest('hex');
  }
}
await walk();
await writeFile(
  path.join(target, 'manifest.json'),
  JSON.stringify(
    {
      schema: 1,
      audience: 'private-group',
      base: '/nur-und-huda/',
      files,
      ...(approvedRelease
        ? { privateReleaseSha256: approvedRelease.grantSha256 }
        : {}),
    },
    null,
    2,
  ) + '\n',
);
execFileSync(process.execPath, ['scripts/check-private-package.mjs'], {
  stdio: 'inherit',
});
console.log(
  'Prepared a server-only bundle. No deployment or access activation.',
);
