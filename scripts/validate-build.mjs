import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { JSDOM } from 'jsdom';
import { assertPrivateSermonAbsent } from './sermon-privacy.mjs';

const root = path.resolve('dist');
const base = '/nur-und-huda/';
const origin = 'https://nurundhuda-hub.github.io';
const corePages = [
  'index.html',
  'together.html',
  'sermons.html',
  'quran.html',
  'library.html',
  'legal.html',
];
const publication = JSON.parse(
  await readFile(path.join(root, 'sermon-publication.json'), 'utf8'),
);
assert.ok(
  Array.isArray(publication.pages) && Array.isArray(publication.downloads),
);
for (const route of publication.pages)
  assert.match(
    route,
    /^(sermons|studies)\/[a-z0-9]+(?:-[a-z0-9]+)*\/r[1-9]\d{0,5}\.html$/,
  );
for (const route of publication.downloads)
  assert.match(
    route,
    /^downloads\/sermons\/[a-z0-9]+(?:-[a-z0-9]+)*\/r[1-9]\d{0,5}\.html$/,
  );
const pages = [...corePages, ...publication.pages, ...publication.downloads];
assert.equal(
  new Set(pages).size,
  pages.length,
  'No duplicate published content paths',
);
const logoHash =
  'eddb402b089505bcde1f80e5638748ddf1928e056eb82e388b0f3f7c70bf21f1';
const optimizedLogoHash =
  '0841fa0fed1cd3b84b407d5748efe37d114005cdec391e7429259da7f9a82ac0';
const tagline = 'منبر للذكر .. ومرجع للعلم النافع';
const documents = new Map();
const inlineScripts = new Set();
// Local defense in depth. CI has no private files and still runs marker/gating tests.
const privateSources = [];
for (const name of ['first-sermon-approved.txt', 'study-001-approved.md']) {
  try {
    privateSources.push(await readFile(`.sermon-review/${name}`, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? walk(path.join(directory, entry.name))
        : path.join(directory, entry.name),
    ),
  );
  return files.flat();
}
const files = await walk(root);
assert.deepEqual(
  files
    .filter((file) => file.endsWith('.html'))
    .map((file) => path.relative(root, file))
    .sort(),
  [...pages].sort(),
  'Only the six core routes and gated published sermon/study/download routes may be built.',
);

for (const page of pages) {
  const html = await readFile(path.join(root, page), 'utf8');
  const document = new JSDOM(html, { url: `${origin}${base}${page}` }).window
    .document;
  documents.set(page, document);
  privateSources.forEach((source) =>
    assertPrivateSermonAbsent(document.body.textContent, source),
  );
  for (const script of document.querySelectorAll('script:not([src])')) {
    if (script.textContent.trim()) inlineScripts.add(script.textContent);
  }
  assert.equal(document.documentElement.lang, 'ar');
  assert.equal(document.documentElement.dir, 'rtl');
  assert.equal(
    document.querySelectorAll('h1').length,
    1,
    `${page}: exactly one h1`,
  );
  assert.ok(document.querySelector('main#main-content'));
  assert.ok(document.querySelector('.skip-link[href="#main-content"]'));
  assert.ok(
    document.body.textContent.includes(tagline),
    `${page}: exact tagline`,
  );
  assert.equal(
    document.querySelectorAll('form').length,
    page === 'together.html' ? 1 : 0,
    `${page}: only the isolated prayer service has a submission form`,
  );
  const frames = [...document.querySelectorAll('iframe')];
  assert.equal(frames.length, page === 'index.html' ? 1 : 0);
  for (const frame of frames) {
    assert.equal(
      frame.getAttribute('src'),
      'https://mawaqit.net/ar/w/nur-und-huda-gebetsraum-im-krankenhaus-hamm-59073-deutschland?showOnly5PrayerTimes=0',
    );
    assert.ok(frame.closest('[data-mawaqit-card]'));
    assert.ok(frame.title);
    assert.equal(
      frame.getAttribute('sandbox'),
      'allow-scripts allow-same-origin',
    );
    assert.equal(frame.getAttribute('referrerpolicy'), 'no-referrer');
  }
  assert.equal(document.querySelectorAll('script[src="app.js"]').length, 0);
  if (!publication.downloads.includes(page)) {
    assert.equal(document.querySelectorAll('.main-nav a').length, 5);
    assert.equal(
      document.querySelectorAll('.main-nav [aria-current="page"]').length,
      page === 'legal.html' ? 0 : 1,
    );
  } else
    assert.equal(
      document.querySelectorAll('script, iframe').length,
      0,
      'Offline sermons are self-contained documents without scripts',
    );
  for (const dialog of document.querySelectorAll('dialog')) {
    assert.ok(
      document.getElementById(dialog.getAttribute('aria-labelledby')),
      'Dialog must be named',
    );
  }
  const ids = [...document.querySelectorAll('[id]')].map((node) => node.id);
  assert.equal(ids.length, new Set(ids).size, `${page}: unique IDs`);
}

async function resolveLocal(reference, from) {
  const url = new URL(reference, `${origin}${base}${from}`);
  if (url.protocol === 'mailto:') return;
  if (url.origin !== origin) return;
  assert.ok(
    url.pathname.startsWith(base),
    `Path escapes GitHub Pages base: ${reference}`,
  );
  const relative =
    decodeURIComponent(url.pathname.slice(base.length)) || 'index.html';
  const file = path.resolve(root, relative);
  assert.ok(
    file.startsWith(`${root}${path.sep}`),
    'Path must stay inside dist',
  );
  assert.ok((await stat(file)).isFile(), `Missing built file: ${relative}`);
  if (url.hash && documents.has(relative)) {
    assert.ok(
      documents
        .get(relative)
        .getElementById(decodeURIComponent(url.hash.slice(1))),
      `Missing fragment: ${reference}`,
    );
  }
}

for (const [page, document] of documents) {
  for (const node of document.querySelectorAll('[href], [src]')) {
    const reference = node.getAttribute('href') ?? node.getAttribute('src');
    // Only the exact homepage iframe checked above may be a third-party resource.
    if (node.tagName !== 'A' && node.tagName !== 'IFRAME') {
      assert.equal(
        new URL(reference, `${origin}${base}${page}`).origin,
        origin,
        `${page}: no external subresources`,
      );
    }
    await resolveLocal(reference, page);
  }
}

let javascriptGzip = [...inlineScripts].reduce(
  (size, script) => size + gzipSync(script).length,
  0,
);
let fontCount = 0;
for (const file of files) {
  if (/\.(html|js|json|xml|map|txt)$/.test(file)) {
    const contents = await readFile(file, 'utf8');
    privateSources.forEach((source) =>
      assertPrivateSermonAbsent(contents, source),
    );
    for (const marker of [
      'SYNTHETIC_PRAYER_TEST_ONLY_NOT_FOR_WORSHIP',
      'REFERENCE_SAMPLES_NOT_AN_APPROVED_TIMETABLE',
      'REVIEW_ONLY_NOT_FOR_WORSHIP',
      'LOCAL_TIMETABLE_REVIEW_ONLY_NOT_FOR_WORSHIP',
      'LOCAL_SOURCE_REGISTER_NOT_AUTHORIZATION',
      'SERMON_TEST_ONLY_NOT_RELIGIOUS_CONTENT',
      'SERMON_PRIVATE_REVIEW_ONLY',
      'SERMON_LOCAL_APPROVAL_ONLY',
      'STUDY_PRIVATE_EDITORIAL_ONLY',
      'SERMON_PAIR_PREPARATION_ONLY',
      'SERMON_PRIVATE_CONTENT_REVIEW_ONLY',
      'SERMON_PRIVATE_SCHEDULE_PREPARATION_ONLY',
      'study-001-approved.md',
      'data-private-study-body',
      'data-local-sermon-card',
      'NUR_RELEASE_KEY',
      'NUR_RELEASE_PAYLOAD',
      'task28-release-key.txt',
      'task28-release-payload.txt',
      '/_review/first-study',
      'supplied-markdown-verbatim',
      'data-preview-part',
      '/_review/first-sermon',
      'sermon-preview-client',
      'data-preview-toolbar',
      'data-preview-approval',
      'data-preview-approve',
      'نسخة تجريبية للمراجعة — غير منشورة للعامة',
    ]) {
      assert.ok(
        !contents.includes(marker),
        `Prayer review/test data leaked into public output: ${marker}`,
      );
    }
  }
  if (file.endsWith('.js'))
    javascriptGzip += gzipSync(await readFile(file)).length;
  if (file.endsWith('.woff2')) fontCount++;
  if (file.endsWith('.css')) {
    const css = await readFile(file, 'utf8');
    assert.ok(
      !/https?:\/\/|Aref Ruqaa Ink|mix-blend-mode/i.test(css),
      'CSS must not import remote assets, colored Ink fonts or blend the logo',
    );
    for (const match of css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)) {
      if (!match[1].startsWith('data:'))
        await resolveLocal(match[1], path.relative(root, file));
    }
  }
}
assert.ok(fontCount > 0, 'Local font assets must be present');
assert.equal(
  await readFile('dist/licenses/adhan-MIT.txt', 'utf8'),
  await readFile('node_modules/adhan/LICENSE', 'utf8'),
  'Distribute the unchanged Adhan MIT copyright and permission notice',
);
assert.ok(
  javascriptGzip <= 50 * 1024,
  'Public JS exceeds the 50 KiB gzip budget',
);
for (const file of [
  'assets/logo.png',
  'public/assets/logo.webp',
  'dist/assets/logo.webp',
]) {
  assert.equal(
    createHash('sha256')
      .update(await readFile(file))
      .digest('hex'),
    file.endsWith('.webp') ? optimizedLogoHash : logoHash,
    file,
  );
}
for (const font of ['amiri', 'aref-ruqaa']) {
  assert.ok(
    (await readFile(`dist/licenses/${font}-OFL.txt`, 'utf8')).includes(
      'SIL OPEN FONT LICENSE Version 1.1',
    ),
  );
  // Fontsource supplies equivalent WOFF and WOFF2 subsets. Inspect the WOFF
  // directory for color tables without altering the shipped font assets.
  for (const weight of font === 'amiri' ? [400, 700] : [700]) {
    for (const subset of ['arabic', 'latin']) {
      const buffer = await readFile(
        `node_modules/@fontsource/${font}/files/${font}-${subset}-${weight}-normal.woff`,
      );
      assert.equal(buffer.toString('ascii', 0, 4), 'wOFF');
      const tables = Array.from(
        { length: buffer.readUInt16BE(12) },
        (_, index) =>
          buffer.toString('ascii', 44 + index * 20, 48 + index * 20),
      );
      assert.ok(
        !tables.some((tag) =>
          ['COLR', 'CPAL', 'SVG ', 'CBDT', 'CBLC', 'sbix'].includes(tag),
        ),
        `${font}: unexpected color font table`,
      );
    }
  }
}
assert.equal(
  documents
    .get('index.html')
    .querySelectorAll('[data-countdown], time:not(.friday-info time)').length,
  0,
  'No invented countdown or prayer times',
);
assert.deepEqual(
  [...documents.get('index.html').querySelectorAll('.friday-info time')].map(
    (node) => [node.getAttribute('datetime'), node.textContent],
  ),
  [
    ['13:00', '13:00'],
    ['13:30', '13:30'],
  ],
  'Only the owner-supplied, provider-confirmed Friday entries are rendered locally',
);
assert.equal(
  documents.get('index.html').querySelectorAll('[data-prayer-payload]').length,
  0,
  'Production prayer data remains inactive until separately reviewed and approved',
);
for (const page of ['index.html', 'library.html']) {
  assert.equal(
    documents.get(page).querySelectorAll('[data-source-item]').length,
    2,
    'Only verified source directories',
  );
}
console.log(
  `PASS: ${pages.length} static routes, local links/fragments/assets, first-party subresources plus the exact official MAWAQIT iframe, logo integrity, local font licenses, monochrome font tables. Total JS: ${javascriptGzip} bytes gzip; ${fontCount} WOFF2 assets.`,
);
