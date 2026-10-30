import { readFileSync } from 'node:fs';
import type { PublicSermonCatalog } from './model.ts';
import { escapeHtml, requirePublished, sermonArticle } from './render.ts';

export function renderOfflineSermon(
  release: PublicSermonCatalog,
  id: string,
  revision: string,
): string {
  requirePublished(release, id, revision);
  const font = readFileSync(
    'node_modules/@fontsource/amiri/files/amiri-arabic-400-normal.woff2',
  ).toString('base64');
  const bold = readFileSync(
    'node_modules/@fontsource/amiri/files/amiri-arabic-700-normal.woff2',
  ).toString('base64');
  const license = escapeHtml(
    readFileSync('node_modules/@fontsource/amiri/LICENSE', 'utf8'),
  );
  const article = sermonArticle(
    release,
    id,
    revision,
    'https://nurundhuda-hub.github.io/nur-und-huda/',
  );
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>نور وهدى — ${id} — ${revision}</title><style>
@font-face{font-family:Amiri;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:Amiri;src:url(data:font/woff2;base64,${bold}) format('woff2');font-weight:700;font-display:swap}
body{font:1.5rem/1.9 Amiri,serif;color:#073D30;background:#F8F3E6;margin:0;padding:1rem}main{max-width:50rem;margin:auto}a{color:#073D30;text-underline-offset:.2em}a:focus-visible{outline:3px solid #073D30}h1,h2{line-height:1.6;break-after:avoid}.content-block{white-space:pre-wrap;overflow-wrap:anywhere}.khutbah-part+ .khutbah-part{border-top:2px solid #C9A45C;padding-top:1rem}.content-metadata{font-size:1rem}.content-metadata dd{margin:0;overflow-wrap:anywhere}.content-references{font-size:1.1rem}pre{white-space:pre-wrap;font-size:.8rem}.sermon-actions{display:none}
@media print{body{padding:0;background:white}nav,.study-link,.offline-note,.font-license,.skip-link{display:none}p,li{orphans:3;widows:3}.khutbah-part{break-inside:auto}h1,h2{break-after:avoid}a{color:#073D30}}
</style></head><body><a class="skip-link" href="#main-content">انتقل إلى المحتوى</a><main id="main-content"><p class="offline-note">نسخة محفوظة من مراجعة معتمدة؛ لا تتحدث تلقائياً. فتح روابط الدراسة والمراجع يحتاج اتصالاً.</p>${article}</main><footer><p>منبر للذكر .. ومرجع للعلم النافع</p><details class="font-license"><summary>Amiri — SIL Open Font License 1.1</summary><pre lang="en" dir="ltr">${license}</pre></details></footer></body></html>`;
}
