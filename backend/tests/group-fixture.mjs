import { scryptSync } from 'node:crypto';
// Intentionally recognizable, non-production fixture. Runtime rejects its purpose outside the emulator.
export const groupCode = 'ABCD-EFGH-JKLM-NPQR';
const salt = 'ab'.repeat(32);
export const groupFixture = JSON.stringify({
  purpose: 'synthetic-test',
  salt,
  digest: scryptSync(
    groupCode.replaceAll('-', ''),
    Buffer.from(salt, 'hex'),
    64,
  ).toString('hex'),
  epoch: 'cd'.repeat(32),
});
