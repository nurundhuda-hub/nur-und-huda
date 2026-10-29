export const tagline = 'منبر للذكر .. ومرجع للعلم النافع';

// Every internal URL must include the GitHub Pages project base.
export function sitePath(path = ''): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export const navigation = [
  { page: 'home', label: 'الرئيسية', path: 'index.html' },
  { page: 'together', label: 'نصلّي معاً', path: 'together.html' },
  { page: 'sermons', label: 'منبر الجمعة', path: 'sermons.html' },
  { page: 'quran', label: 'القرآن الكريم', path: 'quran.html' },
  { page: 'library', label: 'المكتبة', path: 'library.html' },
] as const;

export type Page = (typeof navigation)[number]['page'] | 'legal';
