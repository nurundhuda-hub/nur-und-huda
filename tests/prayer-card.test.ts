import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initPrayerCards, mountPrayerCard } from '../src/scripts/prayer-card';
import { fixture, metadata } from './fixtures/prayer-data';

let cleanup: (() => void) | undefined;
let card: HTMLElement;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2030-01-01T03:00:00Z'));
  const parsed = new DOMParser().parseFromString(
    readFileSync('dist/index.html', 'utf8'),
    'text/html',
  );
  document.body.innerHTML = parsed.body.innerHTML;
  card = document.querySelector('[data-prayer-card]')!;
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const clock = () => card.querySelector('[data-countdown]');
function mount(data = fixture()) {
  cleanup = mountPrayerCard(card, data, { allowTestFixtures: true });
}

describe('enhanced prayer card', () => {
  it('keeps unavailable state free of times and timers; native disclosure still works', () => {
    cleanup = initPrayerCards(document);
    expect(clock()).toBeNull();
    expect(card.querySelector('time')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    const details = card.querySelector('details')!;
    details.querySelector('summary')!.click();
    details.dispatchEvent(new Event('toggle'));
    expect(details.open).toBe(true);
    expect(details.querySelector('summary')!.textContent).toContain('إخفاء');
    details.querySelector('summary')!.click();
    details.dispatchEvent(new Event('toggle'));
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')!.textContent).toContain('عرض');
  });
  it('rejects synthetic serialized payloads in production initialization', () => {
    card.dataset.prayerPayload = JSON.stringify(fixture());
    cleanup = initPrayerCards(document);
    expect(clock()).toBeNull();
    expect(card.querySelector('time')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('updates actual remaining time and avoids screen-reader announcements each second', () => {
    mount();
    expect(clock()!.textContent).toBe('01:00:00');
    expect(clock()!.getAttribute('role')).toBe('timer');
    expect(clock()!.getAttribute('aria-live')).toBe('off');
    expect(card.querySelectorAll('#all-prayers time')).toHaveLength(5);
    expect(card.querySelector('[data-friday-sermon] time')).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(clock()!.textContent).toBe('00:59:59');
    vi.setSystemTime(new Date('2030-01-01T04:00:00Z'));
    vi.advanceTimersByTime(1000);
    expect(card.querySelector('[data-prayer-next]')!.textContent).toBe('الظهر');
    expect(clock()!.textContent).toBe('06:59:59');
  });
  it('clears times and stops ticking on expiry instead of freezing a countdown', () => {
    const data = fixture();
    data.daily!.freshness.expiresAt = '2030-01-01T03:00:02Z';
    mount(data);
    vi.advanceTimersByTime(2000);
    expect(clock()).toBeNull();
    expect(card.querySelector('time')).toBeNull();
    expect(card.textContent).toContain('بحاجة إلى تحديث');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('recomputes the countdown after a backward device-clock correction', () => {
    mount();
    vi.setSystemTime(new Date('2030-01-01T02:30:00Z'));
    vi.advanceTimersByTime(1000);
    expect(clock()!.textContent).toBe('01:29:59');
    expect(card.querySelector('[data-prayer-next]')!.textContent).toBe('الفجر');
  });
  it('recovers from a clock jump past expiry when the page becomes visible again', () => {
    mount();
    vi.setSystemTime(new Date('2031-01-01T00:00:00Z'));
    vi.advanceTimersByTime(1000);
    expect(clock()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    vi.setSystemTime(new Date('2030-01-01T03:00:00Z'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(clock()!.textContent).toBe('01:00:00');
    expect(vi.getTimerCount()).toBe(1);
  });
  it('shows unapproved calculation provenance without exposing draft times', () => {
    const data = fixture();
    data.daily!.approval = { status: 'pending' };
    data.daily!.method = 'SYNTHETIC method <img src=x>';
    mount(data);
    const source = card.querySelector<HTMLElement>('[data-prayer-source]')!;
    expect(source.hidden).toBe(false);
    expect(source.textContent).toContain('SYNTHETIC method <img src=x>');
    expect(source.textContent).toContain('غير معتمد');
    expect(card.querySelector('img')).toBeNull();
    expect(card.querySelector('time')).toBeNull();
    expect(clock()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('shows the method alongside approved source metadata', () => {
    const data = fixture();
    data.daily!.method = 'SYNTHETIC test method';
    mount(data);
    expect(card.querySelector('[data-prayer-source]')!.textContent).toContain(
      'الطريقة: SYNTHETIC test method',
    );
    expect(card.querySelector('[data-prayer-status]')!.textContent).toBe(
      'مواقيت معتمدة',
    );
  });
  it('recalculates after hidden-tab sleep and Berlin midnight', () => {
    mount();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(0);
    vi.setSystemTime(new Date('2030-01-01T23:00:00Z'));
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(clock()!.textContent).toBe('05:00:00');
    expect(card.querySelector('time')!.dateTime).toContain('2030-01-02');
    expect(vi.getTimerCount()).toBe(1);
  });
  it('pauses on pagehide and resumes after back-forward restoration with fresh time', () => {
    mount();
    window.dispatchEvent(new Event('pagehide'));
    expect(vi.getTimerCount()).toBe(0);
    vi.setSystemTime(new Date('2030-01-01T03:30:00Z'));
    window.dispatchEvent(new Event('pageshow'));
    expect(clock()!.textContent).toBe('00:30:00');
    expect(vi.getTimerCount()).toBe(1);
  });
  it('mounts once, destroys timers/listeners and can be mounted again', () => {
    const data = fixture();
    mount(data);
    expect(mountPrayerCard(card, data, { allowTestFixtures: true })).toBe(
      cleanup,
    );
    expect(vi.getTimerCount()).toBe(1);
    cleanup!();
    window.dispatchEvent(new Event('pageshow'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(0);
    expect(clock()).toBeNull();
    mount(data);
    expect(vi.getTimerCount()).toBe(1);
  });
  it('cleans up after its card is removed', () => {
    mount();
    card.remove();
    vi.advanceTimersByTime(1000);
    expect(vi.getTimerCount()).toBe(0);
    window.dispatchEvent(new Event('pageshow'));
    expect(vi.getTimerCount()).toBe(0);
  });
  it('renders source names as inert text and Friday fields independently', () => {
    const data = fixture();
    data.daily!.source.label = '<img src=x onerror=alert(1)>';
    data.friday = {
      ...metadata(),
      date: '2030-01-04',
      sermonAt: '2030-01-04T10:00:00Z',
      iqamaAt: null,
    };
    mount(data);
    expect(card.querySelector('[data-prayer-source]')!.textContent).toContain(
      '<img',
    );
    expect(card.querySelector('img')).toBeNull();
    expect(card.querySelector('[data-friday-sermon] time')!.textContent).toBe(
      '11:00',
    );
    expect(card.querySelector('[data-friday-iqama] time')).toBeNull();
  });
});
