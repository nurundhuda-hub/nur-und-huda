import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { fixtureA, fixtureB } from './staging-fixture.mjs';
const project = 'demo-nur-prayer';
assert.equal(process.env.GCLOUD_PROJECT, project);
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8086');
const base =
  process.env.PRAYER_TEST_API_BASE ??
  `http://127.0.0.1:5001/${project}/europe-west3/prayerApi`;
// The optional harness endpoint must never redirect this synthetic suite to cloud.
assert.ok(
  base === `http://127.0.0.1:5001/${project}/europe-west3/prayerApi` ||
    base === 'http://127.0.0.1:5051',
);
const token = () => randomBytes(32).toString('base64url');
const a = token(),
  b = token();
async function call(
  path,
  method = 'GET',
  identity,
  body,
  origin = 'http://127.0.0.1:4343',
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      'X-Staging-Access': identity === b ? fixtureB : fixtureA,
      ...(identity ? { Authorization: `Bearer ${identity}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
for (const access of [undefined, 'C'.repeat(43)]) {
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    const denied = await fetch(base + '/gatherings', {
      method,
      headers: {
        Origin: 'http://127.0.0.1:4343',
        ...(access ? { 'X-Staging-Access': access } : {}),
      },
    });
    assert.equal(denied.status, 401);
    assert.equal((await denied.json()).error.code, 'STAGING_ACCESS_REQUIRED');
  }
}
const startsAt = new Date(
  Math.ceil(Date.now() / 60000) * 60000 + 600000,
).toISOString();
const command = {
  prayer: 'asr',
  startsAt,
  operationId: randomUUID(),
  consent: 'prayer-v1',
};
const created = await call('/gatherings', 'POST', a, command);
assert.equal(created.status, 200, JSON.stringify(created));
const id = created.body.gathering.id;
assert.equal(created.body.gathering.participantCount, 1);
assert.deepEqual(await call('/gatherings', 'POST', a, command), created);
const join = {
  joined: true,
  expectedRevision: 0,
  operationId: randomUUID(),
  consent: 'prayer-v1',
};
const results = await Promise.all(
  Array.from({ length: 3 }, () =>
    call(`/gatherings/${id}/participation`, 'PUT', b, join),
  ),
);
for (const r of results) {
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(r.body.gathering.participantCount, 2);
}
const publicList = await call('/gatherings');
assert.equal(publicList.status, 200);
assert.ok(!JSON.stringify(publicList).includes(a));
assert.ok(!JSON.stringify(publicList).includes(b));
assert.ok(!JSON.stringify(publicList).includes('members'));
assert.equal((await call(`/gatherings/${id}`, 'DELETE', b)).status, 403);
const leave = await call(`/gatherings/${id}/participation`, 'PUT', b, {
  ...join,
  joined: false,
  expectedRevision: 1,
  operationId: randomUUID(),
});
assert.equal(leave.body.gathering.participantCount, 1);
assert.equal(
  (await call(`/gatherings/${id}/participation`, 'PUT', b, join)).status,
  409,
);
assert.equal((await call(`/gatherings/${id}`, 'DELETE', a)).status, 200);
assert.equal(
  (await call('/gatherings', 'POST', a, command)).body.gathering.cancelled,
  true,
);
assert.equal((await call('/gatherings')).body.gatherings.length, 0);
assert.equal(
  (await call('/gatherings', 'POST', undefined, command)).status,
  401,
);
assert.equal(
  (
    await call(
      '/gatherings',
      'GET',
      undefined,
      undefined,
      'https://untrusted.invalid',
    )
  ).status,
  403,
);
assert.equal(
  (
    await call('/gatherings', 'POST', a, {
      ...command,
      name: 'must not persist',
    })
  ).status,
  400,
);
const direct = `http://127.0.0.1:8086/v1/projects/${project}/databases/(default)/documents/prayerService/state`;
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
  'PASS: actual HTTP + Firestore transaction, concurrent duplicate joins, owner-only cancel, stale replay, private projection, CORS, schema and deny-all Rules (synthetic emulator only).',
);

await import('./public-emulator.mjs');
