import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  bytesDigest,
  inventory,
  publicBase,
  requireReleaseTime,
  retryVerification,
  validateReleaseCatalog,
  verifyPublicFiles,
} from '../scripts/pages-release-support';
import {
  sermonFixture,
  sealFixture,
  resealFixtureHistory,
} from './fixtures/sermon-content';
import { workflowDigest } from '../src/lib/sermons/approval-workflow';

describe('supervised Pages release safeguards', () => {
  it('keeps the exact UTC embargo and approves an explicitly untimed owner estimate without weakening revision seals', () => {
    const c = sermonFixture();
    for (const item of [...c.sermons, ...c.studies]) {
      item.purpose = 'production';
      sealFixture(item);
    }
    resealFixtureHistory(c);
    const expected = {
      publishAt: c.sermons[0]!.publishAt,
      sermon: { id: c.sermons[0]!.id, revision: 'r1' },
      study: { id: c.studies[0]!.id, revision: 'r1' },
    };
    expect(() =>
      validateReleaseCatalog(c, expected, workflowDigest(c)),
    ).not.toThrow();
    expect(c.sermons[0]!.duration.humanTimed).toBe(false);
    expect(() =>
      requireReleaseTime(expected, Date.parse(expected.publishAt) - 1),
    ).toThrow(/Embargo/);
    expect(() =>
      requireReleaseTime(expected, Date.parse(expected.publishAt)),
    ).not.toThrow();
    expect(() => requireReleaseTime(expected, NaN)).toThrow(/Embargo/);
    const digest = workflowDigest(c);
    c.sermons[0]!.duration.minutes = 11;
    expect(() => validateReleaseCatalog(c, expected, digest)).toThrow(/digest/);
    expect(() =>
      validateReleaseCatalog(c, expected, workflowDigest(c)),
    ).toThrow(/Approval/);
  });
  it('inventories only regular public files and rejects hidden review data or symlinks', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'nur-release-inventory-'));
    try {
      await writeFile(path.join(root, 'index.html'), 'public test only');
      await writeFile(path.join(root, '.nojekyll'), '');
      expect(await inventory(root)).toEqual({
        '.nojekyll': bytesDigest(Buffer.from('')),
        'index.html': bytesDigest(Buffer.from('public test only')),
      });
      await mkdir(path.join(root, '.sermon-review'));
      await expect(inventory(root)).rejects.toThrow(/Hidden/);
      await rm(path.join(root, '.sermon-review'), { recursive: true });
      await symlink(
        path.join(root, 'index.html'),
        path.join(root, 'alias.html'),
      );
      await expect(inventory(root)).rejects.toThrow(/Symlink/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('checks actual public bytes including reader assets, fails on stale/HTTP errors and reports exhausted retries', async () => {
    const bodies = {
      'sermon-publication.json': 'test manifest',
      'sermons.html': 'test overview',
      '_astro/reader.js': 'test reader code',
    };
    const files = Object.fromEntries(
      Object.entries(bodies).map(([file, body]) => [
        file,
        bytesDigest(Buffer.from(body)),
      ]),
    );
    const urls: string[] = [];
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      urls.push(url.href);
      const file = url.pathname.slice(
        new URL(publicBase).pathname.length,
      ) as keyof typeof bodies;
      return new Response(bodies[file], { status: 200 });
    }) as unknown as typeof fetch;
    await verifyPublicFiles(files, fetcher);
    expect(urls).toHaveLength(3);
    expect(urls[0]).toContain('sermon-publication.json');
    await expect(
      verifyPublicFiles(
        files,
        (async () => new Response('stale', { status: 200 })) as typeof fetch,
      ),
    ).rejects.toThrow(/verification failed/);
    await expect(
      verifyPublicFiles(
        files,
        (async () => new Response('', { status: 503 })) as typeof fetch,
      ),
    ).rejects.toThrow(/503/);
    await expect(
      verifyPublicFiles(
        { ...files, '../private': files['sermons.html']! },
        fetcher,
      ),
    ).rejects.toThrow(/inventory/);
    const attempt = vi
        .fn()
        .mockRejectedValueOnce(new Error('propagating'))
        .mockResolvedValue(undefined),
      wait = vi.fn(async () => {});
    await retryVerification(attempt, wait, 3);
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
    await expect(
      retryVerification(
        async () => {
          throw new Error('failed deploy');
        },
        wait,
        2,
      ),
    ).rejects.toThrow(/NOT verified/);
  });
});
