import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { groupFixture } from './group-fixture.mjs';
import { pushFixture } from './push-fixture.mjs';
import { stagingFixture } from './staging-fixture.mjs';
const mode = process.argv[2] ?? 'http';
if (!['http', 'guarded', 'browser', 'private'].includes(mode))
  throw Error('Use http, guarded, browser or private');
// Firebase's parameter resolver reads dotenv files, not inherited shell params.
// Never overwrite a developer's existing local environment file.
const localFile = new URL('../functions/.env.local', import.meta.url);
const localContent = `PRAYER_STAGING_ACCESS='${stagingFixture()}'\nPRAYER_PUBLIC_ENABLED=true\nPRAYER_PUBLIC_ORIGIN=http://127.0.0.1:4344\nNUR_GROUP_ENABLED=true\nNUR_GROUP_ORIGIN=https://localhost:4443\n`;
const secretFile = new URL('../functions/.secret.local', import.meta.url);
const secretContent = `NUR_GROUP_ACCESS='${groupFixture}'\nNUR_GROUP_PUSH='${pushFixture}'\n`;
const temporaryConfig = new URL(
  '../.firebase.private-emulator.json',
  import.meta.url,
);
const files = [
  [secretFile, secretContent],
  [localFile, localContent],
];
if (mode === 'private') {
  const config = JSON.parse(
    readFileSync(new URL('../firebase.private.json', import.meta.url), 'utf8'),
  );
  config.hosting.site = 'demo-nur-prayer';
  files.push([temporaryConfig, JSON.stringify(config)]);
}
const created = [];
const cleanup = () => {
  for (const [file, content] of created) {
    try {
      if (readFileSync(file, 'utf8') === content) unlinkSync(file);
    } catch {
      /* Already removed. */
    }
  }
};
try {
  for (const [file, content] of files) {
    writeFileSync(file, content, { flag: 'wx', mode: 0o600 });
    created.push([file, content]);
  }
} catch (error) {
  cleanup();
  throw error;
}
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
    mode === 'guarded'
      ? 'firestore'
      : mode === 'private'
        ? 'firestore,functions,hosting'
        : 'firestore,functions',
    '--config',
    mode === 'private'
      ? 'backend/.firebase.private-emulator.json'
      : 'backend/firebase.json',
    `node backend/tests/${mode === 'http' ? 'emulator' : mode === 'browser' ? 'browser-runner' : mode === 'private' ? 'private-browser' : 'runtime-audit'}.mjs`,
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
