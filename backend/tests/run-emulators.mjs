import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { stagingFixture } from './staging-fixture.mjs';
const mode = process.argv[2] ?? 'http';
if (!['http', 'guarded', 'browser'].includes(mode))
  throw Error('Use http, guarded or browser');
// Firebase's parameter resolver reads dotenv files, not inherited shell params.
// Never overwrite a developer's existing local environment file.
const localFile = new URL('../functions/.env.local', import.meta.url);
const localContent = `PRAYER_STAGING_ACCESS='${stagingFixture()}'\nPRAYER_PUBLIC_ENABLED=true\nPRAYER_PUBLIC_ORIGIN=http://127.0.0.1:4344\n`;
writeFileSync(localFile, localContent, { flag: 'wx', mode: 0o600 });
const cleanup = () => {
  try {
    if (readFileSync(localFile, 'utf8') === localContent) unlinkSync(localFile);
  } catch {
    /* It may already be removed after an interrupted run. */
  }
};
process.on('exit', cleanup);
const child = spawn(
  'npx',
  [
    '--yes',
    'firebase-tools@15.24.0',
    'emulators:exec',
    '--project',
    'demo-nur-prayer',
    '--only',
    mode === 'guarded' ? 'firestore' : 'firestore,functions',
    '--config',
    'backend/firebase.json',
    `node backend/tests/${mode === 'http' ? 'emulator' : mode === 'browser' ? 'browser-runner' : 'runtime-audit'}.mjs`,
  ],
  {
    stdio: 'inherit',
    env: { ...process.env, PRAYER_STAGING_ACCESS: stagingFixture() },
  },
);
child.on('error', () => {
  cleanup();
  process.exitCode = 1;
});
child.on('exit', (code) => {
  cleanup();
  process.exitCode = code ?? 1;
});
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
