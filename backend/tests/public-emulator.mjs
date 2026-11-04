// Synthetic production-mode requests only; this file refuses every cloud target.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { fixtureA } from './staging-fixture.mjs';
assert.equal(process.env.GCLOUD_PROJECT, 'demo-nur-prayer');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8086');
const root = 'http://127.0.0.1:5001/demo-nur-prayer/europe-west3/';
const publicBase =
  process.env.PRAYER_TEST_PUBLIC_BASE ?? root + 'publicPrayerApi';
const stagingBase = process.env.PRAYER_TEST_API_BASE ?? root + 'prayerApi';
assert.ok(
  [root + 'publicPrayerApi', 'http://127.0.0.1:5051/public'].includes(
    publicBase,
  ),
);
assert.ok([root + 'prayerApi', 'http://127.0.0.1:5051'].includes(stagingBase));
const owner = randomBytes(32).toString('base64url');
const member = randomBytes(32).toString('base64url');
async function request(path, method = 'GET', token, body, staging = false) {
  const response = await fetch((staging ? stagingBase : publicBase) + path, {
    method,
    headers: {
      Origin: staging ? 'http://127.0.0.1:4343' : 'http://127.0.0.1:4344',
      ...(staging ? { 'X-Staging-Access': fixtureA } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
const command = {
  prayer: 'asr',
  startsAt: new Date(
    Math.ceil(Date.now() / 60000) * 60000 + 600000,
  ).toISOString(),
  operationId: randomUUID(),
  consent: 'prayer-v2',
  firstName: 'أحمد',
  note: 'Synthetic test',
};
assert.equal((await request('/gatherings')).status, 200);
assert.equal(
  (await request('/gatherings', 'POST', undefined, command)).status,
  401,
);
const created = await request('/gatherings', 'POST', owner, command);
assert.equal(created.status, 200, JSON.stringify(created));
assert.deepEqual(created.body.gathering.participantNames, ['أحمد']);
const id = created.body.gathering.id;
assert.deepEqual(await request('/gatherings', 'POST', owner, command), created);
// Simultaneous staging and public records must never cross either endpoint.
const staged = await request(
  '/gatherings',
  'POST',
  owner,
  {
    prayer: command.prayer,
    startsAt: command.startsAt,
    operationId: randomUUID(),
    consent: 'prayer-v1',
  },
  true,
);
assert.equal(staged.status, 200, JSON.stringify(staged));
const stagedId = staged.body.gathering.id;
const publicList = await request('/gatherings');
const privateList = await request(
  '/gatherings',
  'GET',
  undefined,
  undefined,
  true,
);
assert.ok(publicList.body.gatherings.some((g) => g.id === id));
assert.ok(!publicList.body.gatherings.some((g) => g.id === stagedId));
assert.ok(privateList.body.gatherings.some((g) => g.id === stagedId));
assert.ok(!privateList.body.gatherings.some((g) => g.id === id));
for (const forbidden of [owner, member, 'members', 'ownerHash'])
  assert.ok(!JSON.stringify(publicList).includes(forbidden));
const join = {
  joined: true,
  expectedRevision: 0,
  operationId: randomUUID(),
  consent: 'prayer-v2',
  firstName: 'Max',
};
for (const result of await Promise.all(
  Array.from({ length: 3 }, () =>
    request(`/gatherings/${id}/participation`, 'PUT', member, join),
  ),
)) {
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.body.gathering.participantCount, 2);
  assert.deepEqual(result.body.gathering.participantNames, ['أحمد', 'Max']);
}
assert.equal(
  (await request(`/gatherings/${id}`, 'DELETE', member)).status,
  403,
);
const left = await request(`/gatherings/${id}/participation`, 'PUT', member, {
  ...join,
  joined: false,
  firstName: '',
  expectedRevision: 1,
  operationId: randomUUID(),
});
assert.equal(left.status, 200);
assert.equal(left.body.gathering.participantCount, 1);
assert.deepEqual(left.body.gathering.participantNames, ['أحمد']);
assert.equal(
  (await request(`/gatherings/${id}/participation`, 'PUT', member, join))
    .status,
  409,
);
assert.equal(
  (
    await request('/gatherings', 'POST', owner, {
      ...command,
      name: 'not allowed',
    })
  ).status,
  400,
);
assert.equal((await request(`/gatherings/${id}`, 'DELETE', owner)).status, 200);
assert.equal(
  (await request(`/gatherings/${stagedId}`, 'DELETE', owner, undefined, true))
    .status,
  200,
);
assert.equal((await request('/gatherings')).body.gatherings.length, 0);
for (const origin of ['https://untrusted.invalid', 'http://127.0.0.1:4343']) {
  assert.equal(
    (await fetch(publicBase + '/gatherings', { headers: { Origin: origin } }))
      .status,
    403,
  );
}
// Spoofing the allowed staging origin without its credential remains insufficient.
assert.equal(
  (
    await fetch(stagingBase + '/gatherings', {
      headers: { Origin: 'http://127.0.0.1:4343' },
    })
  ).status,
  401,
);
const preflight = await fetch(publicBase + '/gatherings', {
  method: 'OPTIONS',
  headers: { Origin: 'http://127.0.0.1:4344' },
});
assert.equal(preflight.status, 204);
assert.ok(
  !preflight.headers.get('access-control-allow-headers').includes('Staging'),
);
const direct =
  'http://127.0.0.1:8086/v1/projects/demo-nur-prayer/databases/(default)/documents/prayerService/public';
assert.equal((await fetch(direct)).status, 403);
assert.equal(
  (
    await fetch(direct, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: {} }),
    })
  ).status,
  403,
);
console.log(
  'PASS: anonymous public API create/join/leave/cancel, concurrent duplicate protection, separate staging data, CORS, ownership, schema, and deny-all rules (synthetic emulator only).',
);
