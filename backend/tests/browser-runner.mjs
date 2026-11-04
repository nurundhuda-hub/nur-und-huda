// Invoked inside the demo-only Firebase emulator runner; never connects to cloud.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
assert.equal(process.env.GCLOUD_PROJECT, 'demo-nur-prayer');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8086');
const site = spawn(
  'npm',
  ['run', 'dev', '--', '--port', '4344', '--ignore-lock'],
  {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PUBLIC_PRAYER_API_URL:
        'http://127.0.0.1:5001/demo-nur-prayer/europe-west3/publicPrayerApi',
      PUBLIC_PRAYER_MODE: 'local',
      PUBLIC_PRAYER_LIVE_APPROVED: 'false',
    },
  },
);
let output = '';
site.stdout.on('data', (data) => {
  output = (output + data).slice(-4000);
});
site.stderr.on('data', (data) => {
  output = (output + data).slice(-4000);
});
try {
  let ready = false;
  for (let n = 0; n < 90; n++) {
    try {
      const response = await fetch(
        'http://127.0.0.1:4344/nur-und-huda/together.html',
      );
      const html = await response.text();
      ready =
        response.ok &&
        html.includes('demo-nur-prayer/europe-west3/publicPrayerApi') &&
        html.includes('data-staging="false"');
    } catch {
      /* Wait for Astro only. */
    }
    if (ready) break;
    if (site.exitCode !== null) throw Error(`Astro exited: ${output}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, `Local Astro did not start with the demo API: ${output}`);
  await import('./browser.mjs');
} finally {
  if (site.pid) {
    try {
      process.kill(-site.pid, 'SIGTERM');
    } catch {
      /* Already stopped. */
    }
  }
}
