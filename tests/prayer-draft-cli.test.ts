import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { expect, it } from 'vitest';

it('writes an identifiable pending draft without changing production or overwriting files', () => {
  const output = `.prayer-review/test-${randomUUID()}.json`;
  const original = readFileSync('src/data/prayer-data.ts', 'utf8');
  const args = [
    '--experimental-strip-types',
    'scripts/prayer-draft.ts',
    '--settings',
    'validation/settings.example.json',
    '--from',
    '2027-06-20',
    '--through',
    '2027-06-22',
    '--updated-at',
    '2027-06-19T12:00:00Z',
    '--valid-from',
    '2027-06-20T22:00:00Z',
    '--expires-at',
    '2027-06-21T22:00:00Z',
    '--out',
    output,
  ];
  try {
    execFileSync(process.execPath, args, { encoding: 'utf8' });
    const contents = readFileSync(output, 'utf8');
    const draft = JSON.parse(contents);
    expect(draft.warning).toBe('REVIEW_ONLY_NOT_FOR_WORSHIP');
    expect(draft.data.daily.approval).toEqual({ status: 'pending' });
    expect(draft.data.friday).toBeNull();
    for (const [field, value] of [
      ['settingsSha256', draft.settings],
      ['payloadSha256', draft.data],
    ] as const) {
      expect(draft[field]).toBe(
        createHash('sha256').update(JSON.stringify(value)).digest('hex'),
      );
    }
    const duplicate = spawnSync(process.execPath, args, { encoding: 'utf8' });
    expect(duplicate.status).not.toBe(0);
    expect(duplicate.stderr).toContain('EEXIST');
    expect(readFileSync(output, 'utf8')).toBe(contents);
    const publicOutput = spawnSync(
      process.execPath,
      [...args.slice(0, -1), 'src/data/prayer-data.ts'],
      { encoding: 'utf8' },
    );
    expect(publicOutput.status).not.toBe(0);
    expect(publicOutput.stderr).toContain(
      'Draft output must remain inside .prayer-review/',
    );
    expect(readFileSync('src/data/prayer-data.ts', 'utf8')).toBe(original);
  } finally {
    rmSync(output, { force: true });
  }
});
