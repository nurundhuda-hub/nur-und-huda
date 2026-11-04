import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { sermonArticle, studyArticle } from '../src/lib/sermons/render.ts';
import { renderOfflineSermon } from '../src/lib/sermons/offline.ts';
import { readerMarkup } from '../src/lib/sermons/reader-markup.ts';
import {
  sermonPath,
  studyPath,
  downloadPath,
} from '../src/lib/sermons/publication.ts';

/** Compare rendered approved bodies, not merely the presence of a title/link. */
export async function inspectPrivateSermonOutput(root, approved) {
  const { release } = approved;
  const { sermon, study } = release.published[0];
  const parse = (html) => new JSDOM(html).window.document;
  const normalize = (html) =>
    parse(`<article>${html}</article>`).querySelector('article').innerHTML;
  const file = (name) => readFile(path.join(root, name), 'utf8');
  for (const [route, expected] of [
    [
      sermonPath(sermon.id, sermon.revision),
      sermonArticle(release, sermon.id, sermon.revision, '/nur-und-huda/'),
    ],
    [
      studyPath(study.id, study.revision),
      studyArticle(release, study.id, study.revision, '/nur-und-huda/'),
    ],
  ]) {
    const doc = parse(await file(route));
    assert.equal(
      normalize(doc.querySelector('.sermon-article').innerHTML),
      normalize(expected),
      'Approved article changed',
    );
    assert.ok(doc.querySelector('[data-group-logout]'));
    if (route === sermonPath(sermon.id, sermon.revision))
      assert.equal(
        doc.querySelector('[data-sermon-reader]').outerHTML,
        parse(readerMarkup({ sermon, study })).querySelector(
          '[data-sermon-reader]',
        ).outerHTML,
        'Approved Imam Mode text changed',
      );
  }
  assert.equal(
    await file(downloadPath(sermon.id, sermon.revision)),
    renderOfflineSermon(release, sermon.id, sermon.revision),
  );
  const overview = parse(await file('sermons.html'));
  assert.ok(
    overview.querySelector(
      `a[href="/nur-und-huda/${sermonPath(sermon.id, sermon.revision)}"]`,
    ),
  );
  assert.ok(
    overview.querySelector(
      `a[href="/nur-und-huda/${studyPath(study.id, study.revision)}"]`,
    ),
  );
  const manifest = JSON.parse(await file('sermon-publication.json'));
  assert.equal(manifest.audience, 'private-group');
  assert.deepEqual(
    [...manifest.pages, ...manifest.downloads].sort(),
    [...approved.paths].sort(),
  );
  console.log(
    'PASS: exact approved sermon, study and offline output; private audience and normal navigation.',
  );
}
