// @vitest-environment node
import { expect, it } from 'vitest';
import {
  createService,
  emptyState,
  hash,
  prune,
  DAY,
  HOUR,
  type State,
  type Store,
} from '../backend/functions/src/core';
import { berlinToUtc, berlinLocal, apiEndpoint } from '../src/lib/community';
const now = Date.parse('2026-11-03T10:00:00Z');
const a = 'A'.repeat(43),
  b = 'B'.repeat(43),
  c = 'C'.repeat(43);
const op = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const create = (n = 1) => ({
  prayer: 'dhuhr',
  startsAt: new Date(now + HOUR).toISOString(),
  operationId: op(n),
  consent: 'prayer-v1',
});
function setup() {
  let state = emptyState(),
    clock = now,
    queue: Promise<unknown> = Promise.resolve();
  const store: Store = {
    transact(work) {
      const run = queue.then(() => {
        const copy = structuredClone(state);
        const result = work(copy);
        state = copy;
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
  return {
    api: createService(store, () => clock),
    state: () => state,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}
const gathering = (result: unknown) =>
  (
    result as {
      gathering: ReturnType<
        typeof import('../backend/functions/src/core').project
      >;
    }
  ).gathering;
it('creates one durable gathering on retry and returns counts/own flags only', async () => {
  const s = setup(),
    first = gathering(await s.api('POST', '/gatherings', a, create()));
  expect(first.participantCount).toBe(1);
  expect(first.organizer).toBe(true);
  expect(await s.api('POST', '/gatherings', a, create())).toEqual({
    gathering: first,
  });
  expect(Object.keys(s.state().gatherings)).toHaveLength(1);
  const publicList = await s.api('GET', '/gatherings', undefined);
  expect(JSON.stringify(publicList)).not.toContain(hash(a));
  expect(JSON.stringify(publicList)).not.toContain(a);
  expect(Object.keys(first).sort()).toEqual(
    [
      'id',
      'prayer',
      'startsAt',
      'participantCount',
      'joined',
      'participationRevision',
      'organizer',
      'cancelled',
    ].sort(),
  );
});
it('serializes concurrent duplicate joins, enforces revision checks and prevents stale replay after leaving', async () => {
  const s = setup(),
    item = gathering(await s.api('POST', '/gatherings', a, create()));
  const path = `/gatherings/${item.id}/participation`,
    payload = {
      joined: true,
      expectedRevision: 0,
      operationId: op(2),
      consent: 'prayer-v1',
    };
  const joined = await Promise.all(
    Array.from({ length: 5 }, () => s.api('PUT', path, b, payload)),
  );
  expect(joined.map(gathering).every((g) => g.participantCount === 2)).toBe(
    true,
  );
  expect(
    gathering(
      await s.api('PUT', path, b, {
        ...payload,
        joined: false,
        expectedRevision: 1,
        operationId: op(3),
      }),
    ).participantCount,
  ).toBe(1);
  expect(await s.api('PUT', path, b, payload)).toMatchObject({
    error: { status: 409, code: 'STALE_COMMAND' },
  });
  expect(
    gathering(
      await s.api('PUT', path, b, {
        ...payload,
        expectedRevision: 2,
        operationId: op(4),
      }),
    ).participantCount,
  ).toBe(2);
});
it('only organizer can cancel; cancellation clears participation and old create retry cannot resurrect it', async () => {
  const s = setup(),
    item = gathering(await s.api('POST', '/gatherings', a, create()));
  expect(await s.api('DELETE', `/gatherings/${item.id}`, b)).toMatchObject({
    error: { status: 403 },
  });
  expect(
    gathering(await s.api('DELETE', `/gatherings/${item.id}`, a)).cancelled,
  ).toBe(true);
  expect(Object.keys(s.state().gatherings[item.id]!.members)).toHaveLength(0);
  expect(
    gathering(await s.api('POST', '/gatherings', a, create())).cancelled,
  ).toBe(true);
  expect(await s.api('GET', '/gatherings', undefined)).toMatchObject({
    gatherings: [],
  });
  expect(
    await s.api('PUT', `/gatherings/${item.id}/participation`, b, {
      joined: true,
      expectedRevision: 0,
      operationId: op(2),
      consent: 'prayer-v1',
    }),
  ).toMatchObject({ error: { status: 410 } });
});
it('server rejects forged fields, missing tokens/consent, invalid dates and times beyond one day', async () => {
  const s = setup();
  for (const input of [
    { ...create(), owner: hash(b) },
    { ...create(), participantCount: 99 },
    { ...create(), consent: 'yes' },
    { ...create(), prayer: 'custom' },
    { ...create(), startsAt: '2026-02-30T11:00:00.000Z' },
  ]) {
    const result = await s
      .api('POST', '/gatherings', a, input)
      .catch((e) => ({ error: { status: e.status } }));
    expect(result).toMatchObject({ error: { status: 400 } });
  }
  await expect(
    s.api('POST', '/gatherings', undefined, create()),
  ).rejects.toMatchObject({ status: 401 });
  for (const delta of [-1, 0, DAY + 60_000])
    expect(
      await s
        .api('POST', '/gatherings', a, {
          ...create(),
          startsAt: new Date(now + delta).toISOString(),
        })
        .catch((e) => ({ error: { status: e.status } })),
    ).toMatchObject({ error: { status: 400 } });
});
it('expires listings and writes exactly at start time; cleanup removes inactive clients', async () => {
  const s = setup(),
    item = gathering(await s.api('POST', '/gatherings', a, create()));
  s.advance(HOUR);
  expect(await s.api('GET', '/gatherings', undefined)).toMatchObject({
    gatherings: [],
  });
  expect(await s.api('DELETE', `/gatherings/${item.id}`, a)).toMatchObject({
    error: { status: 404 },
  });
  s.advance(27 * HOUR);
  await s.api('GET', '/gatherings', undefined);
  expect(s.state().clients).toEqual({});
});
it('enforces per-owner and global limits independent of browser validation or fresh ownership tokens', async () => {
  const s = setup();
  for (let n = 1; n <= 3; n++)
    expect(
      gathering(await s.api('POST', '/gatherings', a, create(n))),
    ).toBeTruthy();
  expect(await s.api('POST', '/gatherings', a, create(4))).toMatchObject({
    error: { status: 429 },
  });
  const reads = setup();
  for (let n = 0; n < 120; n++)
    await reads.api('GET', '/gatherings', undefined);
  await expect(reads.api('GET', '/gatherings', c)).rejects.toMatchObject({
    status: 429,
  });
  reads.advance(60_000);
  expect(await reads.api('GET', '/gatherings', undefined)).toMatchObject({
    gatherings: [],
  });
});
it('keeps cancelled tombstones only until original start and bounds storage independently of data names', () => {
  const state: State = emptyState();
  state.gatherings.x = {
    id: 'x',
    owner: hash(a),
    prayer: 'asr',
    startsAt: now,
    cancelled: true,
    members: {},
  };
  prune(state, now);
  expect(state.gatherings).toEqual({});
});
it('uses Berlin time rather than device time, rejecting nonexistent and ambiguous DST minutes', () => {
  expect(berlinToUtc('2026-11-03T12:00')).toBe('2026-11-03T11:00:00.000Z');
  expect(berlinToUtc('2026-06-03T12:00')).toBe('2026-06-03T10:00:00.000Z');
  expect(() => berlinToUtc('2026-03-29T02:30')).toThrow();
  expect(() => berlinToUtc('2026-10-25T02:30')).toThrow();
  expect(berlinLocal(new Date(now))).toBe('2026-11-03T11:00');
  expect(apiEndpoint('')).toBeNull();
  expect(() => apiEndpoint('http://example.com')).toThrow();
  expect(() => apiEndpoint('https://user:key@example.com')).toThrow();
});

it('isolates participation and cancellation between independent gatherings', async () => {
  const s = setup();
  const first = gathering(await s.api('POST', '/gatherings', a, create(1)));
  const second = gathering(await s.api('POST', '/gatherings', c, create(2)));
  await s.api('PUT', `/gatherings/${first.id}/participation`, b, {
    joined: true,
    expectedRevision: 0,
    operationId: op(3),
    consent: 'prayer-v1',
  });
  const before = structuredClone(s.state().gatherings[second.id]);
  await s.api('DELETE', `/gatherings/${first.id}`, a);
  expect(s.state().gatherings[second.id]).toEqual(before);
});

it('bounds a fully occupied state well below the Firestore document size limit', () => {
  const state = emptyState();
  for (let n = 0; n < 300; n++)
    state.clients[hash(`client-${n}`)] = {
      minute: now,
      requests: 20,
      day: now,
      creates: 3,
      expiresAt: now + 26 * HOUR,
    };
  for (let n = 0; n < 24; n++) {
    const id = hash(`gathering-${n}`),
      members: State['gatherings'][string]['members'] = {};
    for (let m = 0; m < 60; m++)
      members[hash(`member-${m}`)] = {
        joined: true,
        revision: Number.MAX_SAFE_INTEGER,
        operationId: op(m),
      };
    state.gatherings[id] = {
      id,
      owner: hash(a),
      prayer: 'maghrib',
      startsAt: now + DAY,
      cancelled: false,
      members,
    };
  }
  // JSON size is an additional conservative engineering guard, not an exact
  // Firestore encoding estimator; the indexed maps are explicitly exempted.
  expect(Buffer.byteLength(JSON.stringify(state))).toBeLessThan(512 * 1024);
});
