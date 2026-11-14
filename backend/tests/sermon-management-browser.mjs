import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { verifyImamScroll } from './imam-scroll-browser.mjs';

// Mutations are restricted to the isolated demo emulator. NEVER run against production.
export async function verifySermonManagement(
  browser,
  origin,
  authenticate,
  engine,
) {
  assert.equal(origin, 'https://localhost:4443');
  const base = origin + '/nur-und-huda/',
    options = {
      ignoreHTTPSErrors: true,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    };
  const a = await browser.newContext(options),
    b = await browser.newContext(options),
    anonymous = await browser.newContext(options);
  const errors = [];
  try {
    await authenticate(a);
    await authenticate(b);
    const p = await a.newPage(),
      q = await b.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    q.on('pageerror', (e) => errors.push(e.message));
    const manager = base + 'api/sermons/manage';
    const get = async () => {
      const r = await a.request.get(manager);
      assert.equal(r.status(), 200);
      return r.json();
    };
    const mutate = async (action, fields, version) =>
      a.request.post(manager + '/' + action, {
        headers: { Origin: origin },
        data: {
          version: version ?? (await get()).version,
          operationId: randomUUID(),
          ...fields,
        },
      });
    assert.equal((await anonymous.request.get(manager)).status(), 401);
    assert.equal(
      (
        await anonymous.request.post(manager + '/create', {
          headers: { Origin: origin },
          data: {},
        })
      ).status(),
      401,
    );
    assert.equal(
      (
        await a.request.post(manager + '/create', {
          headers: { Origin: 'https://invalid.example' },
          data: {},
        })
      ).status(),
      403,
    );
    // The real November IDs are synthetic emulator state here; only metadata changes.
    const published = await (
      await a.request.get(base + 'api/sermons/meaning-of-testimony')
    ).json();
    const move = await mutate('move', {
      sermonId: 'meaning-of-testimony',
      fromDate: '2026-11-13',
      date: '2026-11-20',
    });
    assert.equal(move.status(), 200);
    assert.equal(
      (await get()).assignments['2026-11-13'].status,
      'not-delivered',
    );
    assert.equal(
      (await get()).assignments['2026-11-20'].sermonId,
      'meaning-of-testimony',
    );
    assert.deepEqual(
      (
        await (
          await a.request.get(base + 'api/sermons/meaning-of-testimony')
        ).json()
      ).published,
      published.published,
    );
    assert.equal((await mutate('undo', {})).status(), 200);
    await p.goto(base + 'sermons.html');
    await p.getByRole('link', { name: 'خطبة جديدة', exact: true }).click();
    await p.locator('[data-editor-form]').waitFor({ state: 'visible' });
    const title = 'اختبار إدارة الخطب — ' + randomUUID(),
      first =
        'نَصٌّ تقنيٌّ فقط، وليس مادة دينية. e\u0301 <b>اختبار</b> $&\n\n'.repeat(
          70,
        ),
      second = 'الجزء الثاني لاختبار القراءة فقط.\n\n'.repeat(70),
      study = 'دراسة تقنية للتجربة\n\nبدون محتوى ديني.';
    await p.locator('#edit-title').fill(title);
    await p.locator('#edit-first').fill(first);
    await p.locator('#edit-second').fill(second);
    await p.locator('#edit-study').fill(study);
    await p.getByRole('button', { name: 'معاينة', exact: true }).click();
    await p
      .locator('[data-editor-preview-panel]')
      .waitFor({ state: 'visible' });
    assert.ok(
      (await p.locator('[data-editor-preview-article]').textContent()).includes(
        first,
      ),
    );
    assert.equal(await p.locator('[data-editor-preview-article] b').count(), 0);
    assert.ok(!(await get()).sermons.some((s) => s.title === title));
    await p.locator('[data-editor-preview-close]').click();
    await p.getByRole('button', { name: 'حفظ المسودة', exact: true }).click();
    await p
      .locator('[data-editor-status]')
      .filter({ hasText: 'حُفظت المسودة' })
      .waitFor();
    const id = new URL(p.url()).searchParams.get('id');
    assert.match(id, /^s-/);
    const api = base + 'api/sermons/' + id;
    const draft = await (await a.request.get(api)).json();
    assert.equal(draft.published, null);
    assert.equal(draft.draft.content.first, first);
    assert.equal((await b.request.get(base + draft.path)).status(), 404);
    assert.equal(
      (
        await anonymous.request.get(base + draft.path, { maxRedirects: 0 })
      ).status(),
      303,
    );
    await q.goto(p.url());
    await q.locator('[data-editor-form]').waitFor({ state: 'visible' });
    assert.equal(await q.locator('#edit-first').inputValue(), first);
    await p.reload();
    await p.locator('[data-editor-form]').waitFor({ state: 'visible' });
    await p.getByRole('button', { name: 'نشر', exact: true }).click();
    await p.locator('[data-editor-confirm-ok]').click();
    await p
      .locator('[data-editor-status]')
      .filter({ hasText: 'نُشرت التعديلات' })
      .waitFor();
    const pub = await (await b.request.get(api)).json();
    assert.equal(pub.published.number, 1);
    assert.equal(pub.published.content.first, first);
    await q.goto(base + pub.path);
    assert.equal(
      await q
        .locator('.sermon-article .khutbah-part')
        .first()
        .locator('.content-block')
        .textContent(),
      first,
    );
    const studyLink = q.getByRole('link', {
      name: 'اقرأ الموضوع كاملاً',
      exact: true,
    });
    await studyLink.click();
    assert.ok(
      (await q.locator('.sermon-article').textContent()).includes(study),
    );
    await q
      .getByRole('link', { name: 'العودة إلى الخطبة', exact: true })
      .click();
    assert.equal(q.url(), base + pub.path);
    await verifyImamScroll(q, base + pub.path, 'management-' + engine);
    const offline = await b.request.get(
      base + 'downloads/sermons/' + id + '.html',
    );
    assert.equal(offline.status(), 200);
    assert.ok((await offline.text()).includes('&lt;b&gt;اختبار&lt;/b&gt; $&'));
    await p.goto(base + 'sermons.html');
    await p.locator('[data-management-ready="true"]').waitFor();
    await p.locator('[data-schedule-reuse]').click();
    await p.locator('#schedule-sermon').selectOption(id);
    await p.locator('#schedule-friday').fill('2027-01-08');
    await p.locator('[data-schedule-form] button[type=submit]').click();
    await p.locator('[data-management-yes]').click();
    await p
      .locator('[data-management-status]')
      .filter({ hasText: 'تم حفظ التغيير' })
      .waitFor();
    assert.equal((await get()).assignments['2027-01-08'].sermonId, id);
    // Move using the real date UI; history remains and published content is untouched.
    await p
      .locator(`[data-schedule-id="${id}"][data-schedule-from="2027-01-08"]`)
      .click();
    await p.locator('#schedule-friday').fill('2027-01-15');
    await p.locator('[data-schedule-form] button[type=submit]').click();
    await p.locator('[data-management-yes]').click();
    await p.locator('[data-schedule-dialog]').waitFor({ state: 'hidden' });
    assert.equal(
      (await get()).assignments['2027-01-08'].status,
      'not-delivered',
    );
    assert.equal((await get()).assignments['2027-01-15'].status, 'scheduled');
    const conflict = await mutate('assign', {
      sermonId: 'learn-our-religion',
      date: '2027-01-15',
    });
    assert.equal(conflict.status(), 409);
    assert.equal(
      (await mutate('assign', { sermonId: id, date: '2026-10-30' })).status(),
      200,
    );
    await p.reload();
    await p
      .locator('[data-delivery="delivered"][data-date="2026-10-30"]')
      .click();
    await p.locator('[data-management-yes]').click();
    await p
      .locator('[data-management-status]')
      .filter({ hasText: 'تم حفظ التغيير' })
      .waitFor();
    assert.equal((await get()).assignments['2026-10-30'].status, 'delivered');
    await p
      .locator('[data-delivery="not-delivered"][data-date="2026-10-30"]')
      .click();
    const deliverySaved = p.waitForResponse(
      (response) =>
        response.url().endsWith('/api/sermons/manage/delivery') &&
        response.request().method() === 'POST',
    );
    await p.locator('[data-management-yes]').click();
    assert.equal((await deliverySaved).status(), 200);
    await p.waitForFunction(
      () =>
        document
          .querySelector('[data-sermon-management]')
          .getAttribute('aria-busy') === 'false',
    );
    assert.equal(
      (await get()).assignments['2026-10-30'].status,
      'not-delivered',
    );
    const version = (await get()).version;
    const concurrent = await Promise.all([
      mutate('assign', { sermonId: id, date: '2027-02-05' }, version),
      mutate('assign', { sermonId: id, date: '2027-02-12' }, version),
    ]);
    assert.deepEqual(concurrent.map((r) => r.status()).sort(), [200, 409]);
    assert.deepEqual(
      (await (await b.request.get(api)).json()).published,
      pub.published,
    );
    // Read-only mobile/desktop presentation checks of the management page.
    await p.reload();
    await p.locator('[data-schedule-reuse]').waitFor();
    for (const width of [320, 375, 390, 430, 768, 1440]) {
      await p.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await p.evaluate(() => window.scrollTo(0, 0));
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      const shot = path.join(tmpdir(), `nur-management-${engine}-${width}.png`);
      await p.screenshot({ path: shot });
      await chmod(shot, 0o600);
    }
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${engine} management: creation, exact Unicode drafts/preview/publish, second-session reader/study/download, ten speeds, November metadata-only correction, schedule/move/reuse, delivery, conflict/concurrency and unauthorized rejection; synthetic emulator only.`,
    );
  } finally {
    for (const context of [a, b])
      await context.request.post(origin + '/access/logout', {
        headers: { Origin: origin },
        maxRedirects: 0,
      });
    await a.close();
    await b.close();
    await anonymous.close();
  }
}
