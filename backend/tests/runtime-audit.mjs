// Run with the Firestore emulator only. This is bounded dynamic reachability
// evidence for the compiled API, not proof covering every production branch.
import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import { once } from 'node:events';
import { groupFixture } from './group-fixture.mjs';
import { pushFixture } from './push-fixture.mjs';
import { checkPrivateApi } from './private-http.mjs';
import { stagingFixture } from './staging-fixture.mjs';

assert.equal(process.env.GCLOUD_PROJECT, 'demo-nur-prayer');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8086');
process.env.FUNCTIONS_EMULATOR = 'true';
process.env.PRAYER_ALLOWED_ORIGINS = 'http://127.0.0.1:4343';
process.env.PRAYER_SERVICE_ACCOUNT =
  'prayer-runtime@demo-nur-prayer.iam.gserviceaccount.com';
process.env.PRAYER_TEST_API_BASE = 'http://127.0.0.1:5051';
process.env.PRAYER_STAGING_ACCESS = stagingFixture();
process.env.NUR_GROUP_ACCESS = groupFixture;
process.env.NUR_GROUP_PUSH = pushFixture;
process.env.NUR_GROUP_ENABLED = 'true';
process.env.NUR_GROUP_ORIGIN = 'https://localhost:4443';
process.env.PRAYER_PUBLIC_ENABLED = 'true';
process.env.PRAYER_PUBLIC_ORIGIN = 'http://127.0.0.1:4344';
process.env.PRAYER_TEST_PUBLIC_BASE = 'http://127.0.0.1:5051/public';

const blocked = [];
const loaded = new Set();
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    const match = /\/node_modules\/(rimraf|glob|minimatch)(?:\/|$)/.exec(
      result.url,
    );
    if (match) {
      blocked.push(match[1]);
      throw new Error(`Advisory package reached: ${match[1]}`);
    }
    if (result.url.includes('/node_modules/')) loaded.add(result.url);
    return result;
  },
});

const requireBackend = createRequire(
  new URL('../functions/package.json', import.meta.url),
);
let server;
try {
  const express = requireBackend('express');
  const { prayerApi, publicPrayerApi, privateSite, expirePrayerGatherings } =
    await import('../functions/lib/index.js');
  const app = express();
  app.use(
    express.json({
      verify(req, _res, buffer) {
        req.rawBody = buffer;
      },
    }),
  );
  app.use(
    express.urlencoded({
      extended: false,
      verify(req, _res, buffer) {
        req.rawBody = buffer;
      },
    }),
  );
  app.use('/group', privateSite);
  app.use('/public', publicPrayerApi);
  app.use(prayerApi);
  server = app.listen(5051, '127.0.0.1');
  await once(server, 'listening');
  // Confirm a deployed-but-disabled endpoint cannot reach data for any method.
  process.env.PRAYER_PUBLIC_ENABLED = 'false';
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    const closed = await fetch('http://127.0.0.1:5051/public/gatherings', {
      method,
      headers: { Origin: 'http://127.0.0.1:4344' },
    });
    assert.equal(closed.status, 503);
    assert.equal((await closed.json()).error.code, 'UNAVAILABLE');
  }
  process.env.PRAYER_PUBLIC_ENABLED = 'true';
  await import('./emulator.mjs');
  process.env.NUR_GROUP_ENABLED = 'false';
  assert.equal((await fetch('http://127.0.0.1:5051/group/access')).status, 503);
  process.env.NUR_GROUP_ENABLED = 'true';
  await checkPrivateApi('http://127.0.0.1:5051/group');
  // Seed expired synthetic names/ownership in the demo database only, then
  // exercise the real compiled cleanup handler, not a real Scheduler trigger.
  const { getFirestore } = requireBackend('firebase-admin/firestore');
  const publicRef = getFirestore().doc('prayerService/public');
  const sample = (await publicRef.get()).data();
  sample.gatherings['d'.repeat(64)] = {
    id: 'd'.repeat(64),
    prayer: 'asr',
    startsAt: Date.now() - 30 * 60_000 - 1,
    owner: 'e'.repeat(64),
    cancelled: false,
    note: 'EXPIRED_SYNTHETIC_NOTE',
    members: {
      ['e'.repeat(64)]: {
        joined: true,
        firstName: 'EXPIRED_SYNTHETIC_NAME',
        revision: 1,
        operationId: 'synthetic',
      },
    },
  };
  await publicRef.set(sample);
  await getFirestore().doc('prayerService/group').set(sample);
  const groupRef = getFirestore().doc('prayerService/group');
  const stillVisible = structuredClone(sample.gatherings['d'.repeat(64)]);
  stillVisible.id = 'c'.repeat(64);
  stillVisible.startsAt = Date.now() - 5 * 60_000;
  await groupRef.update({ ['gatherings.' + stillVisible.id]: stillVisible });
  const accessRef = getFirestore().doc('privateAccess/state');
  const sessions = (await accessRef.get()).data();
  sessions.sessions['e'.repeat(64)] = {
    issuedAt: Date.now() - 10000,
    expiresAt: Date.now() - 1,
    epoch: 'synthetic',
  };
  await accessRef.set(sessions);
  await expirePrayerGatherings.run({});
  const cleaned = (await publicRef.get()).data();
  assert.equal(cleaned.gatherings['d'.repeat(64)], undefined);
  assert.equal(
    (await getFirestore().doc('prayerService/group').get()).data().gatherings[
      'd'.repeat(64)
    ],
    undefined,
  );
  assert.ok(
    (await groupRef.get()).data().gatherings['c'.repeat(64)],
    'Cleanup must preserve the 30-minute visibility window',
  );
  assert.equal(
    (await accessRef.get()).data().sessions['e'.repeat(64)],
    undefined,
  );
  assert.ok(!JSON.stringify(cleaned).includes('EXPIRED_SYNTHETIC'));
  assert.deepEqual(blocked, []);
  assert.ok(
    [...loaded].some((url) => url.includes('/@google-cloud/firestore/')),
  );
  console.log(
    'PASS: compiled HTTP API and cleanup handler completed with rimraf/glob/minimatch loading forbidden. No affected package resolved in the exercised emulator paths. Cloud OAuth/ADC, scheduler delivery and untested failures are not covered.',
  );
} finally {
  server?.closeAllConnections();
  if (server) await new Promise((resolve) => server.close(resolve));
  hooks.deregister();
}
