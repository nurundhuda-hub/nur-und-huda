import { readFile, mkdir, lstat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  importTimetable,
  parseStrictJson,
} from '../src/lib/local-timetable/importer.ts';
import { compareLocalTimetable } from '../src/lib/local-timetable/comparison.ts';
import type { CalculationSettings } from '../src/lib/prayer-calculation/config.ts';
import type { ReferenceSample } from '../src/lib/prayer-calculation/comparison.ts';

const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    manifest: { type: 'string' },
    out: { type: 'string' },
    'compare-settings': { type: 'string' },
  },
});
if (!values.input || !values.manifest || !values.out)
  throw new Error(
    'Required: --input FILE --manifest FILE --out .prayer-review/NAME.json. See LOCAL_TIMETABLE_REVIEW.md.',
  );
const root = path.resolve('.prayer-review'),
  output = path.resolve(values.out);
if (path.dirname(output) !== root)
  throw new Error('Output must be a file directly inside .prayer-review/.');
const manifest = parseStrictJson(await readFile(values.manifest, 'utf8'));
const review = importTimetable(await readFile(values.input), manifest); // No fixture bypass flag.
const comparison = values['compare-settings']
  ? compareLocalTimetable(
      review,
      JSON.parse(
        await readFile(values['compare-settings'], 'utf8'),
      ) as CalculationSettings,
      (
        JSON.parse(
          await readFile('validation/prayer-references.json', 'utf8'),
        ) as { samples: ReferenceSample[] }
      ).samples,
    )
  : null;
await mkdir(root, { recursive: true });
if ((await lstat(root)).isSymbolicLink())
  throw new Error('The review directory must not be a symlink.');
await writeFile(
  output,
  `${JSON.stringify({ ...review, comparison }, null, 2)}\n`,
  { flag: 'wx' },
);
console.log(
  `Pending local review only: ${output}\nNormalized SHA-256: ${review.normalizedSha256}\nFreshness: ${review.freshness}. No production data, approval or hospital Friday settings changed.`,
);
