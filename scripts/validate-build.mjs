import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { JSDOM } from 'jsdom';

const root = path.resolve('dist');
const base = '/nur-und-huda/';
const origin = 'https://nurundhuda-hub.github.io';
const pages = [
  'index.html',
  'together.html',
  'sermons.html',
  'quran.html',
  'library.html',
  'legal.html',
];
const logoHash =
  '547d63a94e56f7c6a8b4e9f17370dc8f0c1ed3e733cceac7bb61f0fda8b824f5';
const tagline = 'منبر للذكر .. ومرجع للعلم النافع';
const documents = new Map();
const inlineScripts = new Set();

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
  'Exactly the six preserved HTML routes must be built.',
);

for (const page of pages) {
  const html = await readFile(path.join(root, page), 'utf8');
  const document = new JSDOM(html, { url: `${origin}${base}${page}` }).window
    .document;
  documents.set(page, document);
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
    document.querySelectorAll('form, iframe').length,
    0,
    `${page}: no submissions or embeds`,
  );
  assert.equal(document.querySelectorAll('script[src="app.js"]').length, 0);
  assert.equal(document.querySelectorAll('.main-nav a').length, 5);
  assert.equal(
    document.querySelectorAll('.main-nav [aria-current="page"]').length,
    page === 'legal.html' ? 0 : 1,
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
    if (node.tagName !== 'A') {
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
  if (/\.(html|js|json)$/.test(file)) {
    assert.ok(
      !(await readFile(file, 'utf8')).includes(
        'SYNTHETIC_PRAYER_TEST_ONLY_NOT_FOR_WORSHIP',
      ),
      'Synthetic prayer fixture leaked into public output',
    );
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
assert.ok(
  javascriptGzip <= 50 * 1024,
  'Public JS exceeds the 50 KiB gzip budget',
);
for (const file of [
  'assets/logo.jpeg',
  'public/assets/logo.jpeg',
  'dist/assets/logo.jpeg',
]) {
  assert.equal(
    createHash('sha256')
      .update(await readFile(file))
      .digest('hex'),
    logoHash,
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
  documents.get('index.html').querySelectorAll('[data-countdown], time').length,
  0,
  'No invented countdown or prayer times',
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
  `PASS: ${pages.length} static routes, local links/fragments/assets, first-party subresources, logo integrity, local font licenses, monochrome font tables. Total JS: ${javascriptGzip} bytes gzip; ${fontCount} WOFF2 assets.`,
);
