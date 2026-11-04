// @vitest-environment node
import { expect, it } from 'vitest';
import { allowsOrigin } from '../backend/functions/src/origins';

const staging = 'https://nour-und-huda-staging.web.app';
it('admits only the exact configured HTTPS origin', () => {
  expect(allowsOrigin(staging, staging)).toBe(true);
  for (const origin of [
    undefined,
    'null',
    `${staging}.evil.invalid`,
    'https://nour-und-huda.web.app',
  ])
    expect(allowsOrigin(staging, origin)).toBe(false);
});
it('fails closed on insecure or malformed origin configuration', () => {
  for (const invalid of [
    '',
    '*',
    'null',
    'http://example.com',
    `${staging}/`,
    `${staging}/path`,
    `${staging}?x=1`,
    `${staging}#x`,
    'https://user:password@example.com',
  ]) {
    expect(allowsOrigin(invalid, invalid)).toBe(false);
    expect(allowsOrigin(`${staging},${invalid}`, staging)).toBe(false);
  }
});
it('allows HTTP only for loopback in the isolated emulator', () => {
  const local = 'http://127.0.0.1:4343';
  expect(allowsOrigin(local, local)).toBe(false);
  expect(allowsOrigin(local, local, true)).toBe(true);
  expect(
    allowsOrigin('http://localhost:4343', 'http://localhost:4343', true),
  ).toBe(true);
  expect(
    allowsOrigin('http://remote.invalid', 'http://remote.invalid', true),
  ).toBe(false);
});
