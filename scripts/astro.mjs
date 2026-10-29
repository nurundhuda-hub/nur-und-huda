import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Disable build-tool telemetry without changing the user's global preferences.
const packageUrl = new URL(import.meta.resolve('astro/package.json'));
const metadata = JSON.parse(readFileSync(packageUrl, 'utf8'));
const cli = fileURLToPath(new URL(metadata.bin.astro, packageUrl));
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
