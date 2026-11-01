// HTTP + served-module integration smoke test. JSDOM is not a visual browser.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';
import { splitSuppliedSermon } from '../src/lib/sermons/drafts.ts';

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
            dispose() {},
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
  process.stdout.write(
    `PASS: exact preview HTTP route; ${count} served JS/CSS modules; visible-page markup; initialized +/−/reset/themes; exact two-part text; disabled approval; POST denied.\nJSDOM execution only: Safari/device rendering, sticky geometry, native print/fullscreen/wake-lock are unverified.\n`,
  );
} finally {
  dom.window.close();
}
