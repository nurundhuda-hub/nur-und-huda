import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mountAutoScroll,
  SCROLL_SPEEDS,
  SCROLL_SPEED_KEY,
  readScrollSpeed,
} from '../src/scripts/reader-auto-scroll';
import { readerFrame } from '../src/lib/sermons/reader-markup';
let dialog: HTMLDialogElement, viewport: HTMLElement, cleanup: () => void;
let frames: Map<number, FrameRequestCallback>,
  nextId: number,
  time: number,
  end: number;
const button = (s: string) => dialog.querySelector<HTMLButtonElement>(s)!;
function step(ms: number) {
  time += ms;
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((fn) => fn(time));
}
function advance(ms: number, frameTime = 20) {
  for (let elapsed = 0; elapsed < ms; elapsed += frameTime)
    step(Math.min(frameTime, ms - elapsed));
}
function setLevel(n: number) {
  const range = dialog.querySelector<HTMLInputElement>('[data-auto-speed]')!;
  range.value = String(n);
  range.dispatchEvent(new Event('input'));
}
beforeEach(() => {
  localStorage.clear();
  frames = new Map();
  nextId = 0;
  time = 0;
  end = 1000;
  document.body.innerHTML = readerFrame(
    'اختبار تقني',
    '<section class="khutbah-part"><h2>الأولى</h2><p>نَصٌّ أول</p></section><section class="khutbah-part"><h2>الثانية</h2><p>نَصٌّ ثانٍ</p></section>',
  );
  dialog = document.querySelector('dialog')!;
  viewport = document.querySelector('[data-reader-viewport]')!;
  dialog.open = true;
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    frames.set(++nextId, fn);
    return nextId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  Object.defineProperty(viewport, 'clientHeight', {
    configurable: true,
    value: 300,
  });
  Object.defineProperty(viewport, 'scrollHeight', {
    configurable: true,
    get: () => end + 300,
  });
  viewport.getBoundingClientRect = () =>
    ({ top: 0, bottom: 300, height: 300 }) as DOMRect;
  dialog.querySelectorAll<HTMLElement>('.khutbah-part').forEach((p) => {
    p.getBoundingClientRect = () =>
      ({ bottom: end + 300 - viewport.scrollTop }) as DOMRect;
  });
  cleanup = () => {};
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});
function mount() {
  const api = mountAutoScroll(dialog, viewport);
  cleanup = api.dispose;
  return api;
}
describe('elapsed-time imam auto-scroll', () => {
  it('does not start on open, moves at exact px/sec, pauses and resumes from current position', () => {
    const api = mount();
    api.opened();
    advance(1000);
    expect(viewport.scrollTop).toBe(0);
    button('[data-auto-toggle]').click();
    step(0);
    advance(1000);
    expect(viewport.scrollTop).toBeCloseTo(10);
    button('[data-auto-toggle]').click();
    advance(3000);
    expect(viewport.scrollTop).toBeCloseTo(10);
    viewport.scrollTop = 200;
    button('[data-auto-toggle]').click();
    step(0);
    advance(1000);
    expect(viewport.scrollTop).toBeCloseTo(210);
  });
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
    'level %i is frame-rate independent and persists without text or identifiers',
    (level) => {
      const api = mount();
      setLevel(level);
      button('[data-auto-toggle]').click();
      step(0);
      advance(1000, 10);
      expect(viewport.scrollTop).toBeCloseTo(SCROLL_SPEEDS[level - 1]!);
      api.pause();
      viewport.scrollTop = 0;
      button('[data-auto-toggle]').click();
      step(0);
      advance(1000, 100);
      expect(viewport.scrollTop).toBeCloseTo(SCROLL_SPEEDS[level - 1]!);
      expect(localStorage.getItem(SCROLL_SPEED_KEY)).toBe(String(level));
      expect(
        dialog.querySelector('[data-auto-speed-label]')!.textContent,
      ).toContain(`${level} / 10`);
    },
  );
  it('accumulates low-speed fractions even when a browser rounds scrollTop', () => {
    let rounded = 0;
    Object.defineProperty(viewport, 'scrollTop', {
      configurable: true,
      get: () => rounded,
      set: (value) => {
        rounded = Math.round(value);
      },
    });
    mount();
    setLevel(1);
    button('[data-auto-toggle]').click();
    step(0);
    advance(1000, 10);
    expect(viewport.scrollTop).toBe(6);
  });
  it('changes speed immediately while running and accumulates fractional pixels', () => {
    mount();
    setLevel(1);
    button('[data-auto-toggle]').click();
    step(0);
    advance(500);
    expect(viewport.scrollTop).toBeCloseTo(3);
    setLevel(10);
    advance(500);
    expect(viewport.scrollTop).toBeCloseTo(48);
  });
  it.each(['wheel', 'touchstart', 'pointerdown', 'keydown', 'scroll'])(
    'pauses on manual %s and does not automatically restart',
    (name) => {
      mount();
      button('[data-auto-toggle]').click();
      step(0);
      advance(200);
      if (name === 'scroll') viewport.scrollTop += 100;
      viewport.dispatchEvent(
        name === 'keydown'
          ? new KeyboardEvent(name, { key: 'PageDown' })
          : new Event(name),
      );
      const position = viewport.scrollTop;
      advance(1000);
      expect(viewport.scrollTop).toBe(position);
      expect(frames.size).toBe(0);
      expect(button('[data-auto-toggle]').getAttribute('aria-pressed')).toBe(
        'false',
      );
    },
  );
  it('ignores its own scroll events, clamps at each part and requires two deliberate actions for part two', () => {
    mount();
    end = 4;
    setLevel(10);
    button('[data-auto-toggle]').click();
    step(0);
    advance(40);
    viewport.dispatchEvent(new Event('scroll'));
    expect(frames.size).toBe(1);
    expect(button('[data-auto-part]').disabled).toBe(true);
    advance(1000);
    expect(viewport.scrollTop).toBe(4);
    expect(frames.size).toBe(0);
    expect(dialog.dataset.autoPart).toBe('0');
    expect(dialog.querySelector('[data-auto-status]')!.textContent).toContain(
      'انتهت الخطبة الأولى',
    );
    button('[data-auto-part]').click();
    expect(dialog.dataset.autoPart).toBe('1');
    expect(viewport.scrollTop).toBe(0);
    advance(1000);
    expect(viewport.scrollTop).toBe(0);
    button('[data-auto-toggle]').click();
    step(0);
    advance(1000);
    expect(viewport.scrollTop).toBe(4);
    expect(frames.size).toBe(0);
    expect(dialog.querySelector('[data-auto-status]')!.textContent).toContain(
      'انتهت الخطبة الثانية',
    );
  });
  it('resets only the selected part, preserves position on reopen and never changes content', () => {
    const text = viewport.textContent;
    const api = mount();
    button('[data-auto-part]').click();
    viewport.scrollTop = 300;
    dialog.open = false;
    dialog.dispatchEvent(new Event('close'));
    dialog.open = true;
    api.opened();
    expect(dialog.dataset.autoPart).toBe('1');
    expect(viewport.scrollTop).toBe(300);
    expect(frames.size).toBe(0);
    button('[data-auto-reset]').click();
    expect(dialog.dataset.autoPart).toBe('1');
    expect(viewport.scrollTop).toBe(0);
    expect(viewport.textContent).toBe(text);
  });
  it('does not catch up after a long stall and cleans up all queued work', () => {
    const api = mount();
    button('[data-auto-toggle]').click();
    step(0);
    advance(100);
    const top = viewport.scrollTop;
    step(4000);
    expect(viewport.scrollTop).toBe(top);
    expect(frames.size).toBe(0);
    button('[data-auto-toggle]').click();
    api.dispose();
    advance(1000);
    expect(viewport.scrollTop).toBe(top);
    expect(dialog.dataset.autoPart).toBeUndefined();
  });
  it.each(['pagehide', 'resize', 'beforeprint', 'visibilitychange'])(
    'pauses for %s',
    (event) => {
      mount();
      button('[data-auto-toggle]').click();
      step(0);
      advance(100);
      if (event === 'visibilitychange') {
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        document.dispatchEvent(new Event(event));
      } else window.dispatchEvent(new Event(event));
      const top = viewport.scrollTop;
      advance(1000);
      expect(viewport.scrollTop).toBe(top);
      expect(frames.size).toBe(0);
    },
  );
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
    'restores saved level %i without changing the existing preference key',
    (level) => {
      localStorage.setItem(SCROLL_SPEED_KEY, String(level));
      mount();
      expect(
        dialog.querySelector<HTMLInputElement>('[data-auto-speed]')!.value,
      ).toBe(String(level));
      expect(frames.size).toBe(0);
      button('[data-auto-toggle]').click();
      step(0);
      advance(1000);
      expect(viewport.scrollTop).toBeCloseTo(SCROLL_SPEEDS[level - 1]!);
    },
  );
  it('handles short content and invalid or blocked storage safely', () => {
    expect(readScrollSpeed({ getItem: () => '11' })).toBe(2);
    expect(readScrollSpeed({ getItem: () => '99' })).toBe(2);
    expect(
      readScrollSpeed({
        getItem: () => {
          throw Error();
        },
      }),
    ).toBe(2);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw Error();
    });
    mount();
    end = 0;
    setLevel(5);
    button('[data-auto-toggle]').click();
    expect(frames.size).toBe(0);
    expect(viewport.scrollTop).toBe(0);
  });
  it('leaves both parts readable and controls hidden if animation frames are unavailable', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    mount();
    expect(dialog.dataset.autoPart).toBeUndefined();
    expect(
      dialog.querySelector<HTMLElement>('[data-auto-controls]')!.hidden,
    ).toBe(true);
    expect(viewport.querySelectorAll('.khutbah-part')).toHaveLength(2);
  });
});
