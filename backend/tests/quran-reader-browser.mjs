import assert from 'node:assert/strict';
import { readFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { navigateSite } from './site-navigation.mjs';

// A real remote-reader check, not a mocked iframe load. Does not transcribe or log
// Quran text. Cross-origin inspection here is test tooling only, never site code.
export async function verifyQuranReader(page, base, label, width) {
  const surahs = JSON.parse(
    await readFile('src/data/quran-surahs.json', 'utf8'),
  );
  await page.goto(base + 'index.html', { waitUntil: 'domcontentloaded' });
  // Wait for responsive CSS before choosing mobile versus desktop navigation.
  await page.waitForFunction(
    (w) =>
      (getComputedStyle(document.querySelector('.mobile-nav')).display !==
        'none') ===
      w < 768,
    width,
  );
  await navigateSite(page, 'quran');
  const iframe = page.locator('[data-quran-frame]');
  const desktop = width >= 1100;
  const provider = desktop
    ? 'https://quran.ksu.edu.sa/index.php?l=ar'
    : 'https://quran.ksu.edu.sa/m.php';
  await page.waitForFunction(
    () => !document.querySelector('[data-quran-surah]').disabled,
  );
  assert.equal(await iframe.getAttribute('src'), provider + '#aya=1_1');
  assert.equal(await page.locator('[data-quran-surah] option').count(), 114);
  async function reading(surah) {
    const expectedPage = surahs[surah - 1].page;
    // Locate the live child only after the new frame's document has loaded.
    let frame;
    for (let attempt = 0; attempt < 100; attempt++) {
      const handle = await iframe.elementHandle();
      frame = await handle.contentFrame();
      if (frame && frame.url().startsWith(provider)) break;
      await page.waitForTimeout(100);
    }
    assert.ok(frame && frame.url().startsWith(provider));
    if (!desktop) {
      await frame.waitForFunction(
        () =>
          document.querySelector('#flang_ar') ||
          document.querySelector('#img15'),
        null,
        { timeout: 45000 },
      );
      if (await frame.locator('#flang_ar').isVisible())
        await frame.locator('#flang_ar').tap();
    }
    await frame.waitForFunction(
      (p) =>
        [...document.images].some(
          (img) =>
            new RegExp('/' + p + '\\.png(?:$|\\?)').test(img.src) &&
            img.complete &&
            img.naturalWidth >= 450,
        ),
      expectedPage,
      { timeout: 45000 },
    );
    await frame.waitForFunction(
      (p) =>
        [...document.images].some((img) => {
          const box = img.getBoundingClientRect();
          return (
            new RegExp('/' + p + '\\.png(?:$|\\?)').test(img.src) &&
            img.complete &&
            img.naturalWidth >= 450 &&
            box.width > 100 &&
            box.height > 100 &&
            box.right > 0 &&
            box.left < innerWidth &&
            box.bottom > 0 &&
            box.top < innerHeight
          );
        }),
      expectedPage,
      { timeout: 45000 },
    );
    const image = await frame.locator('img').evaluateAll((images, p) => {
      const img = images.find(
        (i) =>
          new RegExp('/' + p + '\\.png(?:$|\\?)').test(i.src) &&
          i.naturalWidth >= 450,
      );
      return {
        url: img.src,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      };
    }, expectedPage);
    assert.equal(new URL(image.url).hostname, 'quran.ksu.edu.sa');
    assert.ok(image.naturalHeight > image.naturalWidth);
    assert.ok(
      await frame.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    return frame;
  }
  await reading(1);
  for (const id of [18, 114, 1]) {
    await page.locator('[data-quran-surah]').selectOption(String(id));
    assert.equal(
      await iframe.getAttribute('src'),
      provider + '#aya=' + id + '_1',
    );
    await reading(id);
    assert.equal(
      await page.locator('[data-quran-direct]').getAttribute('href'),
      provider + '#aya=' + id + '_1',
    );
  }
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.ok(await page.locator('[data-quran-direct]').isVisible());
  const box = await iframe.boundingBox();
  assert.ok(box.width <= width);
  await iframe.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const shot = path.join(tmpdir(), `nur-${label}-quran-${width}.png`);
  const viewportShot = shot.replace('.png', '-viewport.png');
  await page.screenshot({ path: viewportShot });
  await chmod(viewportShot, 0o600);
  const frameShot = shot.replace('.png', '-frame.png');
  await iframe.screenshot({ path: frameShot });
  await chmod(frameShot, 0o600);
  await page.screenshot({ path: shot, fullPage: true });
  await chmod(shot, 0o600);
  // Test the persistent fallback as real top-level navigation, including its image.
  const popupPromise = page.waitForEvent('popup');
  await page.locator('[data-quran-direct]').click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  assert.equal(new URL(popup.url()).hostname, 'quran.ksu.edu.sa');
  if (!desktop) {
    await popup.waitForFunction(
      () =>
        document.querySelector('#flang_ar') || document.querySelector('#img15'),
      null,
      { timeout: 45000 },
    );
    if (await popup.locator('#flang_ar').isVisible())
      await popup.locator('#flang_ar').tap();
  }
  await popup.waitForFunction(
    () =>
      [...document.images].some(
        (img) =>
          /\/1\.png(?:$|\?)/.test(img.src) &&
          img.complete &&
          img.naturalWidth >= 450,
      ),
    null,
    { timeout: 45000 },
  );
  await popup.close();
  console.log(
    `PASS ${label} ${width}px: actual official Mushaf pages for Al-Fatiha, Al-Kahf and An-Nas; 114-surah navigation, direct fallback, no clipping.`,
  );
}
