import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import type { SermonCatalog } from '../src/lib/sermons/model.ts';
import { workflowDigest } from '../src/lib/sermons/approval-workflow.ts';
import {
  selectPublicCatalog,
  utcInstant,
} from '../src/lib/sermons/publication.ts';
import {
  checkScheduledRelease,
  publicReleaseManifest,
  type ExpectedRelease,
} from '../src/lib/sermons/scheduled-release.ts';

export const repository = 'nurundhuda-hub/nur-und-huda';
export const publicBase = 'https://nurundhuda-hub.github.io/nur-und-huda/';
export const bytesDigest = (value: Uint8Array) =>
  createHash('sha256').update(value).digest('hex');
export function requireReleaseTime(
  expected: ExpectedRelease,
  now = Date.now(),
): void {
  if (!Number.isFinite(now) || now < utcInstant(expected.publishAt))
    throw new Error(
      `Embargo active until ${expected.publishAt}. Nothing may be pushed or deployed.`,
    );
}
export function validateReleaseCatalog(
  catalog: SermonCatalog,
  expected: ExpectedRelease,
  digest: string,
): void {
  if (workflowDigest(catalog) !== digest)
    throw new Error('Public catalog digest mismatch.');
  if (
    catalog.sermons.length !== 1 ||
    catalog.studies.length !== 1 ||
    catalog.announcements.length !== 0
  )
    throw new Error(
      'First release must contain only the exact authorized pair.',
    );
  // Pure validation at its intended instant; this neither builds nor discloses files.
  const manifest = publicReleaseManifest(
    selectPublicCatalog(catalog, expected.publishAt),
  );
  checkScheduledRelease(
    catalog,
    manifest,
    expected,
    utcInstant(expected.publishAt),
  );
}
export async function inventory(root: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  async function walk(dir: string) {
    for (const name of (await readdir(dir)).sort()) {
      if (name.startsWith('.') && name !== '.nojekyll')
        throw new Error('Hidden/private file in release output.');
      const full = path.join(dir, name),
        stat = await lstat(full);
      if (stat.isSymbolicLink()) throw new Error('Symlink in release output.');
      if (stat.isDirectory()) await walk(full);
      else if (stat.isFile())
        files[path.relative(root, full).split(path.sep).join('/')] =
          bytesDigest(await readFile(full));
      else throw new Error('Nonregular release output.');
    }
  }
  await walk(root);
  return files;
}
export async function inspectReleaseOutput(
  root: string,
  catalog: SermonCatalog,
  expected: ExpectedRelease,
  now = Date.now(),
) {
  requireReleaseTime(expected, now);
  const manifest = JSON.parse(
    await readFile(path.join(root, 'sermon-publication.json'), 'utf8'),
  );
  checkScheduledRelease(catalog, manifest, expected, now);
  const html = async (file: string) =>
    new JSDOM(await readFile(path.join(root, file), 'utf8'), {
      url: publicBase + file,
    });
  const overview = await html('sermons.html'),
    sermon = await html(manifest.pages[0]),
    study = await html(manifest.pages[1]),
    offline = await html(manifest.downloads[0]);
  try {
    const requireNode = (dom: JSDOM, selector: string) => {
      const node = dom.window.document.querySelector(selector);
      if (!node)
        throw new Error(`Missing release navigation/control: ${selector}`);
      return node;
    };
    requireNode(overview, `a[href="/nur-und-huda/${manifest.pages[0]}"]`);
    requireNode(sermon, `a[href="/nur-und-huda/${manifest.pages[1]}"]`);
    requireNode(study, `a[href="/nur-und-huda/${manifest.pages[0]}"]`);
    requireNode(sermon, `a[href="/nur-und-huda/${manifest.downloads[0]}"]`);
    for (const selector of [
      '[data-reader-open]',
      '[data-reader-size]',
      '[data-font-step="2"]',
      '[data-font-step="-2"]',
      '[data-reader-theme]',
      '[data-sermon-print]',
    ])
      requireNode(sermon, selector);
    for (const dom of [sermon, offline]) {
      if (
        !dom.window.document.body.textContent.includes(
          `المدة التقريبية: ${catalog.sermons[0]!.duration.minutes} دقائق`,
        )
      )
        throw new Error('Missing approximate duration label.');
      for (const block of catalog.sermons[0]!.parts.flat())
        if (!dom.window.document.body.textContent.includes(block.text))
          throw new Error('Sermon text changed in release output.');
    }
    for (const block of catalog.studies[0]!.sections.flatMap((s) => s.blocks))
      if (!study.window.document.body.textContent.includes(block.text))
        throw new Error('Study text changed in release output.');
  } finally {
    for (const dom of [overview, sermon, study, offline]) dom.window.close();
  }
  return { manifest, files: await inventory(root) };
}
/** Verify bytes, including served JS/CSS, not just HTTP 200 or dispatch acceptance. */
export async function verifyPublicFiles(
  files: Record<string, string>,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (
    !files['sermon-publication.json'] ||
    Object.entries(files).some(
      ([file, sha]) =>
        !file ||
        file.startsWith('/') ||
        file.includes('..') ||
        file.includes('\\') ||
        !/^[a-zA-Z0-9_./-]+$/.test(file) ||
        !/^[0-9a-f]{64}$/.test(sha),
    )
  )
    throw new Error('Invalid release inventory.');
  const ordered = [
    'sermon-publication.json',
    ...Object.keys(files).filter(
      (f) => !['sermon-publication.json', '.nojekyll'].includes(f),
    ),
  ];
  for (const file of ordered) {
    const url = new URL(file, publicBase);
    url.searchParams.set('release-check', files[file]!);
    const response = await fetcher(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (
      !response.ok ||
      bytesDigest(new Uint8Array(await response.arrayBuffer())) !== files[file]
    )
      throw new Error(
        `Public verification failed: ${file} (HTTP ${response.status}).`,
      );
  }
}
export async function retryVerification(
  check: () => Promise<void>,
  wait: () => Promise<void>,
  attempts = 30,
): Promise<void> {
  let failure: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await check();
      return;
    } catch (error) {
      failure = error;
    }
    if (attempt + 1 < attempts) await wait();
  }
  throw new Error(
    `Public verification did not complete; release is NOT verified. ${String(failure)}`,
  );
}
