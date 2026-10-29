import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initImamPreviews } from '../src/scripts/imam';
import { initSourceDirectories, normalizeSearch } from '../src/scripts/search';

const pages = ['index', 'together', 'sermons', 'quran', 'library', 'legal'];
function load(page: string) {
  const html = readFileSync(`dist/${page}.html`, 'utf8');
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
}
afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('route initialization', () => {
  it.each(pages)(
    '%s initializes independently without missing-element exceptions',
    (page) => {
      load(page);
      expect(() => {
        initSourceDirectories(document);
        initImamPreviews(document);
      }).not.toThrow();
    },
  );
});

describe('native prayer disclosure', () => {
  it('expands and collapses all five unavailable prayers without script', () => {
    load('index');
    const details =
      document.querySelector<HTMLDetailsElement>('.prayer-details')!;
    const summary = details.querySelector('summary')!;
    expect(details.open).toBe(false);
    summary.click();
    expect(details.open).toBe(true);
    expect(details.querySelectorAll('li')).toHaveLength(5);
    expect(
      [...details.querySelectorAll('li')].every((item) =>
        item.textContent?.includes('غير معتمد بعد'),
      ),
    ).toBe(true);
    summary.click();
    expect(details.open).toBe(false);
    expect(document.querySelector('[data-countdown]')).toBeNull();
  });
});

describe.each(['index', 'library'])('%s source directory', (page) => {
  it('keeps source links available without JavaScript', () => {
    load(page);
    expect(document.querySelectorAll('[data-source-item] a')).toHaveLength(2);
    expect(
      document.querySelector<HTMLElement>('[data-search-controls]')!.hidden,
    ).toBe(true);
    expect(
      [...document.querySelectorAll<HTMLElement>('[data-source-item]')].every(
        (item) => !item.hidden,
      ),
    ).toBe(true);
  });
  it('filters Arabic/German, announces counts, handles no matches and clears', () => {
    load(page);
    initSourceDirectories(document);
    initSourceDirectories(document); // repeated initialization is safe
    const input = document.querySelector<HTMLInputElement>(
      '[data-source-search]',
    )!;
    const visible = () =>
      [...document.querySelectorAll<HTMLElement>('[data-source-item]')].filter(
        (item) => !item.hidden,
      );
    const search = (query: string) => {
      input.value = query;
      input.dispatchEvent(new Event('input'));
    };
    search('DEUTSCH');
    expect(visible()).toHaveLength(1);
    expect(visible()[0]!.textContent).toContain('Deutsch');
    search('العَرَبِيَّة');
    expect(visible()).toHaveLength(1);
    expect(visible()[0]!.textContent).toContain('العربية');
    search('رسالة الماني');
    expect(visible()).toHaveLength(1);
    search('<img src=x onerror=alert(1)>');
    expect(visible()).toHaveLength(0);
    expect(
      document.querySelector<HTMLElement>('[data-search-empty]')!.hidden,
    ).toBe(false);
    expect(
      document.querySelector('[data-search-status]')!.textContent,
    ).toContain('٠');
    expect(document.querySelector('.source-directory img')).toBeNull();
    search('  ');
    expect(visible()).toHaveLength(2);
    expect(
      document.querySelector<HTMLElement>('[data-search-empty]')!.hidden,
    ).toBe(true);
  });
});

describe('imam preview', () => {
  it.each(['index', 'sermons'])(
    '%s opens, closes and restores trigger focus',
    (page) => {
      load(page);
      const dialog = document.querySelector<HTMLDialogElement>('dialog')!;
      // jsdom has no browser modal/top-layer implementation. These shims test our
      // event wiring and focus restoration only; native focus trapping/Escape
      // still require a real-browser check.
      dialog.showModal = vi.fn(() => {
        dialog.open = true;
      });
      dialog.close = vi.fn(() => {
        dialog.open = false;
        dialog.dispatchEvent(new Event('close'));
      });
      initImamPreviews(document);
      initImamPreviews(document);
      const trigger =
        document.querySelector<HTMLButtonElement>('[data-imam-open]')!;
      const close =
        dialog.querySelector<HTMLButtonElement>('[data-imam-close]')!;
      expect(trigger.hidden).toBe(false);
      trigger.focus();
      trigger.click();
      expect(dialog.showModal).toHaveBeenCalledTimes(1);
      expect(dialog.open).toBe(true);
      expect(document.activeElement).toBe(close);
      close.click();
      expect(dialog.open).toBe(false);
      expect(document.activeElement).toBe(trigger);
    },
  );
  it('does not advertise a broken control when dialog is unsupported', () => {
    load('sermons');
    const dialog = document.querySelector('dialog')!;
    Object.defineProperty(dialog, 'showModal', {
      value: undefined,
      configurable: true,
    });
    initImamPreviews(document);
    expect(
      document.querySelector<HTMLButtonElement>('[data-imam-open]')!.hidden,
    ).toBe(true);
  });
});

it('normalizes search terms without changing displayed source content', () => {
  expect(normalizeSearch('  العَرَبِيَّة  ')).toBe('العربية');
  expect(normalizeSearch('ألماني')).toBe('الماني');
});
