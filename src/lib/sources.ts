export interface DirectorySource {
  title: string;
  description: string;
  language: string;
  languageCode: 'ar' | 'de';
  url: string;
  searchTerms: string;
}

// Verified directory destinations retained from the original site, not book records.
export const librarySources: readonly DirectorySource[] = [
  {
    title: 'رسالة الحرمين — العربية',
    description:
      'تصفّح المصادر العربية في موقع رسالة الحرمين. روابط إلى النسخ الأصلية، دون إعادة استضافة الكتب.',
    language: 'العربية',
    languageCode: 'ar',
    url: 'https://risala.prh.gov.sa/ar/main-content',
    searchTerms: 'العربية عربي arabic ar مصادر مكتبة رسالة الحرمين',
  },
  {
    title: 'رسالة الحرمين — Deutsch',
    description: 'تصفّح المصادر باللغة الألمانية في موقع رسالة الحرمين.',
    language: 'Deutsch',
    languageCode: 'de',
    url: 'https://risala.prh.gov.sa/de/main-content',
    searchTerms:
      'الألمانية ألماني الماني deutsch german de مصادر مكتبة رسالة الحرمين',
  },
];

export const officialSources = {
  quran: 'https://qurancomplex.gov.sa/apps/',
  quranRights: 'https://dm.qurancomplex.gov.sa/rights/',
  mawaqit: 'https://mawaqit.net',
  mawaqitAsSalamHamm: 'https://mawaqit.net/de/essalam-hamm',
};
