import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { mawaqit } from '../src/data/mawaqit';
import { prayerData } from '../src/data/prayer-data';
import { initPrayerCards } from '../src/scripts/prayer-card';
const homepage = () =>
  new DOMParser().parseFromString(
    readFileSync('dist/index.html', 'utf8'),
    'text/html',
  );

describe('official Nur und Huda widget on the built homepage', () => {
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
    expect(link.textContent).toContain('عرض مواقيت نور وهدى');
    expect(link.target).toBe('_blank');
    expect(link.relList.contains('noopener')).toBe(true);
    expect(link.relList.contains('noreferrer')).toBe(true);
    expect(link.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(link.closest('iframe, [hidden], details')).toBeNull();
    expect(
      card.querySelector('[data-mosque-attribution]')?.textContent,
    ).toContain('المصدر: مصلّى نور وهدى');
    expect(
      card.querySelector('[data-mosque-attribution]')?.textContent,
    ).toContain('56820');
    expect(card.textContent).toContain('إذا لم تظهر اللوحة');
    expect(card.textContent).not.toContain('مسجد السلام');
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
    for (const page of ['legal', 'library', 'quran', 'sermons', 'together']) {
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
