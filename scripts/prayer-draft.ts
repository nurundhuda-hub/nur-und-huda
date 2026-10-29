import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  createCalculationDraft,
  type FridaySettings,
} from '../src/lib/prayer-calculation/adapter.ts';
import type { CalculationSettings } from '../src/lib/prayer-calculation/config.ts';

const { values } = parseArgs({
  options: Object.fromEntries(
    [
      'settings',
      'from',
      'through',
      'updated-at',
      'valid-from',
      'expires-at',
      'friday',
      'out',
    ].map((key) => [key, { type: 'string' as const }]),
  ),
});
const required = (key: string) => {
  const value = values[key];
  if (typeof value !== 'string' || !value)
    throw new Error(`Missing --${key}. See PRAYER_TIMES_VALIDATION.md.`);
  return value;
};
const output = path.resolve(required('out'));
const root = path.resolve('.prayer-review');
if (!output.startsWith(`${root}${path.sep}`))
  throw new Error(
    'Draft output must remain inside .prayer-review/; never write production data automatically.',
  );
const settings = JSON.parse(
  await readFile(required('settings'), 'utf8'),
) as CalculationSettings;
const friday =
  typeof values.friday === 'string'
    ? (JSON.parse(await readFile(values.friday, 'utf8')) as FridaySettings)
    : null;
const draft = createCalculationDraft(
  settings,
  required('from'),
  required('through'),
  {
    updatedAt: required('updated-at'),
    validFrom: required('valid-from'),
    expiresAt: required('expires-at'),
  },
  friday,
);
const settingsSha256 = createHash('sha256')
  .update(JSON.stringify(draft.settings))
  .digest('hex');
const payloadSha256 = createHash('sha256')
  .update(JSON.stringify(draft.data))
  .digest('hex');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify({ ...draft, settingsSha256, payloadSha256 }, null, 2)}\n`,
  { flag: 'wx' },
);
console.log(
  `REVIEW ONLY: ${output}\nSettings SHA-256: ${settingsSha256}\nPayload SHA-256: ${payloadSha256}\nDaily and Friday approvals remain pending. Production prayerData is unchanged.`,
);
