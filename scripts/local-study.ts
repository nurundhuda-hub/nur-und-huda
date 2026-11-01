import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import {
  createPrivateStudyRevision,
  STUDY_SOURCE_FILE,
  STUDY_REVISION_FILE,
  type PrivateStudyRevision,
} from '../src/lib/sermons/private-study.ts';

export async function privateReviewRoot(): Promise<string> {
  const root = path.resolve('.sermon-review');
  if (
    !(await lstat(root)).isDirectory() ||
    (await realpath(root)) !== path.join(await realpath('.'), '.sermon-review')
  )
    throw new Error('Private root must be a local regular directory.');
  return root;
}
export async function privateFile(root: string, name: string): Promise<Buffer> {
  if (
    path.basename(name) !== name ||
    !(await lstat(path.join(root, name))).isFile()
  )
    throw new Error('Private input must be a regular file, not a symlink.');
  return readFile(path.join(root, name));
}
export type LocalStudy =
  | { state: 'present'; revision: PrivateStudyRevision }
  | { state: 'missing' | 'invalid' };
export async function loadLocalStudy(
  root: string,
  sermonSource: Uint8Array,
): Promise<LocalStudy> {
  try {
    const source = await privateFile(root, STUDY_SOURCE_FILE);
    const revision = JSON.parse(
      (await privateFile(root, STUDY_REVISION_FILE)).toString(),
    ) as PrivateStudyRevision;
    const bundle = JSON.parse(
      (await privateFile(root, 'first-sermon-r1.bundle.json')).toString(),
    );
    const rebuilt = createPrivateStudyRevision(
      source,
      sermonSource,
      bundle,
      revision.importedAt,
      revision.editorial?.status === 'owner-approved',
    );
    if (JSON.stringify(rebuilt) !== JSON.stringify(revision))
      return { state: 'invalid' };
    return { state: 'present', revision };
  } catch (error) {
    return {
      state:
        (error as NodeJS.ErrnoException).code === 'ENOENT'
          ? 'missing'
          : 'invalid',
    };
  }
}
