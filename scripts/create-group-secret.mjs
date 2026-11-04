import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes, scryptSync } from 'node:crypto';
// Creates local, ignored operator material only. Does not upload, deploy or rotate a live secret.
const root = '.prayer-review/group-production-access';
await mkdir('.prayer-review', { recursive: true, mode: 0o700 });
await mkdir(root, { mode: 0o700 }); // Refuse to overwrite an earlier code/rotation packet.
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const raw = [...randomBytes(16)].map((n) => alphabet[n & 31]).join('');
const code = raw.match(/.{4}/g).join('-');
const salt = randomBytes(32).toString('hex');
const secret = {
  purpose: 'production',
  salt,
  digest: scryptSync(raw, Buffer.from(salt, 'hex'), 64).toString('hex'),
  epoch: randomBytes(32).toString('hex'),
};
await writeFile(root + '/access-code.txt', code + '\n', {
  flag: 'wx',
  mode: 0o600,
});
await writeFile(root + '/secret.json', JSON.stringify(secret) + '\n', {
  flag: 'wx',
  mode: 0o600,
});
console.log(
  'Created local access-code.txt and secret.json in .prayer-review/group-production-access/ (private permissions). No values printed; no cloud changes.',
);
