import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Dedicated technical record only. Safe to run through the private live gateway.
export async function checkSermonEditorApi(base, cookie, origin) {
  assert.ok(
    ['https://nour-und-huda.web.app', 'https://localhost:4443'].includes(
      origin,
    ),
  );
  const path = '/nur-und-huda/api/sermons/editor-check';
  const headers = {
    Origin: origin,
    Cookie: cookie,
    'Content-Type': 'application/json',
  };
  async function call(action = '', body, custom = {}) {
    const r = await fetch(base + path + (action ? '/' + action : ''), {
      method: body ? 'POST' : 'GET',
      headers: { ...headers, ...custom },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, body: await r.json() };
  }
  assert.equal((await fetch(base + path)).status, 401);
  const redirect = await fetch(
    base + '/nur-und-huda/sermon-editor.html?id=editor-check',
    { redirect: 'manual' },
  );
  assert.equal(redirect.status, 303);
  assert.ok(
    decodeURIComponent(redirect.headers.get('location')).endsWith(
      'sermon-editor.html?id=editor-check',
    ),
  );
  const tooLarge = await call('draft', {
    content: { first: 'x'.repeat(240001) },
  });
  assert.equal(tooLarge.status, 413);
  assert.equal(
    (await call('draft', {}, { Origin: 'https://untrusted.invalid' })).status,
    403,
  );
  assert.equal((await call('draft', {}, { Cookie: '' })).status, 401);
  const start = await call();
  assert.equal(start.status, 200);
  let state = start.body;
  assert.equal(state.testOnly, true);
  const original = state.published.content;
  const unique = randomUUID();
  const edited = {
    ...original,
    title: 'اختبار تقني ' + unique,
    first: 'نَصٌّ تقني\n\nاختبار العربية e\u0301 <script>alert(1)</script>\n',
    second: 'تجربة ثانية — لا تُستخدم للخطبة',
    study: 'دراسة تقنية ' + unique,
  };
  const draft = {
    version: state.version,
    operationId: randomUUID(),
    content: edited,
  };
  assert.equal((await call('draft', draft)).status, 200);
  state = (await call()).body;
  assert.deepEqual(state.draft.content, edited);
  assert.deepEqual(state.published.content, original);
  assert.equal(
    (await call('publish', { ...draft, operationId: randomUUID() })).status,
    409,
  );
  const preview = await call('preview', { content: edited });
  assert.equal(preview.status, 200);
  assert.ok(preview.body.article.includes('&lt;script&gt;'));
  assert.ok(!preview.body.article.includes('<script>'));
  const publish = {
    version: state.version,
    operationId: randomUUID(),
    content: edited,
  };
  const [one, two] = await Promise.all([
    call('publish', publish),
    call('publish', publish),
  ]);
  assert.equal(one.status, 200);
  assert.equal(two.status, 200);
  state = (await call()).body;
  assert.deepEqual(state.published.content, edited);
  assert.equal(state.draft, null);
  assert.equal(state.published.number, start.body.published.number + 1);
  const rendered = await fetch(base + '/nur-und-huda/editor-check.html', {
    headers: { Cookie: cookie },
  });
  const html = await rendered.text();
  assert.equal(rendered.status, 200);
  assert.ok(html.includes(edited.title));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.equal(
    (
      await call('publish', {
        ...publish,
        version: state.version,
        operationId: randomUUID(),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call('restore', {
        version: state.version,
        operationId: randomUUID(),
      })
    ).status,
    200,
  );
  state = (await call()).body;
  assert.deepEqual(state.published.content, original);
  assert.equal(state.published.number, start.body.published.number + 2);
  assert.equal(state.published.restoredFrom, start.body.published.number);
  assert.equal(
    (
      await fetch(base + '/nur-und-huda/editor-seeds.json', {
        headers: { Cookie: cookie },
      })
    ).status,
    404,
  );
  console.log(
    'PASS dedicated editor test: session/Origin protection, exact Unicode, draft isolation, preview escaping, atomic conflicts, duplicate publish retry, served publication and restoration.',
  );
}
