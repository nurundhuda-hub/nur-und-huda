// Run with the Firestore emulator only. This is bounded dynamic reachability
// evidence for the compiled API, not proof covering every production branch.
import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import { once } from 'node:events';
import { stagingFixture } from './staging-fixture.mjs';

assert.equal(process.env.GCLOUD_PROJECT, 'demo-nur-prayer');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8086');
process.env.FUNCTIONS_EMULATOR = 'true';
process.env.PRAYER_ALLOWED_ORIGINS = 'http://127.0.0.1:4343';
process.env.PRAYER_SERVICE_ACCOUNT =
  'prayer-runtime@demo-nur-prayer.iam.gserviceaccount.com';
process.env.PRAYER_TEST_API_BASE = 'http://127.0.0.1:5051';
process.env.PRAYER_STAGING_ACCESS = stagingFixture();

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
  const { prayerApi, expirePrayerGatherings } =
    await import('../functions/lib/index.js');
  const app = express();
  app.use(
    express.json({
      verify(req, _res, buffer) {
        req.rawBody = buffer;
      },
    }),
  );
  app.use(prayerApi);
  server = app.listen(5051, '127.0.0.1');
  await once(server, 'listening');
  await import('./emulator.mjs');
  // Exercise the real compiled cleanup handler, not a real Scheduler trigger.
  await expirePrayerGatherings.run({});
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
