import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const palette = Object.fromEntries(
  [...tokens.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map((match) => [
    match[1],
    match[2]!.toUpperCase(),
  ]),
);
function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
function contrast(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (values[1]! + 0.05) / (values[0]! + 0.05);
}
it('keeps the five exact approved palette tokens', () => {
  expect(palette).toEqual({
    emerald: '#073D30',
    green: '#0E5140',
    gold: '#C9A45C',
    'light-gold': '#E4C783',
    ivory: '#F8F3E6',
  });
});
it.each([
  ['ivory', 'emerald'],
  ['ivory', 'green'],
  ['light-gold', 'emerald'],
  ['light-gold', 'green'],
  ['emerald', 'ivory'],
])('%s text on %s passes normal-text contrast', (text, background) => {
  expect(contrast(palette[text]!, palette[background]!)).toBeGreaterThanOrEqual(
    4.5,
  );
});
