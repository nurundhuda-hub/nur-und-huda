import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import axe from 'axe-core';
import { initSourceDirectories } from '../src/scripts/search';
import { mountPrayerCard } from '../src/scripts/prayer-card';
import { fixture } from './fixtures/prayer-data';

it.each(['index', 'together', 'sermons', 'quran', 'library', 'legal'])(
  '%s has no detected structural accessibility violations',
  async (page) => {
    const parsed = new DOMParser().parseFromString(
      readFileSync(`dist/${page}.html`, 'utf8'),
      'text/html',
    );
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    document.head.innerHTML = parsed.head.innerHTML;
    document.body.innerHTML = parsed.body.innerHTML;
    initSourceDirectories(document);
    // No layout engine in jsdom: contrast and real visibility are checked
    // separately or left explicitly pending, never inferred from this result.
    const result = await axe.run(document.documentElement, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'],
      },
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(
      result.violations.map(({ id, nodes }) => ({
        id,
        elements: nodes.map((node) => node.target),
      })),
    ).toEqual([]);
  },
);

it('enhanced synthetic prayer state has no detected structural accessibility violations', async () => {
  const parsed = new DOMParser().parseFromString(
    readFileSync('dist/index.html', 'utf8'),
    'text/html',
  );
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  const card = document.querySelector<HTMLElement>('[data-prayer-card]')!;
  const cleanup = mountPrayerCard(card, fixture(), {
    allowTestFixtures: true,
    now: () => Date.parse('2030-01-01T03:00:00Z'),
  });
  card.querySelector('details')!.open = true;
  try {
    const result = await axe.run(document.documentElement, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'],
      },
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(result.violations.map(({ id }) => id)).toEqual([]);
  } finally {
    cleanup();
  }
});
