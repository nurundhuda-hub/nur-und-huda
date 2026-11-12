import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { mawaqit } from '../src/data/mawaqit';
import { prayerData } from '../src/data/prayer-data';
import { initPrayerCards } from '../src/scripts/prayer-card';
import { initMawaqitViewport } from '../src/scripts/mawaqit-viewport';
const homepage = () =>
  new DOMParser().parseFromString(
    readFileSync('dist/index.html', 'utf8'),
    'text/html',
  );

describe('official Nur und Huda widget on the built homepage', () => {
  it('shows the reviewed transparent logo and no separate visible tagline', () => {
    const doc = homepage();
    expect(doc.querySelectorAll('.hero-logo')).toHaveLength(1);
    const logo = doc.querySelector<HTMLImageElement>('.hero-logo')!;
    expect(logo.getAttribute('src')).toBe(
      '/nur-und-huda/assets/logo-transparent.png',
    );
    expect([logo.width, logo.height]).toEqual([1672, 941]);
    expect(logo.alt).toContain('منبر للذكر .. ومرجع للعلم النافع');
    expect(doc.body.textContent).not.toMatch(/منبر\s+للذكر/);
    expect(doc.querySelector('.mission')).toBeNull();
  });
  it('embeds only the verified official widget with a named, restricted frame', () => {
    const doc = homepage();
    const frames = doc.querySelectorAll('iframe');
    expect(frames).toHaveLength(1);
    const frame = frames[0]!;
    expect(frame.getAttribute('src')).toBe(
      'https://mawaqit.net/ar/w/nur-und-huda-gebetsraum-im-krankenhaus-hamm-59073-deutschland?showOnly5PrayerTimes=0',
    );
    expect(frame.title).toContain('نور وهدى');
    expect(frame.getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin',
    );
    expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(frame.getAttribute('loading')).toBe('lazy');
    expect(frame.getAttribute('allow')).toContain("geolocation 'none'");
    expect(frame.closest('[data-mawaqit-card]')).not.toBeNull();
    const scroller = frame.parentElement!;
    expect(scroller.tabIndex).toBe(0);
    expect(scroller.getAttribute('role')).toBe('region');
    expect(scroller.getAttribute('aria-label')).toBeTruthy();
  });
  it('keeps a safe official link and attribution visible even without JS or a working iframe', () => {
    const card = homepage().querySelector('[data-mawaqit-card]')!;
    const link = card.querySelector<HTMLAnchorElement>(
      '.prayer-source-link a',
    )!;
    expect(link.getAttribute('href')).toBe(mawaqit.sourceUrl);
    expect(link.textContent).toContain('فتح المواقيت على MAWAQIT');
    expect(link.target).toBe('_blank');
    expect(link.relList.contains('noopener')).toBe(true);
    expect(link.relList.contains('noreferrer')).toBe(true);
    expect(link.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(link.closest('iframe, [hidden], details')).toBeNull();
    expect(
      card.querySelector('[data-mosque-attribution]')?.textContent,
    ).toContain('المصدر: مصلّى نور وهدى');
    expect(
      card
        .querySelector('[data-mosque-attribution]')
        ?.getAttribute('data-mosque-id'),
    ).toBe('56820');
    expect(card.textContent).toContain('إذا لم تظهر اللوحة');
    expect(card.textContent).not.toContain('مسجد السلام');
  });
  it('offers a full responsive view plus accessible pan controls without changing the iframe', () => {
    const host = document.createElement('div');
    host.innerHTML = homepage().querySelector('[data-mawaqit-card]')!.outerHTML;
    document.body.append(host);
    const card = host.querySelector<HTMLElement>('[data-mawaqit-card]')!;
    const panel = host.querySelector<HTMLElement>('.mawaqit-scroll')!;
    const frame = host.querySelector('iframe')!;
    const original = frame.outerHTML;
    const zoom = host.querySelector<HTMLButtonElement>('[data-mawaqit-zoom]')!;
    const left = host.querySelector<HTMLButtonElement>('[data-mawaqit-left]')!;
    const right = host.querySelector<HTMLButtonElement>(
      '[data-mawaqit-right]',
    )!;
    let offset = 0;
    Object.defineProperties(panel, {
      clientWidth: { get: () => 260 },
      scrollWidth: {
        get: () => (card.dataset.widgetZoomed === 'true' ? 640 : 260),
      },
      scrollLeft: {
        get: () => offset,
        set: (value) => {
          offset = Math.max(
            0,
            Math.min(value, panel.scrollWidth - panel.clientWidth),
          );
        },
      },
    });
    const cleanup = initMawaqitViewport(host);
    try {
      expect(
        host.querySelector<HTMLElement>('[data-mawaqit-controls]')!.hidden,
      ).toBe(false);
      expect(
        host.querySelector<HTMLElement>('[data-mawaqit-pan]')!.hidden,
      ).toBe(true);
      zoom.click();
      expect(zoom.getAttribute('aria-pressed')).toBe('true');
      expect(right.disabled).toBe(true);
      expect(left.disabled).toBe(false);
      expect(panel.getAttribute('aria-describedby')).toBe(
        'mawaqit-scroll-hint',
      );
      left.click();
      left.click();
      expect(offset).toBe(0);
      expect(left.disabled).toBe(true);
      right.click();
      right.click();
      expect(offset).toBe(380);
      zoom.click();
      expect(zoom.getAttribute('aria-pressed')).toBe('false');
      expect(panel.getAttribute('aria-describedby')).toBeNull();
      expect(offset).toBe(0);
      expect(frame.outerHTML).toBe(original);
    } finally {
      cleanup();
      host.remove();
    }
    expect(card.dataset.widgetZoomed).toBeUndefined();
  });
  it('shows the two provider Friday entries separately, without inventing sermon/iqama semantics', () => {
    const section = homepage().querySelector('.friday-info')!;
    expect(
      [...section.querySelectorAll('time')].map((t) =>
        t.getAttribute('datetime'),
      ),
    ).toEqual(['13:00', '13:30']);
    expect(
      [...section.querySelectorAll('dt')].map((t) => t.textContent),
    ).toEqual(['الجمعة الأولى', 'الجمعة الثانية']);
    expect(section.textContent).not.toContain('وقت الإقامة');
    expect(section.textContent).not.toContain('وقت الخطبة');
    expect(section.textContent).toContain('المصلّى');
  });
  it('does not initialize our inactive countdown or expose imported prayer payloads', () => {
    vi.useFakeTimers();
    const doc = homepage();
    const cleanup = initPrayerCards(doc);
    try {
      expect(prayerData).toBeNull();
      expect(
        doc.querySelector(
          '[data-prayer-card], [data-prayer-payload], [data-countdown]',
        ),
      ).toBeNull();
      expect(doc.querySelector('.prayer-unavailable')).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });
  it('keeps other routes and offline pages free of third-party embeds', () => {
    for (const page of ['legal', 'library', 'sermons', 'together']) {
      const doc = new DOMParser().parseFromString(
        readFileSync(`dist/${page}.html`, 'utf8'),
        'text/html',
      );
      expect(doc.querySelector('iframe')).toBeNull();
    }
    const legal = readFileSync('dist/legal.html', 'utf8');
    expect(legal).toContain('IP-Adresse');
    expect(legal).toContain(mawaqit.sourceUrl);
  });
});
