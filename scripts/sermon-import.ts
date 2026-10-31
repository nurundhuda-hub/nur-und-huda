import { readFile, lstat, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { educationalSeries } from '../src/content/educational-series.ts';
import {
  createPrivateSermonDraft,
  type DraftIntakeReview,
} from '../src/lib/sermons/drafts.ts';

const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    review: { type: 'string' },
    out: { type: 'string' },
  },
});
if (!values.input || !values.review || !values.out)
  throw new Error(
    'Required: --input FILE --review FILE --out FILE, all directly inside .sermon-review/.',
  );
const root = path.resolve('.sermon-review');
const paths = [values.input, values.review, values.out].map((p) =>
  path.resolve(p),
);
if (paths.some((p) => path.dirname(p) !== root) || new Set(paths).size !== 3)
  throw new Error(
    'Use three distinct files directly inside .sermon-review/; no public output is allowed.',
  );
if (
  (await lstat(root)).isSymbolicLink() ||
  (await realpath(root)) !== path.join(await realpath('.'), '.sermon-review')
)
  throw new Error('The private review directory must not be a symlink.');
for (const input of paths.slice(0, 2))
  if (!(await lstat(input)).isFile())
    throw new Error('Review inputs must be regular files, not symlinks.');
const source = await readFile(paths[0]!);
const review = JSON.parse(
  await readFile(paths[1]!, 'utf8'),
) as DraftIntakeReview;
const importedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const bundle = createPrivateSermonDraft(
  source,
  review,
  educationalSeries,
  importedAt,
);
await writeFile(paths[2]!, `${JSON.stringify(bundle, null, 2)}\n`, {
  flag: 'wx',
  mode: 0o600,
});
console.log(
  `Private draft pair saved: ${paths[2]}\nSource SHA-256: ${bundle.source.sha256}\nBoth records remain draft; Friday, publication and duration are unset. No public content changed.`,
);
