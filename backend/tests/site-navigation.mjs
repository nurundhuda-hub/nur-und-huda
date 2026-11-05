import assert from 'node:assert/strict';
import { chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function navigateSite(page, route) {
  const href = `/nur-und-huda/${route}.html`;
  if (await page.locator('.mobile-nav').isVisible()) {
    const tab = page.locator(`.mobile-nav a[href="${href}"]`);
    if (await tab.count()) await tab.click();
    else {
      await page.locator('[data-more-open]').click();
      await page.locator(`#mobile-more a[href="${href}"]`).click();
    }
  } else await page.locator(`.main-nav a[href="${href}"]`).click();
  await page.waitForURL('**' + href);
}

export async function verifyHomeNavigation(page, width, label) {
  const mobile = width < 768;
  assert.equal(await page.locator('.mobile-nav').isVisible(), mobile);
  assert.equal(
    await page.locator('.site-header .main-nav').isVisible(),
    !mobile,
  );
  assert.equal(await page.locator('.service-card').count(), 4);
  for (const card of await page.locator('.service-card').all()) {
    const box = await card.boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44);
  }
  if (mobile) {
    assert.equal(
      await page
        .locator('.mobile-nav [aria-current="page"]')
        .getAttribute('href'),
      '/nur-und-huda/index.html',
    );
    for (const tab of await page.locator('.mobile-nav > a').all()) {
      const box = await tab.boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44);
    }
    await page.evaluate(() =>
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'instant',
      }),
    );
    const footer = await page.locator('.footer-bottom').boundingBox();
    const bar = await page.locator('.mobile-nav').boundingBox();
    assert.ok(
      footer.y + footer.height <= bar.y,
      'Footer must be fully above fixed navigation',
    );
    await page.locator('[data-more-open]').click();
    assert.ok(await page.locator('#mobile-more[open]').isVisible());
    const shot = path.join(tmpdir(), `nur-${label}-more-${width}.png`);
    await page.screenshot({ path: shot });
    await chmod(shot, 0o600);
    assert.equal(
      await page.locator('[data-more-open]').getAttribute('aria-expanded'),
      'true',
    );
    await page.keyboard.press('Shift+Tab');
    assert.ok(
      await page.evaluate(() =>
        document.querySelector('#mobile-more').contains(document.activeElement),
      ),
    );
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () =>
        !document.querySelector('#mobile-more').open &&
        document
          .querySelector('[data-more-open]')
          .getAttribute('aria-expanded') === 'false',
    );
    assert.equal(
      await page.locator('[data-more-open]').getAttribute('aria-expanded'),
      'false',
    );
    assert.ok(
      await page
        .locator('[data-more-open]')
        .evaluate((node) => document.activeElement === node),
    );
  }
  const base = new URL('/nur-und-huda/', page.url()).href;
  for (const route of ['together', 'sermons', 'quran', 'library']) {
    await page.goto(base + 'index.html');
    await page
      .locator(`.service-card[href="/nur-und-huda/${route}.html"]`)
      .click();
    await page.waitForURL(base + route + '.html');
    assert.ok(await page.locator('main').isVisible());
    if (mobile) {
      const active = page.locator('.mobile-nav [aria-current="page"]');
      assert.equal(await active.count(), 1);
      if (route === 'sermons' || route === 'library')
        assert.equal(
          await active.getAttribute('href'),
          `/nur-und-huda/${route}.html`,
        );
      else assert.notEqual(await active.getAttribute('data-more-open'), null);
    }
  }
  await navigateSite(page, 'index');
  if (mobile) {
    await navigateSite(page, 'quran');
    await navigateSite(page, 'index');
  }
  await page.locator('.about-card').click();
  await page.waitForURL(base + 'legal.html#impressum');
  await navigateSite(page, 'index');
}
