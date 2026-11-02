import type { SermonCatalog } from '../src/lib/sermons/model.ts';
import type { ExpectedRelease } from '../src/lib/sermons/scheduled-release.ts';
import { checkScheduledRelease } from '../src/lib/sermons/scheduled-release.ts';
import {
  bytesDigest,
  publicBase,
  requireReleaseTime,
  verifyPublicFiles,
} from './pages-release-support.ts';
import {
  verifyReceiptSeal,
  type ReleaseBinding,
} from './automatic-release-crypto.ts';

export const receiptName = 'sermon-release-status.json';
export interface PublicReceipt extends Record<string, unknown> {
  version: 1;
  catalogSha256: string;
  publishAt: string;
  sourceCommit: string;
  manifest: ReturnType<
    typeof import('../src/lib/sermons/scheduled-release.ts').publicReleaseManifest
  >;
  files: Record<string, string>;
  mac: string;
}
export async function verifyLiveReceipt(
  receipt: PublicReceipt,
  key: string,
  binding: ReleaseBinding,
  catalog: SermonCatalog,
  expected: ExpectedRelease,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<void> {
  requireReleaseTime(expected, now);
  if (
    !verifyReceiptSeal(receipt, key, binding) ||
    receipt.version !== 1 ||
    receipt.catalogSha256 !== binding.catalogSha256 ||
    receipt.publishAt !== expected.publishAt ||
    !/^[0-9a-f]{40}$/.test(receipt.sourceCommit)
  )
    throw new Error('Live release receipt is invalid.');
  checkScheduledRelease(catalog, receipt.manifest, expected, now);
  if (
    receipt.files[receiptName] ||
    receipt.files['sermon-publication.json'] !==
      bytesDigest(Buffer.from(JSON.stringify(receipt.manifest))) ||
    [
      ...receipt.manifest.pages,
      ...receipt.manifest.downloads,
      'sermons.html',
    ].some((file) => !receipt.files[file])
  )
    throw new Error('Live receipt inventory is incomplete.');
  await verifyPublicFiles(receipt.files, fetcher);
}
/** A network error is not proof of absence. A signed but incomplete release may be retried. */
export async function probeLiveRelease(
  key: string,
  binding: ReleaseBinding,
  catalog: SermonCatalog,
  expected: ExpectedRelease,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<'absent' | 'already-live' | 'repair-needed'> {
  requireReleaseTime(expected, now);
  const url = new URL(receiptName, publicBase);
  url.searchParams.set('catalog', binding.catalogSha256);
  const response = await fetcher(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404) return 'absent';
  if (!response.ok) throw new Error('Live status unavailable; retry later.');
  const text = await response.text();
  if (text.length > 256 * 1024) throw new Error('Live receipt too large.');
  let receipt: PublicReceipt;
  try {
    receipt = JSON.parse(text);
  } catch {
    throw new Error('Live receipt is invalid.');
  }
  if (!verifyReceiptSeal(receipt, key, binding))
    throw new Error('Unrecognized live release; refusing to overwrite it.');
  try {
    await verifyLiveReceipt(
      receipt,
      key,
      binding,
      catalog,
      expected,
      fetcher,
      now,
    );
    return 'already-live';
  } catch {
    return 'repair-needed';
  }
}
