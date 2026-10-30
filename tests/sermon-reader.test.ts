import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axe from 'axe-core';
import { mountSermonReader } from '../src/scripts/sermon-reader';
import { readerMarkup } from '../src/lib/sermons/reader-markup';
import { selectPublicCatalog } from '../src/lib/sermons/publication';
import { sermonArticle } from '../src/lib/sermons/render';
import { sermonFixture } from './fixtures/sermon-content';

let root: HTMLElement,
  dialog: HTMLDialogElement,
  cleanup: (() => void) | undefined;
const release = () =>
  selectPublicCatalog(sermonFixture(), '2030-01-01T00:00:00Z', {
    allowTestFixtures: true,
  });
const button = (selector: string) =>
  root.querySelector<HTMLButtonElement>(selector)!;
const settle = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};
class Lock extends EventTarget {
  release = vi.fn(async () => {
    this.dispatchEvent(new Event('release'));
  });
}
beforeEach(() => {
  const publication = release();
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
  document.head.innerHTML = '<title>Test</title>';
  document.body.innerHTML = `<main>${readerMarkup(publication.published[0]!)}${sermonArticle(publication, 'synthetic-only', 'r1', '/nur-und-huda/')}</main>`;
  root = document.querySelector('[data-sermon-reader]')!;
  dialog = root.querySelector('dialog')!;
  dialog.showModal = vi.fn(() => {
    dialog.open = true;
  });
  dialog.close = vi.fn(() => {
    dialog.open = false;
    dialog.dispatchEvent(new Event('close'));
  });
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
describe('imam reading tools', () => {
  it('opens, closes and restores focus without duplicating initialization', () => {
    cleanup = mountSermonReader(root);
    expect(mountSermonReader(root)).toBe(cleanup);
    const open = button('[data-reader-open]');
    expect(open.hidden).toBe(false);
    open.click();
    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(button('[data-reader-close]'));
    button('[data-reader-close]').click();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(open);
  });
  it('bounds font adjustments and supports keyboard-native range input', () => {
    cleanup = mountSermonReader(root);
    button('[data-reader-open]').click();
    const range = root.querySelector<HTMLInputElement>('[data-reader-size]')!;
    const plus = button('[data-font-step="0.25"]'),
      minus = button('[data-font-step="-0.25"]');
    plus.click();
    expect(dialog.style.getPropertyValue('--reader-font')).toBe('2.25rem');
    for (let i = 0; i < 10; i++) plus.click();
    expect(plus.disabled).toBe(true);
    expect(range.value).toBe('3');
    for (let i = 0; i < 10; i++) minus.click();
    expect(minus.disabled).toBe(true);
    expect(range.value).toBe('1.5');
    range.value = '2.5';
    range.dispatchEvent(new Event('input'));
    expect(dialog.style.getPropertyValue('--reader-font')).toBe('2.5rem');
    expect(root.querySelector('[data-reader-size-label]')?.textContent).toBe(
      '125٪',
    );
  });
  it('keeps the readable page and print action available without modal or wake-lock support', () => {
    Object.defineProperty(dialog, 'showModal', {
      value: undefined,
      configurable: true,
    });
    const print = vi.fn();
    cleanup = mountSermonReader(root, { print });
    expect(button('[data-reader-open]').hidden).toBe(true);
    expect(button('[data-reader-wake]').disabled).toBe(true);
    button('[data-sermon-print]').click();
    expect(print).toHaveBeenCalledOnce();
    expect(document.querySelectorAll('main > .khutbah-part')).toHaveLength(2);
  });
  it('requests wake lock only after user action, releases when hidden and reacquires while reading', async () => {
    const locks: Lock[] = [];
    const request = vi.fn(async () => {
      const lock = new Lock();
      locks.push(lock);
      return lock;
    });
    cleanup = mountSermonReader(root, { requestWakeLock: request });
    button('[data-reader-open]').click();
    expect(request).not.toHaveBeenCalled();
    button('[data-reader-wake]').click();
    await settle();
    expect(request).toHaveBeenCalledTimes(1);
    expect(button('[data-reader-wake]').getAttribute('aria-pressed')).toBe(
      'true',
    );
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(locks[0]!.release).toHaveBeenCalledOnce();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
    dialog.close();
    await settle();
    expect(locks[1]!.release).toHaveBeenCalledOnce();
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('handles denial and operating-system release without breaking reading', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('NotAllowedError'))
      .mockResolvedValueOnce(new Lock());
    cleanup = mountSermonReader(root, { requestWakeLock: request });
    button('[data-reader-open]').click();
    button('[data-reader-wake]').click();
    await settle();
    expect(root.querySelector('[data-wake-status]')?.textContent).toContain(
      'تعذّر',
    );
    expect(dialog.open).toBe(true);
    button('[data-reader-wake]').click();
    await settle();
    const lock = await request.mock.results[1]!.value;
    await lock.release();
    expect(button('[data-reader-wake]').getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(root.querySelector('[data-wake-status]')?.textContent).toContain(
      'انتهى',
    );
  });
  it('releases a late grant after close and cleans up page lifecycle listeners', async () => {
    let resolve!: (lock: Lock) => void;
    const request = vi.fn(
      () =>
        new Promise<Lock>((done) => {
          resolve = done;
        }),
    );
    cleanup = mountSermonReader(root, { requestWakeLock: request });
    button('[data-reader-open]').click();
    button('[data-reader-wake]').click();
    dialog.close();
    const late = new Lock();
    resolve(late);
    await settle();
    expect(late.release).toHaveBeenCalledOnce();
    cleanup();
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pageshow'));
    await settle();
    expect(request).toHaveBeenCalledOnce();
  });
  it('releases on pagehide and restores an opted-in reading session on pageshow', async () => {
    const locks: Lock[] = [];
    const request = vi.fn(async () => {
      const lock = new Lock();
      locks.push(lock);
      return lock;
    });
    cleanup = mountSermonReader(root, { requestWakeLock: request });
    button('[data-reader-open]').click();
    button('[data-reader-wake]').click();
    await settle();
    window.dispatchEvent(new Event('pagehide'));
    await settle();
    expect(locks[0]!.release).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event('pageshow'));
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
    cleanup();
    await settle();
    expect(locks[1]!.release).toHaveBeenCalledOnce();
  });
  it('has no detected structural accessibility violations when reading is open', async () => {
    cleanup = mountSermonReader(root);
    button('[data-reader-open]').click();
    const result = await axe.run(document.documentElement, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'],
      },
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(
      result.violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => node.target),
      })),
    ).toEqual([]);
  });
});
