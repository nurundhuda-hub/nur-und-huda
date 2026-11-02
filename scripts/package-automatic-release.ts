import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { privateReviewRoot, privateFile } from './local-study.ts';
import {
  firstRelease,
  firstReleaseCatalogSha256,
} from '../src/lib/sermons/first-release.ts';
import { repository, validateReleaseCatalog } from './pages-release-support.ts';
import {
  decryptCatalog,
  encryptCatalog,
  newReleaseKey,
} from './automatic-release-crypto.ts';
import { workflowDigest } from '../src/lib/sermons/approval-workflow.ts';
try {
  const root = await privateReviewRoot();
  const catalog = JSON.parse(
    (await privateFile(root, 'task27-public-catalog.json')).toString(),
  );
  validateReleaseCatalog(catalog, firstRelease, firstReleaseCatalogSha256);
  const binding = {
    repository,
    catalogSha256: firstReleaseCatalogSha256,
    publishAt: firstRelease.publishAt,
  };
  const key = newReleaseKey(),
    payload = encryptCatalog(catalog, key, binding);
  if (
    workflowDigest(decryptCatalog(payload, key, binding)) !==
    firstReleaseCatalogSha256
  )
    throw new Error();
  await writeFile(path.join(root, 'task28-release-key.txt'), key, {
    flag: 'wx',
    mode: 0o600,
  });
  await writeFile(path.join(root, 'task28-release-payload.txt'), payload, {
    flag: 'wx',
    mode: 0o600,
  });
  console.log(
    'Encrypted package prepared locally; both secret files are mode 0600. No content/key printed, uploaded or activated.',
  );
} catch {
  console.error(
    'Package preparation failed. Check the approved local catalog and exclusive output filenames; no plaintext diagnostics are emitted.',
  );
  process.exitCode = 1;
}
