import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { assertPrivateSermonAbsent } from './sermon-privacy.mjs';
const config = JSON.parse(
  await readFile('backend/firebase.private.json', 'utf8'),
);
assert.equal(config.hosting.site, 'nour-und-huda');
assert.equal(config.hosting.public, 'hosting-empty');
assert.deepEqual(config.hosting.rewrites, [
  {
    source: '**',
    function: { functionId: 'privateSite', region: 'europe-west3' },
  },
]);
assert.ok(
  !config.hosting.redirects &&
    !config.hosting.cleanUrls &&
    !config.hosting.i18n,
);
assert.deepEqual(
  (await readdir('backend/hosting-empty')).filter((p) => p !== '.gitkeep'),
  [],
  'Hosting static directory must contain no website files',
);
const root = 'backend/functions/private-site';
const manifest = JSON.parse(
  await readFile(path.join(root, 'manifest.json'), 'utf8'),
);
assert.equal(manifest.audience, 'private-group');
assert.equal(manifest.base, '/nur-und-huda/');
const originals = [];
const secrets = [];
try {
  const code = (
    await readFile(
      '.prayer-review/group-production-access/access-code.txt',
      'utf8',
    )
  ).trim();
  const config = JSON.parse(
    await readFile(
      '.prayer-review/group-production-access/secret.json',
      'utf8',
    ),
  );
  secrets.push(
    code,
    code.replace(/-/g, ''),
    config.salt,
    config.digest,
    config.epoch,
  );
  assert.ok(
    secrets.every((value) => typeof value === 'string' && value.length >= 16),
  );
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
for (const name of ['first-sermon-approved.txt', 'study-001-approved.md']) {
  try {
    originals.push(await readFile('.sermon-review/' + name, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}
const seen = [];
async function walk(relative = '') {
  for (const item of await readdir(path.join(root, 'site', relative), {
    withFileTypes: true,
  })) {
    const name = path.posix.join(relative, item.name);
    assert.ok(
      !item.isSymbolicLink() && !name.split('/').some((p) => p.startsWith('.')),
    );
    if (item.isDirectory()) {
      await walk(name);
      continue;
    }
    assert.match(
      name,
      /^[A-Za-z0-9_./-]+\.(html|css|js|json|txt|xml|svg|webp|png|jpe?g|woff2?|ico)$/,
    );
    assert.ok(Object.hasOwn(manifest.files, name));
    const file = await readFile(path.join(root, 'site', name));
    assert.equal(
      createHash('sha256').update(file).digest('hex'),
      manifest.files[name],
    );
    const text = file.toString('utf8');
    assert.ok(
      secrets.every((secret) => !text.includes(secret)),
      `Private credential found in ${name}`,
    );
    originals.forEach((source) => assertPrivateSermonAbsent(text, source));
    for (const marker of [
      '.sermon-review',
      '.prayer-review',
      '/_review/',
      'NUR_GROUP_ACCESS',
      'ABCD-EFGH-JKLM-NPQR',
    ])
      assert.ok(!text.includes(marker), `Forbidden marker in ${name}`);
    seen.push(name);
  }
}
await walk();
assert.deepEqual(seen.sort(), Object.keys(manifest.files).sort());
for (const file of [
  'index',
  'together',
  'sermons',
  'quran',
  'library',
  'legal',
]) {
  const html = await readFile(path.join(root, 'site', file + '.html'), 'utf8');
  assert.ok(html.includes('data-group-site="true"'));
  assert.ok(html.includes('data-group-logout'));
}
const prayer = await readFile(path.join(root, 'site/together.html'), 'utf8');
assert.ok(prayer.includes('data-api="/nur-und-huda/api"'));
assert.ok(!prayer.includes('data-staging-login'));
console.log(
  `PASS: ${seen.length} protected files, empty Hosting directory, exact function rewrite, private-content exclusion, same-origin prayer API.`,
);
