// HTTP + served-module integration smoke test. JSDOM is not a visual browser.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';
import { splitSuppliedSermon } from '../src/lib/sermons/drafts.ts';
import {
  studyBlocks,
  STUDY_PREVIEW_PATH,
} from '../src/lib/sermons/private-study.ts';

const route = new URL(
  process.argv[2] ?? 'http://127.0.0.1:4340/nur-und-huda/_review/first-sermon',
);
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(route.hostname));
assert.equal(route.pathname, '/nur-und-huda/_review/first-sermon');
const response = await fetch(route);
assert.equal(response.status, 200, 'Exact local preview route');
assert.match(response.headers.get('cache-control'), /no-store/);
const html = await response.text();
const console = new VirtualConsole();
const errors = [];
console.on('jsdomError', (error) => {
  // JSDOM does not implement all modern CSS; do not treat this as layout verification.
  if (error.type !== 'css-parsing' && error.type !== 'css parsing')
    errors.push(error);
});
const dom = new JSDOM(html, {
  url: route.href,
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: console,
});
const { document } = dom.window;
// Native modal geometry is unavailable in JSDOM; exercise controller events only.
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
dom.window.HTMLDialogElement.prototype.close = function () {
  this.open = false;
  this.dispatchEvent(new dom.window.Event('close'));
};
const toolbar = document.querySelector('[data-preview-toolbar]');
assert.ok(toolbar && !toolbar.closest('dialog'));
assert.ok(
  toolbar.compareDocumentPosition(document.querySelector('h1')) &
    dom.window.Node.DOCUMENT_POSITION_FOLLOWING,
);
assert.equal(
  document.querySelector('[data-preview-approve]').disabled,
  true,
  'Real draft must remain blocked',
);
const source = await readFile(
  '.sermon-review/first-sermon-approved.txt',
  'utf8',
);
const spans = splitSuppliedSermon(source);
for (const parent of ['article', 'dialog']) {
  const parts = document.querySelectorAll(`${parent} [data-preview-part]`);
  assert.equal(parts.length, 2);
  parts.forEach((part, index) =>
    assert.equal(
      part.textContent,
      source
        .slice(spans[index].start, spans[index].end)
        .replace(/\*\*([^\n]+?)\*\*/g, '$1')
        .replaceAll('\r\n', '\n'),
    ),
  );
}
const context = dom.getInternalVMContext();
const modules = new Map();
const styles = new Map();
let count = 0;
const disposers = [];
async function load(url) {
  assert.equal(new URL(url).origin, route.origin, 'Only local modules');
  if (modules.has(url)) return modules.get(url);
  const pending = (async () => {
    if (new URL(url).pathname === '/@vite/client') {
      // Only HMR transport is stubbed; all application JS is fetched and executed.
      return new SyntheticModule(
        ['createHotContext', 'updateStyle', 'removeStyle'],
        function () {
          this.setExport('createHotContext', () => ({
            accept() {},
            dispose(fn) {
              disposers.push(fn);
            },
            prune() {},
          }));
          this.setExport('updateStyle', (id, css) => {
            styles.set(id, css);
            const style = document.createElement('style');
            style.textContent = css;
            document.head.append(style);
          });
          this.setExport('removeStyle', () => {});
        },
        { context, identifier: url },
      );
    }
    const res = await fetch(url);
    assert.equal(res.status, 200, `Module failed: ${new URL(url).pathname}`);
    assert.match(res.headers.get('content-type'), /javascript/);
    count++;
    return new SourceTextModule(await res.text(), {
      context,
      identifier: url,
      initializeImportMeta(meta) {
        meta.url = url;
      },
    });
  })();
  modules.set(url, pending);
  return pending;
}
try {
  const entry = await load(
    new URL(
      document.querySelector('script[type="module"]').getAttribute('src'),
      route,
    ).href,
  );
  await entry.link((specifier, referrer) =>
    load(new URL(specifier, referrer.identifier).href),
  );
  await entry.evaluate();
  assert.equal(
    toolbar.dataset.initialized,
    'true',
    'Served client initializes',
  );
  const article = document.querySelector('[data-preview-article]');
  const original = article.textContent;
  toolbar.querySelector('[data-preview-step="2"]').click();
  assert.equal(article.style.getPropertyValue('--reader-font'), '2.125rem');
  toolbar.querySelector('[data-preview-step="-2"]').click();
  assert.equal(article.style.getPropertyValue('--reader-font'), '2rem');
  toolbar.querySelector('[data-preview-step="2"]').click();
  toolbar.querySelector('[data-preview-reset]').click();
  assert.equal(article.style.getPropertyValue('--reader-font'), '2rem');
  const dialog = document.querySelector('dialog');
  document.querySelector('[data-reader-open]').click();
  assert.equal(dialog.open, true, 'Imam mode opens');
  const size = dialog.querySelector('[data-reader-size]');
  for (const value of [18, 32, 44]) {
    size.value = String(value);
    size.dispatchEvent(new dom.window.Event('input'));
    await Promise.resolve(); // Page synchronization uses a MutationObserver.
    assert.equal(
      dialog.style.getPropertyValue('--reader-font'),
      `${value / 16}rem`,
    );
    assert.equal(
      article.style.getPropertyValue('--reader-font'),
      `${value / 16}rem`,
    );
    for (const [root, title] of [
      [article, 'h1'],
      [dialog.querySelector('.reader-text'), '#reader-title'],
    ]) {
      assert.equal(
        dom.window.getComputedStyle(root).fontSize,
        'var(--reader-font, 2rem)',
      );
      // JSDOM cannot resolve var() font sizing: explicitly supply only the base
      // to check the served relative CSS cascade. This is not a browser measurement.
      root.style.fontSize = `${value}px`;
      assert.ok(
        Math.abs(
          parseFloat(
            dom.window.getComputedStyle(root.querySelector(title)).fontSize,
          ) -
            value * 1.45,
        ) < 0.01,
      );
      assert.ok(
        Math.abs(
          parseFloat(
            dom.window.getComputedStyle(root.querySelector('.khutbah-part h2'))
              .fontSize,
          ) -
            value * 1.2,
        ) < 0.01,
      );
      root
        .querySelectorAll('.content-block')
        .forEach((block) =>
          assert.equal(
            parseFloat(dom.window.getComputedStyle(block).fontSize),
            value,
          ),
        );
      root.style.removeProperty('font-size');
    }
  }
  dialog.querySelector('[data-font-reset]').click();
  dialog.querySelector('[data-reader-close]').click();
  assert.equal(dialog.open, false);
  assert.equal(
    document.activeElement,
    document.querySelector('[data-reader-open]'),
  );
  const review = document.querySelector('[data-preview-approval]');
  assert.equal(review.querySelector('details').open, false);
  const checks = review.querySelectorAll('[data-review-check]');
  assert.equal(checks.length, 7);
  const evidence = [...review.querySelectorAll('[data-review-evidence]')].map(
    (item) => item.textContent,
  );
  checks.forEach((check) => check.click());
  assert.equal(
    review.querySelector('[data-preview-approve]').disabled,
    true,
    'Checkboxes cannot approve missing evidence',
  );
  assert.deepEqual(
    [...review.querySelectorAll('[data-review-evidence]')].map(
      (item) => item.textContent,
    ),
    evidence,
  );
  assert.ok(
    !review.textContent.includes('--confirm-sha256'),
    'No command for incomplete review',
  );
  const theme = toolbar.querySelector('select');
  for (const value of ['dark', 'light']) {
    theme.value = value;
    theme.dispatchEvent(new dom.window.Event('change'));
    assert.equal(article.dataset.previewTheme, value);
  }
  assert.equal(article.textContent, original);
  assert.equal(
    JSON.parse(dom.window.localStorage.getItem('nur-und-huda.reader.v1')).theme,
    'light',
  );
  const css = [...styles.values()].join('\n');
  assert.match(css, /\.preview-toolbar\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /\.preview-toolbar\s*\{[^}]*z-index:\s*5/s);
  assert.equal(
    (await fetch(route, { method: 'POST' })).status,
    403,
    'No approval POST endpoint',
  );
  assert.deepEqual(errors, [], 'No application initialization errors');
  const studyLink = document.querySelector('.study-link a');
  assert.equal(studyLink?.textContent, 'اقرأ الموضوع كاملاً');
  assert.equal(studyLink?.getAttribute('href'), STUDY_PREVIEW_PATH);
  assert.match(
    document.querySelector('[data-local-study-presence]').textContent,
    /موافقة تحريرية فقط/,
  );
  const studyUrl = new URL(STUDY_PREVIEW_PATH, route);
  const studyResponse = await fetch(studyUrl);
  assert.equal(studyResponse.status, 200, 'Local study route');
  assert.match(studyResponse.headers.get('cache-control'), /no-store/);
  const studyPage = new JSDOM(await studyResponse.text());
  const studyRaw = await readFile(
    '.sermon-review/study-001-approved.md',
    'utf8',
  );
  const expectedBlocks = studyBlocks(studyRaw).filter(
    (block) => !['blank', 'rule'].includes(block.kind),
  );
  const studyBody = studyPage.window.document.querySelector(
    'article [data-private-study-body]',
  );
  const actualBlocks = [
    ...studyBody.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li'),
  ];
  assert.deepEqual(
    actualBlocks.map((node) => node.textContent),
    expectedBlocks.map((block) =>
      block.text.replace(/\*\*([^\n]+?)\*\*/g, '$1').replaceAll('\r\n', '\n'),
    ),
    'Study wording and order',
  );
  assert.ok(
    studyPage.window.document.querySelector(`nav a[href="${route.pathname}"]`),
    'Study links back to sermon',
  );
  assert.equal(
    studyPage.window.document.querySelector('script').getAttribute('src'),
    document.querySelector('script').getAttribute('src'),
    'Same local reader client',
  );
  disposers.forEach((dispose) => dispose());
  document.body.innerHTML = studyPage.window.document.body.innerHTML;
  studyPage.window.close();
  const controlsEntry = [...modules.keys()].find(
    (url) => new URL(url).pathname === '/src/dev/preview-controls.ts',
  );
  assert.ok(controlsEntry, 'Served study reader controller');
  const cleanupStudy = (
    await modules.get(controlsEntry)
  ).namespace.initPreviewControls(document);
  try {
    assert.equal(
      document.querySelector('[data-preview-toolbar]').dataset.initialized,
      'true',
    );
    document.querySelector('[data-preview-step="2"]').click();
    assert.equal(
      document
        .querySelector('[data-preview-article]')
        .style.getPropertyValue('--reader-font'),
      '2.125rem',
    );
    const studyTheme = document.querySelector('select[data-preview-theme]');
    studyTheme.value = 'dark';
    studyTheme.dispatchEvent(new dom.window.Event('change'));
    assert.equal(
      document.querySelector('[data-preview-article]').dataset.previewTheme,
      'dark',
    );
    assert.equal(
      document.querySelector('[data-preview-approve]'),
      null,
      'Study presence adds no approval action',
    );
  } finally {
    cleanupStudy();
  }
  assert.equal((await fetch(studyUrl, { method: 'POST' })).status, 403);
  assert.ok(
    (
      await fetch(
        new URL(
          '/nur-und-huda/.sermon-review/study-001-approved.md?raw',
          route,
        ),
      )
    ).status >= 400,
    'No direct source serving',
  );
  assert.deepEqual(errors, []);
  process.stdout.write(
    `PASS: exact sermon and study HTTP routes; ${count} served JS/CSS modules; bidirectional navigation; source-preserving study structure; study font/theme controls; page and imam controls; proportional CSS hierarchy at 18/32/44 supplied bases; exact two-part text; all checkboxes still cannot approve incomplete evidence; POST and direct study source denied.\nJSDOM execution only (modal methods stubbed, CSS variable bases supplied for cascade checks): Safari/device rendering, reflow geometry, native print/fullscreen/wake-lock are unverified.\n`,
  );
} finally {
  dom.window.close();
}
