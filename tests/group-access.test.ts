// @vitest-environment node
import { expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import {
  cookieToken,
  createGroupAccess,
  emptyAccess,
  pruneAccess,
  readGroupSecret,
  sessionCookie,
  SESSION_SECONDS,
  type AccessStore,
} from '../backend/functions/src/group-access';
import { groupCode, groupFixture } from '../backend/tests/group-fixture.mjs';
function setup() {
  const state = emptyAccess();
  let now = 1_800_000_000_000;
  let queue: Promise<unknown> = Promise.resolve();
  const store: AccessStore = {
    read: async () => structuredClone(state),
    transact: (work) => {
      const run = queue.then(() => work(state));
      queue = run.catch(() => {});
      return run;
    },
  };
  return {
    state,
    api: createGroupAccess(store, () => now),
    advance: (ms: number) => {
      now += ms;
    },
    now: () => now,
  };
}
const secret = readGroupSecret(groupFixture, true);
it('fails closed on missing/malformed secrets and rejects synthetic secrets in production', () => {
  for (const value of ['', '{}', 'null', groupFixture])
    expect(() => readGroupSecret(value)).toThrow('GROUP_CLOSED');
});
it('creates independent persistent opaque sessions without profiles or plaintext credentials', async () => {
  const s = setup();
  const [a, b] = await Promise.all([
    s.api.login(groupCode, secret),
    s.api.login(groupCode, secret),
  ]);
  expect(a).not.toBe(b);
  expect(await s.api.valid(a, secret)).toBe(true);
  expect(await s.api.valid(b, secret)).toBe(true);
  expect(JSON.stringify(s.state)).not.toContain(groupCode);
  expect(JSON.stringify(s.state)).not.toContain(a);
  const cookie = sessionCookie(a);
  expect(cookie).toContain(`Max-Age=${SESSION_SECONDS}`);
  for (const attribute of ['Secure', 'HttpOnly', 'SameSite=Lax', 'Path=/'])
    expect(cookie).toContain(attribute);
  expect(cookie).not.toContain('Domain=');
  expect(cookieToken('__session=' + a)).toBe(a);
  expect(cookieToken('__session=' + a + '; __session=' + b)).toBeNull();
  expect(await s.api.valid('x'.repeat(43), secret)).toBe(false);
  await s.api.logout(a);
  expect(await s.api.valid(a, secret)).toBe(false);
  expect(await s.api.valid(b, secret)).toBe(true);
  expect(sessionCookie('', true)).toContain('Max-Age=0');
});
it('revokes old sessions on code epoch rotation and removes expired records', async () => {
  const s = setup(),
    token = await s.api.login(groupCode, secret);
  expect(await s.api.valid(token, { ...secret, epoch: 'ef'.repeat(32) })).toBe(
    false,
  );
  s.advance(SESSION_SECONDS * 1000 - 1);
  expect(await s.api.valid(token, secret)).toBe(true);
  s.advance(1);
  expect(await s.api.valid(token, secret)).toBe(false);
  pruneAccess(s.state, s.now());
  expect(s.state.sessions).toEqual({});
});
it('enforces shared persistent login limits before derivation, without storing failed codes or IP addresses', async () => {
  const s = setup();
  for (let n = 0; n < 60; n++)
    await expect(s.api.login('wrong', secret)).rejects.toThrow(
      'INVALID_ACCESS_CODE',
    );
  await expect(s.api.login(groupCode, secret)).rejects.toThrow('RATE_LIMITED');
  expect(JSON.stringify(s.state)).not.toContain('wrong');
  s.advance(3_600_000);
  expect(await s.api.login(groupCode, secret)).toMatch(/^[A-Za-z0-9_-]{43}$/);
});
it('keeps Hosting empty and sends every path through the same protected gateway', () => {
  const config = JSON.parse(
    readFileSync('backend/firebase.private.json', 'utf8'),
  );
  expect(config.hosting.site).toBe('nour-und-huda');
  expect(config.hosting.public).toBe('hosting-empty');
  expect(config.hosting.rewrites).toEqual([
    {
      source: '**',
      function: { functionId: 'privateSite', region: 'europe-west3' },
    },
  ]);
  expect(readdirSync('backend/hosting-empty')).toEqual(['.gitkeep']);
  expect(config.hosting.redirects).toBeUndefined();
});
