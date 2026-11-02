import { describe, expect, it } from 'vitest';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sermonFixture, SERMON_MARKER } from './fixtures/sermon-content';
import { contentDigest, revisionSeal } from '../src/lib/sermons/publication';
import { workflowDigest } from '../src/lib/sermons/approval-workflow';
import {
  encryptCatalog,
  newReleaseKey,
} from '../scripts/automatic-release-crypto';
import { repository } from '../scripts/pages-release-support';

describe('automatic release command with isolated synthetic content', () => {
  it('fails closed before decryption, builds the authorized pair, verifies output and skips duplicate deployments without plaintext logs', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'nur-auto-release-'));
    const original = readFileSync('src/content/sermons.ts');
    try {
      for (const dir of ['src', 'scripts', 'public', 'assets'])
        cpSync(dir, path.join(root, dir), { recursive: true });
      for (const file of ['astro.config.mjs', 'package.json', 'tsconfig.json'])
        cpSync(file, path.join(root, file));
      symlinkSync(
        path.resolve('node_modules'),
        path.join(root, 'node_modules'),
        'dir',
      );
      // Clearly synthetic English slots; the reserved fixture marker is omitted only
      // inside this isolated, never-deployed build so the full static validator runs.
      const marker = 'SYNTHETIC SOFTWARE TEST ONLY NOT RELIGIOUS CONTENT';
      const catalog = JSON.parse(
        JSON.stringify(sermonFixture()).replaceAll(SERMON_MARKER, marker),
      ) as ReturnType<typeof sermonFixture>;
      for (const item of [...catalog.sermons, ...catalog.studies]) {
        item.purpose = 'production';
        item.editedAt = '2019-01-01T00:00:00Z';
        item.publishAt = '2020-01-03T07:00:00Z';
        item.references.forEach(
          (ref) => (ref.verifiedAt = '2019-01-01T00:00:00Z'),
        );
      }
      catalog.sermons[0]!.friday = '2020-01-03';
      catalog.sermons[0]!.duration.recordedAt = '2019-01-02T00:00:00Z';
      for (const item of [...catalog.sermons, ...catalog.studies])
        item.approval = {
          status: 'approved',
          revision: item.revision,
          reviewer: marker,
          reviewedAt: '2019-01-03T00:00:00Z',
          sha256: contentDigest(item),
        };
      catalog.history = [...catalog.sermons, ...catalog.studies].map(
        (item) => ({
          kind: item.kind,
          id: item.id,
          revision: item.revision,
          sha256: revisionSeal(item),
        }),
      );
      const expected = {
        publishAt: catalog.sermons[0]!.publishAt,
        sermon: { id: catalog.sermons[0]!.id, revision: 'r1' },
        study: { id: catalog.studies[0]!.id, revision: 'r1' },
      };
      const digest = workflowDigest(catalog),
        key = newReleaseKey(),
        payload = encryptCatalog(catalog, key, {
          repository,
          catalogSha256: digest,
          publishAt: expected.publishAt,
        });
      const policy = (publishAt: string) =>
        writeFileSync(
          path.join(root, 'src/lib/sermons/first-release.ts'),
          `export const firstRelease=${JSON.stringify({ ...expected, publishAt })};export const firstReleaseCatalogSha256=${JSON.stringify(digest)};`,
        );
      // Network is replaced ONLY for this spawned test. No real host is contacted.
      writeFileSync(
        path.join(root, 'network.mjs'),
        `import fs from 'node:fs';import path from 'node:path';globalThis.fetch=async(input)=>{const url=new URL(String(input));if(url.origin!=='https://nurundhuda-hub.github.io')throw new Error('Unexpected test host');const file=url.pathname.replace('/nur-und-huda/','');if(process.env.TEST_NETWORK_MODE==='unavailable')return new Response('',{status:503});if(process.env.TEST_NETWORK_MODE==='absent')return new Response('',{status:404});const full=path.join(${JSON.stringify(root)},'dist',file);return fs.existsSync(full)?new Response(fs.readFileSync(full)):new Response('',{status:404});};`,
      );
      const invoke = (action: string, mode: string) => {
        writeFileSync(path.join(root, 'output'), '');
        writeFileSync(path.join(root, 'summary'), '');
        return spawnSync(
          process.execPath,
          [
            '--import',
            path.join(root, 'network.mjs'),
            '--experimental-strip-types',
            path.join(root, 'scripts/automatic-release.ts'),
            action,
          ],
          {
            cwd: root,
            encoding: 'utf8',
            timeout: 60000,
            env: {
              ...process.env,
              GITHUB_REPOSITORY: repository,
              GITHUB_REF: 'refs/heads/main',
              GITHUB_SHA: 'c'.repeat(40),
              GITHUB_EVENT_NAME: 'workflow_dispatch',
              GITHUB_OUTPUT: path.join(root, 'output'),
              GITHUB_STEP_SUMMARY: path.join(root, 'summary'),
              NUR_SERMON_AUTO_ENABLED: 'true',
              NUR_RELEASE_KEY: key,
              NUR_RELEASE_PAYLOAD: payload,
              TEST_NETWORK_MODE: mode,
              ASTRO_TELEMETRY_DISABLED: '1',
            },
          },
        );
      };
      policy('2100-01-01T07:00:00Z');
      const early = invoke('prepare', 'absent');
      expect(early.status).toBe(1);
      expect(early.stdout).toContain('guard');
      expect(existsSync(path.join(root, 'dist'))).toBe(false);
      policy(expected.publishAt);
      const failed = invoke('prepare', 'unavailable');
      expect(failed.status).toBe(1);
      expect(failed.stdout).toContain('check-live');
      const first = invoke('prepare', 'absent');
      expect(first.status, first.stdout + first.stderr).toBe(0);
      expect(readFileSync(path.join(root, 'output'), 'utf8')).toContain(
        'publish=true',
      );
      const receipt = readFileSync(
        path.join(root, 'dist/sermon-release-status.json'),
        'utf8',
      );
      expect(receipt).not.toContain(marker);
      expect(receipt).not.toContain(key);
      expect(
        readFileSync(
          path.join(root, 'dist/sermons/synthetic-only/r1.html'),
          'utf8',
        ),
      ).toContain(marker);
      const verified = invoke('verify', 'published');
      expect(verified.status, verified.stdout + verified.stderr).toBe(0);
      expect(verified.stdout).toContain('Verified live');
      const duplicate = invoke('prepare', 'published');
      expect(duplicate.status).toBe(0);
      expect(readFileSync(path.join(root, 'output'), 'utf8')).toContain(
        'publish=false',
      );
      expect(
        readFileSync(
          path.join(root, 'dist/sermon-release-status.json'),
          'utf8',
        ),
      ).toBe(receipt);
      for (const result of [early, failed, first, verified, duplicate]) {
        expect(result.stdout + result.stderr).not.toContain(marker);
        expect(result.stdout + result.stderr).not.toContain(key);
        expect(result.stdout + result.stderr).not.toContain(payload);
      }
      expect(readFileSync(path.join(root, 'src/content/sermons.ts'))).toEqual(
        original,
      );
      expect(readFileSync('src/content/sermons.ts')).toEqual(original);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60000);
});
