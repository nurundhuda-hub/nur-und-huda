import { createHash, timingSafeEqual } from 'node:crypto';
import { ApiError } from './core.js';

/** Mandatory staging-only capability gate. There is deliberately no public fallback. */
export function requireStagingAccess(
  raw: string,
  credential: string | undefined,
  now = Date.now(),
): void {
  let config: { issuedAt: string; expiresAt: string; hashes: string[] };
  try {
    config = JSON.parse(raw);
    const issued = Date.parse(config.issuedAt),
      expires = Date.parse(config.expiresAt);
    if (
      !Number.isFinite(issued) ||
      !Number.isFinite(expires) ||
      issued > now ||
      expires <= now ||
      expires <= issued ||
      expires - issued > 72 * 3_600_000 ||
      !Array.isArray(config.hashes) ||
      config.hashes.length < 1 ||
      config.hashes.length > 2 ||
      new Set(config.hashes).size !== config.hashes.length ||
      config.hashes.some(
        (h) => typeof h !== 'string' || !/^[a-f0-9]{64}$/.test(h),
      )
    )
      throw new Error('Invalid staging configuration');
  } catch {
    throw new ApiError(403, 'STAGING_CLOSED');
  }
  if (!credential || !/^[A-Za-z0-9_-]{43}$/.test(credential))
    throw new ApiError(401, 'STAGING_ACCESS_REQUIRED');
  const digest = createHash('sha256').update(credential).digest();
  // Compare all configured hashes; no credential or hash is written to app logs.
  const matches = config.hashes.map((h) =>
    timingSafeEqual(digest, Buffer.from(h, 'hex')),
  );
  if (!matches.some(Boolean))
    throw new ApiError(401, 'STAGING_ACCESS_REQUIRED');
}
