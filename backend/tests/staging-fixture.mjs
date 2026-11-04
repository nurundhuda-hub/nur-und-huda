// Synthetic credentials for the isolated demo emulator, NEVER cloud configuration.
import { createHash } from 'node:crypto';
export const fixtureA = 'A'.repeat(43);
export const fixtureB = 'B'.repeat(43);
export function stagingFixture(now = Date.now()) {
  return JSON.stringify({
    issuedAt: new Date(now - 1000).toISOString(),
    expiresAt: new Date(now + 3_600_000).toISOString(),
    hashes: [fixtureA, fixtureB].map((value) =>
      createHash('sha256').update(value).digest('hex'),
    ),
  });
}
