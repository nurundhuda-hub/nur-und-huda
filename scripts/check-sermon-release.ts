import { readFile, lstat } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { sermonCatalog } from '../src/content/sermons.ts';
import { checkScheduledRelease } from '../src/lib/sermons/scheduled-release.ts';
const { values } = parseArgs({
  options: Object.fromEntries(
    ['publish-at', 'sermon', 'sermon-revision', 'study', 'study-revision'].map(
      (name) => [name, { type: 'string' as const }],
    ),
  ),
});
const required = (name: keyof typeof values) => {
  if (!values[name]) throw new Error(`Missing --${name}`);
  return values[name];
};
const manifest = JSON.parse(
  await readFile('dist/sermon-publication.json', 'utf8'),
);
const release = checkScheduledRelease(
  sermonCatalog,
  manifest,
  {
    publishAt: required('publish-at'),
    sermon: { id: required('sermon'), revision: required('sermon-revision') },
    study: { id: required('study'), revision: required('study-revision') },
  },
  Date.now(),
);
for (const file of [...release.pages, ...release.downloads])
  if (!(await lstat(`dist/${file}`)).isFile())
    throw new Error('Missing/nonregular release file.');
console.log(
  'Release timing/catalog/path check passed. This does not authorize disclosure or deploy anything.',
);
