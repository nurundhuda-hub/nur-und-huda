/** Publisher-provided reader and mobile interface; no text API or local dataset. */
export const quranReader = {
  desktop: 'https://quran.ksu.edu.sa/index.php?l=ar',
  mobile: 'https://quran.ksu.edu.sa/m.php',
  publisher: 'https://quran.ksu.edu.sa/index.php?l=ar',
  imageSource: 'https://qurancomplex.gov.sa/',
  desktopQuery: '(min-width: 1100px)',
} as const;

/** The reader's own documented/shared aya fragment selects a surah's first verse. */
export function quranReaderUrl(desktop: boolean, surah = 1): string {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114)
    throw new Error('Invalid surah number.');
  return `${desktop ? quranReader.desktop : quranReader.mobile}#aya=${surah}_1`;
}
