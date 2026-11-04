// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { requireStagingAccess } from '../backend/functions/src/staging-access';
const now = Date.parse('2026-11-04T10:00:00Z');
const a = 'A'.repeat(43),
  b = 'B'.repeat(43);
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const config = {
  issuedAt: new Date(now).toISOString(),
  expiresAt: new Date(now + 72 * 3_600_000).toISOString(),
  hashes: [digest(a), digest(b)],
};
it('allows only the two configured capabilities; no ownership token or origin bypasses access', () => {
  for (const key of [a, b])
    expect(() =>
      requireStagingAccess(JSON.stringify(config), key, now),
    ).not.toThrow();
  for (const key of [
    undefined,
    '',
    'C'.repeat(43),
    'Bearer ' + a,
    'https://nour-und-huda-staging.web.app',
  ])
    expect(() =>
      requireStagingAccess(JSON.stringify(config), key, now),
    ).toThrow('STAGING_ACCESS_REQUIRED');
});
it('fails closed on missing/malformed configuration, excessive duration, future issue date and expiry', () => {
  for (const value of [
    '',
    '{}',
    'null',
    JSON.stringify({ ...config, hashes: [] }),
    JSON.stringify({ ...config, hashes: [digest(a), digest(a)] }),
    JSON.stringify({
      ...config,
      expiresAt: new Date(now + 73 * 3_600_000).toISOString(),
    }),
  ])
    expect(() => requireStagingAccess(value, a, now)).toThrow('STAGING_CLOSED');
  expect(() =>
    requireStagingAccess(JSON.stringify(config), a, now - 1),
  ).toThrow('STAGING_CLOSED');
  expect(() =>
    requireStagingAccess(
      JSON.stringify(config),
      a,
      Date.parse(config.expiresAt),
    ),
  ).toThrow('STAGING_CLOSED');
});
it('supports revoking either credential without enabling public access', () => {
  const one = JSON.stringify({ ...config, hashes: [digest(b)] });
  expect(() => requireStagingAccess(one, a, now)).toThrow();
  expect(() => requireStagingAccess(one, b, now)).not.toThrow();
});
