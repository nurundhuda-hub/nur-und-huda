import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ApiError } from './core.js';
const derive = promisify(scrypt);
export const SESSION_SECONDS = 90 * 24 * 60 * 60;
export interface GroupSecret {
  purpose: 'production' | 'synthetic-test';
  salt: string;
  digest: string;
  epoch: string;
}
export interface AccessState {
  sessions: Record<
    string,
    { issuedAt: number; expiresAt: number; epoch: string }
  >;
  hour: number;
  attempts: number;
  day: number;
  dailyAttempts: number;
}
export interface AccessStore {
  read(): Promise<AccessState>;
  transact<T>(work: (state: AccessState) => T): Promise<T>;
}
export const emptyAccess = (): AccessState => ({
  sessions: {},
  hour: 0,
  attempts: 0,
  day: 0,
  dailyAttempts: 0,
});
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export function readGroupSecret(raw: string, emulator = false): GroupSecret {
  try {
    const value = JSON.parse(raw) as GroupSecret;
    if (
      (value.purpose !== 'production' &&
        !(emulator && value.purpose === 'synthetic-test')) ||
      !/^[a-f0-9]{64}$/.test(value.salt) ||
      !/^[a-f0-9]{128}$/.test(value.digest) ||
      !/^[a-f0-9]{64}$/.test(value.epoch)
    )
      throw Error();
    return value;
  } catch {
    throw new ApiError(503, 'GROUP_CLOSED');
  }
}
export function pruneAccess(state: AccessState, now: number) {
  for (const [id, session] of Object.entries(state.sessions))
    if (session.expiresAt <= now) delete state.sessions[id];
}
export function cookieToken(header: string | undefined): string | null {
  const entries = (header ?? '')
    .split(';')
    .map((v) => v.trim())
    .filter((v) => v.startsWith('__session='));
  if (entries.length !== 1) return null;
  const token = entries[0]!.slice('__session='.length);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
export function sessionCookie(token: string, clear = false) {
  return `__session=${clear ? '' : token}; Path=/; Max-Age=${clear ? 0 : SESSION_SECONDS}; Secure; HttpOnly; SameSite=Lax`;
}
export function createGroupAccess(
  store: AccessStore,
  clock: () => number = Date.now,
) {
  return {
    async login(code: unknown, secret: GroupSecret): Promise<string> {
      // Global transaction-based budget before the expensive password derivation.
      // No IP addresses, failed codes or individual profiles are retained.
      await store.transact((state) => {
        const now = clock(),
          hour = Math.floor(now / 3_600_000),
          day = Math.floor(now / 86_400_000);
        pruneAccess(state, now);
        if (state.hour !== hour) {
          state.hour = hour;
          state.attempts = 0;
        }
        if (state.day !== day) {
          state.day = day;
          state.dailyAttempts = 0;
        }
        if (state.attempts >= 60 || state.dailyAttempts >= 200)
          throw new ApiError(429, 'RATE_LIMITED');
        state.attempts++;
        state.dailyAttempts++;
      });
      if (typeof code !== 'string' || code.length > 64)
        throw new ApiError(401, 'INVALID_ACCESS_CODE');
      const normalized = code.toUpperCase().replace(/[ -]/g, '');
      if (!/^[A-Z2-9]{16}$/.test(normalized))
        throw new ApiError(401, 'INVALID_ACCESS_CODE');
      const digest = (await derive(
        normalized,
        Buffer.from(secret.salt, 'hex'),
        64,
      )) as Buffer;
      if (!timingSafeEqual(digest, Buffer.from(secret.digest, 'hex')))
        throw new ApiError(401, 'INVALID_ACCESS_CODE');
      const token = randomBytes(32).toString('base64url');
      await store.transact((state) => {
        const now = clock();
        pruneAccess(state, now);
        if (Object.keys(state.sessions).length >= 256)
          throw new ApiError(429, 'RATE_LIMITED');
        state.sessions[tokenHash(token)] = {
          issuedAt: now,
          expiresAt: now + SESSION_SECONDS * 1000,
          epoch: secret.epoch,
        };
      });
      return token;
    },
    async valid(token: string | null, secret: GroupSecret): Promise<boolean> {
      if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
      const session = (await store.read()).sessions[tokenHash(token)];
      const now = clock();
      return Boolean(
        session &&
        session.epoch === secret.epoch &&
        session.issuedAt <= now &&
        session.expiresAt > now &&
        session.expiresAt - session.issuedAt <= SESSION_SECONDS * 1000,
      );
    },
    async logout(token: string | null) {
      if (token)
        await store.transact((state) => {
          delete state.sessions[tokenHash(token)];
        });
    },
  };
}
