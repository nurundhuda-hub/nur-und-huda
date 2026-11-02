import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { sermonCatalog } from '../src/content/sermons.ts';
import { educationalSeries } from '../src/content/educational-series.ts';
import {
  reviewRevision,
  approveRevision,
  preparePublication,
  authorizePublication,
} from '../src/lib/sermons/approval-workflow.ts';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: Object.fromEntries(
    [
      'source',
      'bundle',
      'candidate',
      'checks',
      'input',
      'out',
      'confirm-sha256',
      'publisher',
      'study-source',
      'study-bundle',
    ].map((name) => [name, { type: 'string' as const }]),
  ),
});
const action = positionals[0];
if (
  positionals.length !== 1 ||
  !['review', 'approve', 'prepare', 'authorize-publication'].includes(action!)
)
  throw new Error(
    'Choose review, approve, prepare or authorize-publication. See SERMON_CONTENT.md.',
  );
const root = path.resolve('.sermon-review');
if (
  (await lstat(root)).isSymbolicLink() ||
  (await realpath(root)) !== path.join(await realpath('.'), '.sermon-review')
)
  throw new Error('Private directory must not be a symlink.');
const file = (key: string) => {
  const value = values[key];
  if (typeof value !== 'string' || !value) throw new Error(`Missing --${key}.`);
  const resolved = path.resolve(value);
  if (path.dirname(resolved) !== root)
    throw new Error(
      'All workflow files must be directly inside .sermon-review/. No public writes.',
    );
  return resolved;
};
const read = async (key: string) => {
  const name = file(key);
  if (!(await lstat(name)).isFile())
    throw new Error('Input must be a regular file, not a symlink.');
  return readFile(name);
};
const json = async (key: string) =>
  JSON.parse((await read(key)).toString('utf8'));
const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const out = file('out');
if (
  Boolean(values['study-source']) !== Boolean(values['study-bundle']) ||
  (values['study-source'] && action !== 'review')
)
  throw new Error(
    'Supply --study-source and --study-bundle together for review only.',
  );
let result;
switch (action) {
  case 'review':
    result = reviewRevision(
      await read('source'),
      await json('bundle'),
      await json('candidate'),
      await json('checks'),
      sermonCatalog,
      educationalSeries,
      now,
      values['study-source']
        ? {
            source: await read('study-source'),
            revision: await json('study-bundle'),
          }
        : undefined,
    );
    break;
  case 'approve':
    result = approveRevision(
      await json('input'),
      String(values['confirm-sha256'] ?? ''),
      sermonCatalog,
      now,
    );
    break;
  case 'prepare':
    result = preparePublication(await json('input'), sermonCatalog, now);
    break;
  case 'authorize-publication':
    result = authorizePublication(
      await json('input'),
      String(values['confirm-sha256'] ?? ''),
      String(values.publisher ?? ''),
      sermonCatalog,
      now,
    );
    break;
}
await writeFile(out, `${JSON.stringify(result, null, 2)}\n`, {
  flag: 'wx',
  mode: 0o600,
});
console.log(
  `Local workflow: ${result!.state}\nSHA-256: ${result!.sha256}\nSaved privately: ${out}\nNo public source, Git commit, scheduler or deployment was changed.`,
);
