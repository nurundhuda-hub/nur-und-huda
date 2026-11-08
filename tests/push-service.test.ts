// @vitest-environment node
import { createECDH, randomBytes } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  createService,
  emptyState,
  hash,
  GROUP_GRACE,
  HOUR,
  prune,
} from '../backend/functions/src/core';
import { emptyAccess } from '../backend/functions/src/group-access';
import {
  createDispatcher,
  createPushService,
  deviceHash,
  emptyPush,
  validateSubscription,
  type PushSend,
} from '../backend/functions/src/push';
const start = Date.parse('2026-11-07T10:00:00Z');
const a = 'A'.repeat(43),
  b = 'B'.repeat(43),
  c = 'C'.repeat(43);
function sub(id = 'synthetic') {
  const ec = createECDH('prime256v1');
  ec.generateKeys();
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
    keys: {
      auth: randomBytes(16).toString('base64url'),
      p256dh: ec.getPublicKey().toString('base64url'),
    },
  };
}
function setup() {
  let now = start,
    epoch = 'epoch';
  const group = emptyState(),
    push = emptyPush(),
    access = emptyAccess();
  access.sessions.one = {
    issuedAt: now,
    expiresAt: now + 365 * 24 * HOUR,
    epoch,
  };
  access.sessions.two = {
    issuedAt: now,
    expiresAt: now + 365 * 24 * HOUR,
    epoch,
  };
  const api = createService(
    { transact: async (work) => work(group) },
    () => now,
    true,
    true,
  );
  const store = {
    transact: async <T>(
      work: (p: typeof push, g: typeof group, a: typeof access) => T,
    ) => work(push, group, access),
  };
  const subscriptions = createPushService(
    store,
    () => epoch,
    () => now,
  );
  const create = (operation = '00000000-0000-4000-8000-000000000001') =>
    api(
      'POST',
      '/gatherings',
      a,
      {
        prayer: 'asr',
        startsAt: new Date(start + HOUR).toISOString(),
        operationId: operation,
        consent: 'prayer-v2',
        firstName: 'أحمد',
        note: 'synthetic test',
      },
      deviceHash(a),
    );
  const deliveries: unknown[] = [];
  const dispatcher = (
    send: PushSend = async (...args) => {
      deliveries.push(args);
    },
  ) =>
    createDispatcher(
      store,
      () => epoch,
      send,
      () => now,
    );
  return {
    api,
    create,
    subscriptions,
    group,
    push,
    access,
    deliveries,
    dispatcher,
    setTime: (v: number) => {
      now = v;
    },
    rotate: () => {
      epoch = 'rotated';
    },
  };
}
it('sends one creation to the other device, not creator, retries, reads, joins or leaves', async () => {
  const s = setup();
  await s.subscriptions.subscription('PUT', a, 'one', sub('one'));
  await s.subscriptions.subscription('PUT', b, 'two', sub('two'));
  const first = await s.create();
  await s.create();
  await Promise.all([s.dispatcher()(), s.dispatcher()()]);
  expect(s.deliveries).toHaveLength(1);
  const [subscription, payload] = s.deliveries[0] as [
    ReturnType<typeof sub>,
    Record<string, unknown>,
  ];
  expect(subscription.endpoint.endsWith('/two')).toBe(true);
  expect(Object.keys(payload).sort()).toEqual(['expiresAt', 'gathering']);
  const id = Object.keys(s.group.gatherings)[0]!;
  for (const joined of [true, false])
    await s.api('PUT', `/gatherings/${id}/participation`, b, {
      joined,
      expectedRevision: joined ? 0 : 1,
      operationId: `00000000-0000-4000-8000-00000000000${joined ? 2 : 3}`,
      consent: 'prayer-v2',
      firstName: joined ? 'Sam' : '',
    });
  await s.api('GET', '/gatherings', b);
  await s.dispatcher()();
  expect(s.deliveries).toHaveLength(1);
  expect(JSON.stringify(first)).not.toContain('creatorDevice');
  expect(JSON.stringify(first)).not.toContain('notificationCreatedAt');
});
it('preserves real group state across reopening until exactly start plus 30 minutes; staging expiry unchanged', async () => {
  const s = setup();
  await s.create();
  s.setTime(start + HOUR + GROUP_GRACE - 1);
  const reopened = createService(
    { transact: async (work) => work(s.group) },
    () => start + HOUR + GROUP_GRACE - 1,
    true,
    true,
  );
  const list = await reopened('GET', '/gatherings', a);
  expect('gatherings' in list && list.gatherings?.length).toBe(1);
  expect(JSON.stringify(list)).toContain(
    new Date(start + HOUR + GROUP_GRACE).toISOString(),
  );
  prune(s.group, start + HOUR, GROUP_GRACE);
  expect(Object.keys(s.group.gatherings)).toHaveLength(1);
  s.setTime(start + HOUR + GROUP_GRACE);
  expect(
    ((await s.api('GET', '/gatherings', a)) as { gatherings: unknown[] })
      .gatherings,
  ).toHaveLength(0);
  expect(Object.keys(s.group.gatherings)).toHaveLength(0);
  const legacy = emptyState();
  legacy.gatherings.x = {
    id: 'x',
    prayer: 'asr',
    startsAt: start,
    owner: 'x',
    members: {},
    cancelled: false,
  };
  prune(legacy, start);
  expect(Object.keys(legacy.gatherings)).toHaveLength(0);
});
it('does not notify cancelled, already-started, old or newly subscribed devices retroactively', async () => {
  const s = setup();
  await s.subscriptions.subscription('PUT', b, 'two', sub());
  await s.create();
  const id = Object.keys(s.group.gatherings)[0]!;
  await s.api('DELETE', '/gatherings/' + id, a);
  await s.dispatcher()();
  expect(s.deliveries).toHaveLength(0);
  expect(await s.subscriptions.active(id)).toEqual({ active: false });
  await s.create('00000000-0000-4000-8000-000000000002');
  s.setTime(start + HOUR);
  await s.dispatcher()();
  expect(s.deliveries).toHaveLength(0);
  const t = setup();
  await t.create();
  t.setTime(start + 1);
  await t.subscriptions.subscription('PUT', c, 'two', sub());
  await t.dispatcher()();
  expect(t.deliveries).toHaveLength(0);
});
it('retries only explicit rejection, never ambiguous failure or duplicate scheduler claims', async () => {
  const s = setup();
  await s.subscriptions.subscription('PUT', b, 'two', sub());
  await s.create();
  let attempts = 0;
  const run = s.dispatcher(async () => {
    if (++attempts === 1) throw { statusCode: 503 };
  });
  await run();
  await run();
  expect(attempts).toBe(1);
  s.setTime(start + 60001);
  await Promise.all([run(), run()]);
  expect(attempts).toBe(2);
  await run();
  expect(attempts).toBe(2);
  const t = setup();
  await t.subscriptions.subscription('PUT', b, 'two', sub());
  await t.create();
  let unknown = 0;
  const fail = t.dispatcher(async () => {
    unknown++;
    throw Error('network uncertain');
  });
  await fail();
  t.setTime(start + 60001);
  await fail();
  expect(unknown).toBe(1);
});
it('deletes expired tokens, unsubscribed devices and revoked sessions; never returns endpoints', async () => {
  const s = setup();
  const result = await s.subscriptions.subscription('PUT', b, 'two', sub());
  expect(Object.keys(result).sort()).toEqual(['expiresAt', 'subscribed']);
  await s.create();
  await s.dispatcher(async () => {
    throw { statusCode: 410 };
  })();
  expect(Object.keys(s.push.devices)).toHaveLength(0);
  await s.subscriptions.subscription('PUT', b, 'two', sub());
  await s.subscriptions.subscription('DELETE', b, 'two');
  expect(Object.keys(s.push.devices)).toHaveLength(0);
  await s.subscriptions.subscription('PUT', b, 'two', sub());
  delete s.access.sessions.two;
  await s.dispatcher()();
  expect(Object.keys(s.push.devices)).toHaveLength(0);
  await s.subscriptions.subscription('PUT', a, 'one', sub());
  s.rotate();
  await s.dispatcher()();
  expect(Object.keys(s.push.devices)).toHaveLength(0);
});
it('expires subscriptions after 30 days inactivity and deletes dedup records at gathering expiry', async () => {
  const s = setup();
  await s.subscriptions.subscription('PUT', b, 'two', sub());
  await s.create();
  await s.dispatcher()();
  s.setTime(start + HOUR + GROUP_GRACE);
  await s.dispatcher()();
  expect(Object.keys(s.push.deliveries)).toHaveLength(0);
  s.setTime(start + 30 * 24 * HOUR);
  await s.dispatcher()();
  expect(Object.keys(s.push.devices)).toHaveLength(0);
});
it('keeps a rotated subscription when an old in-flight token returns 410', async () => {
  const s = setup();
  await s.subscriptions.subscription('PUT', b, 'two', sub('old'));
  await s.create();
  const replacement = sub('rotated');
  await s.dispatcher(async () => {
    await s.subscriptions.subscription('PUT', b, 'two', replacement);
    throw { statusCode: 410 };
  })();
  expect(s.push.devices[deviceHash(b)]?.subscription).toEqual(replacement);
});
it('rejects unsafe endpoints, malformed keys and duplicate endpoint ownership; enforces limits', async () => {
  const valid = sub();
  expect(validateSubscription(valid)).toEqual(valid);
  expect(
    validateSubscription({
      ...valid,
      endpoint: 'https://fcm.googleapis.com/wp/synthetic',
    }).endpoint,
  ).toBe('https://fcm.googleapis.com/wp/synthetic');
  for (const endpoint of [
    'http://fcm.googleapis.com/fcm/send/x',
    'https://127.0.0.1/x',
    'https://metadata.google.internal/x',
    'https://fcm.googleapis.com.evil.test/fcm/send/x',
    'https://fcm.googleapis.com:444/fcm/send/x',
    'https://user@web.push.apple.com/x',
    'https://fcm.googleapis.com/fcm/send/x?redirect=evil',
  ])
    expect(() => validateSubscription({ ...valid, endpoint })).toThrow(
      'INVALID_SUBSCRIPTION',
    );
  expect(() =>
    validateSubscription({
      ...valid,
      keys: { ...valid.keys, p256dh: 'A'.repeat(87) },
    }),
  ).toThrow();
  const s = setup();
  await s.subscriptions.subscription('PUT', a, 'one', valid);
  await expect(
    s.subscriptions.subscription('PUT', b, 'two', valid),
  ).rejects.toThrow('SUBSCRIPTION_CONFLICT');
  s.push.requests = 120;
  await expect(s.subscriptions.subscription('GET', a, 'one')).rejects.toThrow(
    'RATE_LIMITED',
  );
  expect(() => deviceHash('bad')).toThrow();
  expect(deviceHash(a)).toBe(hash(a));
});
