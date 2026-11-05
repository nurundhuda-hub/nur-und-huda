import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { initMobileNavigation } from '../src/scripts/mobile-navigation';
let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
const load = (route = 'index') => {
  const doc = new DOMParser().parseFromString(
    readFileSync(`dist/${route}.html`, 'utf8'),
    'text/html',
  );
  document.body.innerHTML = doc.body.innerHTML;
};
it('keeps four mobile destinations, active state, safe-area viewport and homepage service routes', () => {
  for (const route of [
    'index',
    'sermons',
    'library',
    'quran',
    'together',
    'legal',
  ]) {
    load(route);
    expect(document.querySelectorAll('.mobile-nav > a')).toHaveLength(4);
    expect(
      document.querySelectorAll('.mobile-nav [aria-current="page"]'),
    ).toHaveLength(1);
    expect(
      document.querySelector('[data-more-open]')?.getAttribute('href'),
    ).toBe('/nur-und-huda/index.html#explore');
  }
  load();
  expect(
    [...document.querySelectorAll('.service-card')].map((n) =>
      n.getAttribute('href'),
    ),
  ).toEqual([
    '/nur-und-huda/together.html',
    '/nur-und-huda/sermons.html',
    '/nur-und-huda/quran.html',
    '/nur-und-huda/library.html',
  ]);
  expect(document.querySelector('.about-card')?.getAttribute('href')).toBe(
    '/nur-und-huda/legal.html#impressum',
  );
  expect(document.querySelector('[data-source-search]')).toBeNull(); // Catalog remains on the dedicated library page.
  expect(readFileSync('dist/index.html', 'utf8')).toContain(
    'viewport-fit=cover',
  );
});
it('opens the native dialog, restores focus on dismissal and initializes only once', () => {
  load();
  const dialog = document.querySelector<HTMLDialogElement>('#mobile-more')!;
  const opener = document.querySelector<HTMLAnchorElement>('[data-more-open]')!;
  dialog.showModal = vi.fn(() => {
    dialog.open = true;
  });
  dialog.close = vi.fn(() => {
    dialog.open = false;
    dialog.dispatchEvent(new Event('close'));
  });
  cleanup = initMobileNavigation(document);
  expect(initMobileNavigation(document)).toBe(cleanup);
  opener.click();
  expect(dialog.showModal).toHaveBeenCalledTimes(1);
  expect(opener.getAttribute('aria-expanded')).toBe('true');
  expect(document.activeElement).toBe(
    dialog.querySelector('[data-more-close]'),
  );
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }),
  );
  expect(document.activeElement).toBe([...dialog.querySelectorAll('a')].at(-1));
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    }),
  );
  expect(document.activeElement).toBe(
    dialog.querySelector('[data-more-close]'),
  );
  dialog.querySelector<HTMLButtonElement>('[data-more-close]')!.click();
  expect(opener.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(opener);
  cleanup();
  cleanup = undefined;
  opener.dispatchEvent(new MouseEvent('click', { cancelable: true }));
  expect(dialog.showModal).toHaveBeenCalledTimes(1);
});
