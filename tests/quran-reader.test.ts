import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { quranReader, quranReaderUrl } from '../src/lib/quran-reader';
import { initQuranReader } from '../src/scripts/quran-reader';
let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
const page = () =>
  new DOMParser().parseFromString(
    readFileSync('dist/quran.html', 'utf8'),
    'text/html',
  );
it('opens the official reader with an always-available safe direct link, without local Quran transcription', () => {
  const doc = page();
  const frame = doc.querySelector('iframe')!;
  expect(doc.querySelectorAll('iframe')).toHaveLength(1);
  expect(frame.getAttribute('src')).toBe(quranReaderUrl(false));
  expect(frame.title).toContain('جامعة الملك سعود');
  expect(frame.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
  expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
  expect(frame.getAttribute('loading')).toBe('eager');
  const direct = doc.querySelector('[data-quran-direct]')!;
  expect(direct.getAttribute('href')).toBe(quranReaderUrl(false));
  expect(direct.getAttribute('target')).toBe('_blank');
  expect(direct.getAttribute('rel')).toBe('noopener noreferrer');
  expect(direct.closest('[hidden],details,iframe')).toBeNull();
  expect(
    doc.querySelector('a[href="' + quranReader.publisher + '"]'),
  ).not.toBeNull();
  expect(
    doc.querySelector('a[href="' + quranReader.imageSource + '"]'),
  ).not.toBeNull();
  expect(doc.body.textContent).not.toContain('إلى حين استكمال');
  expect(doc.querySelector('[data-quran-text]')).toBeNull();
});
it('only chooses the verified mobile or desktop reader and cleans up resize listeners', () => {
  document.body.innerHTML = page().body.innerHTML;
  const root = document.querySelector<HTMLElement>('[data-quran-reader]')!;
  let listener: () => void = () => {};
  const media = {
    matches: false,
    addEventListener: vi.fn((_type, fn) => {
      listener = fn;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  );
  cleanup = initQuranReader(root);
  expect(root.querySelector('iframe')!.src).toBe(quranReaderUrl(false));
  media.matches = true;
  listener();
  expect(root.querySelector('iframe')!.src).toBe(quranReaderUrl(true));
  expect(
    root.querySelector<HTMLAnchorElement>('[data-quran-direct]')!.href,
  ).toBe(quranReaderUrl(true));
  const select = root.querySelector<HTMLSelectElement>('[data-quran-surah]')!;
  const oldFrame = root.querySelector('iframe');
  select.value = '18';
  select.dispatchEvent(new Event('change'));
  expect(root.querySelector('iframe')).not.toBe(oldFrame);
  expect(root.querySelector('iframe')!.src).toBe(quranReaderUrl(true, 18));
  select.value = '1';
  select.dispatchEvent(new Event('change'));
  media.matches = false;
  listener();
  expect(root.querySelector('iframe')!.src).toBe(quranReaderUrl(false));
  cleanup();
  expect(media.removeEventListener).toHaveBeenCalledWith('change', listener);
  vi.unstubAllGlobals();
});
it('removes both dead destinations and identifies the provider and external processing honestly', () => {
  const html =
    readFileSync('dist/quran.html', 'utf8') +
    readFileSync('dist/legal.html', 'utf8');
  expect(html).not.toContain('https://qurancomplex.gov.sa/apps/');
  expect(html).not.toContain('https://dm.qurancomplex.gov.sa/rights/');
  expect(html).toContain('جامعة الملك سعود');
  expect(html).toContain('مجمع الملك فهد');
  expect(html).toContain('Nutzungsanalyse');
});

it('validates surah navigation without importing or generating verse text', () => {
  const doc = page();
  const options = doc.querySelectorAll('[data-quran-surah] option');
  expect(options).toHaveLength(114);
  expect([...options].map((o) => Number(o.getAttribute('value')))).toEqual(
    Array.from({ length: 114 }, (_, i) => i + 1),
  );
  for (const n of [0, 115, NaN, 1.5])
    expect(() => quranReaderUrl(false, n)).toThrow();
  expect(quranReaderUrl(false, 18)).toBe(
    'https://quran.ksu.edu.sa/m.php#aya=18_1',
  );
});
