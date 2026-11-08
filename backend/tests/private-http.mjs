// Compiled private API coverage without a browser or generated site dependency.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createECDH } from 'node:crypto';
import { groupCode } from './group-fixture.mjs';
export async function checkPrivateApi(base) {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-nur-prayer');
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8086');
  assert.ok(
    [
      'http://127.0.0.1:5051/group',
      'http://127.0.0.1:5001/demo-nur-prayer/europe-west3/privateSite',
    ].includes(base),
  );
  const api = '/nur-und-huda/api/gatherings';
  assert.equal((await fetch(base + api)).status, 401);
  const login = await fetch(base + '/access', {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Origin: 'https://localhost:4443',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ code: groupCode }),
  });
  assert.equal(login.status, 303);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const a = randomBytes(32).toString('base64url'),
    b = randomBytes(32).toString('base64url');
  async function call(route, method = 'GET', token, body) {
    const r = await fetch(base + route, {
      method,
      headers: {
        Origin: 'https://localhost:4443',
        Cookie: cookie,
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(token ? { 'X-Push-Device': token } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, body: await r.json() };
  }
  const command = {
    prayer: 'asr',
    startsAt: new Date(
      Math.ceil(Date.now() / 60000) * 60000 + 600000,
    ).toISOString(),
    firstName: 'أحمد',
    note: 'Synthetic group test',
    consent: 'prayer-v2',
    operationId: randomUUID(),
  };
  const pushApi = '/nur-und-huda/api/push';
  assert.equal((await fetch(base + pushApi + '/config')).status, 401);
  assert.equal((await call(pushApi + '/config')).body.publicKey.length, 87);
  function subscription(id) {
    const ec = createECDH('prime256v1');
    ec.generateKeys();
    return {
      endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic-' + id,
      keys: {
        auth: randomBytes(16).toString('base64url'),
        p256dh: ec.getPublicKey().toString('base64url'),
      },
    };
  }
  for (const token of [a, b]) {
    const r = await call(
      pushApi + '/subscription',
      'PUT',
      token,
      subscription(token),
    );
    assert.equal(r.status, 200);
    assert.equal(r.body.subscribed, true);
    assert.deepEqual(Object.keys(r.body).sort(), ['expiresAt', 'subscribed']);
  }
  assert.equal(
    (
      await call(pushApi + '/subscription', 'PUT', a, {
        endpoint: 'https://127.0.0.1/private',
      })
    ).status,
    400,
  );
  const stagingRoot = base.includes(':5051')
    ? 'http://127.0.0.1:5051'
    : base.replace('/privateSite', '/prayerApi');
  const publicRoot = base.includes(':5051')
    ? 'http://127.0.0.1:5051/public'
    : base.replace('/privateSite', '/publicPrayerApi');
  const { fixtureA } = await import('./staging-fixture.mjs');
  const otherIds = [];
  for (const [root, origin, staged] of [
    [stagingRoot, 'http://127.0.0.1:4343', true],
    [publicRoot, 'http://127.0.0.1:4344', false],
  ]) {
    const body = staged
      ? {
          prayer: command.prayer,
          startsAt: command.startsAt,
          operationId: randomUUID(),
          consent: 'prayer-v1',
        }
      : { ...command, operationId: randomUUID() };
    const headers = {
      Origin: origin,
      Authorization: 'Bearer ' + a,
      'Content-Type': 'application/json',
      ...(staged ? { 'X-Staging-Access': fixtureA } : {}),
    };
    const response = await fetch(root + '/gatherings', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 200);
    otherIds.push([root, headers, (await response.json()).gathering.id]);
  }
  assert.deepEqual(
    (await call(api)).body.gatherings,
    [],
    'Private group cannot read live staging or public-preparation gatherings',
  );
  const created = await call(api, 'POST', a, command);
  assert.equal(created.status, 200);
  assert.deepEqual(created.body.gathering.participantNames, ['أحمد']);
  const id = created.body.gathering.id;
  assert.equal(
    Date.parse(created.body.gathering.expiresAt) - Date.parse(command.startsAt),
    30 * 60_000,
  );
  assert.equal((await call(pushApi + '/check/' + id)).body.active, true);
  // Reopening is a fresh GET; state is durable, not browser memory.
  assert.equal((await call(api, 'GET', a)).body.gatherings[0].id, id);
  const join = {
    joined: true,
    firstName: 'Max',
    consent: 'prayer-v2',
    expectedRevision: 0,
    operationId: randomUUID(),
  };
  for (const r of await Promise.all([
    call(api + `/${id}/participation`, 'PUT', b, join),
    call(api + `/${id}/participation`, 'PUT', b, join),
  ]))
    assert.equal(r.body.gathering.participantCount, 2);
  assert.equal((await call(api + '/' + id, 'DELETE', b)).status, 403);
  assert.equal(
    (
      await call(api + `/${id}/participation`, 'PUT', b, {
        ...join,
        joined: false,
        firstName: '',
        expectedRevision: 1,
        operationId: randomUUID(),
      })
    ).body.gathering.participantCount,
    1,
  );
  assert.equal((await call(api + '/' + id, 'DELETE', a)).status, 200);
  assert.equal((await call(pushApi + '/check/' + id)).body.active, false);
  assert.equal(
    (await call(pushApi + '/subscription', 'DELETE', b)).body.subscribed,
    false,
  );
  assert.equal(
    (await call(pushApi + '/subscription', 'GET', b)).body.subscribed,
    false,
  );
  for (const [root, headers, otherId] of otherIds)
    assert.equal(
      (
        await fetch(root + '/gatherings/' + otherId, {
          method: 'DELETE',
          headers,
        })
      ).status,
      200,
    );
  const logout = await fetch(base + '/access/logout', {
    method: 'POST',
    redirect: 'manual',
    headers: { Origin: 'https://localhost:4443', Cookie: cookie },
  });
  assert.equal(logout.status, 303);
  assert.equal((await call(api)).status, 401);
  assert.equal((await call(pushApi + '/subscription', 'GET', a)).status, 401);
  console.log(
    'PASS compiled private API: session gate, named create/join/leave, duplicates, ownership, logout revocation.',
  );
}
