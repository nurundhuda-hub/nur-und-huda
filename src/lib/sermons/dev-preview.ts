import { splitSuppliedSermon } from './drafts.ts';
import { escapeHtml } from './render.ts';
import { readerFrame } from './reader-markup.ts';
import { educationalSeries } from '../../content/educational-series.ts';

export const PREVIEW_NOTICE = 'نسخة تجريبية للمراجعة — غير منشورة للعامة';
export const PREVIEW_PATH = '/nur-und-huda/_review/first-sermon';
// Only the supplied **bold** syntax is interpreted. No HTML, links, images or MDX.
const suppliedText = (text: string) =>
  escapeHtml(text).replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>');

/** Dev middleware calls this with the local source; no public catalog is constructed. */
export function renderLocalSermon(source: Uint8Array): string {
  const raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
    source,
  );
  const spans = splitSuppliedSermon(raw);
  const title = /^# ([^\r\n]+)\r?$/m.exec(raw)?.[1];
  if (!title)
    throw new Error('The supplied source requires its original title.');
  const topic = educationalSeries.topics[0]!;
  const body = (prefix: string) =>
    spans
      .map(
        (span, index) =>
          `<section class="khutbah-part" aria-labelledby="${prefix === 'reader' ? 'reader-title ' : ''}${prefix}-part-${index + 1}"><h2 id="${prefix}-part-${index + 1}">${index === 0 ? 'الخطبة الأولى' : 'الخطبة الثانية'}</h2><div class="content-block" data-preview-part="${index + 1}">${suppliedText(raw.slice(span.start, span.end))}</div></section>`,
      )
      .join('');
  const preamble = raw
    .slice(0, raw.indexOf('### الخطبة الأولى'))
    .replace(/^\uFEFF/, '')
    .replace(/^# ([^\r\n]+)\r?\n/, '');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer"><title>${escapeHtml(title)} — مراجعة محلية</title><script type="module" src="/nur-und-huda/src/dev/sermon-preview-client.ts"></script></head><body><a class="skip-link" href="#main-content">انتقل إلى المحتوى</a><main id="main-content" class="shell page-body sermon-page" tabindex="-1"><nav class="sermon-nav" aria-label="العودة إلى السلسلة"><a href="/nur-und-huda/sermons.html#series-ma-la-yasa">السلسلة التعليمية</a></nav>${readerFrame(title, body('reader'), PREVIEW_NOTICE)}<article class="reading-panel light-surface sermon-article"><p class="preview-notice">${PREVIEW_NOTICE}</p><p class="preview-series">${escapeHtml(educationalSeries.title)} · الدرس ${topic.order}</p><h1>${escapeHtml(title)}</h1><div class="content-block preview-preamble">${suppliedText(preamble)}</div>${body('preview')}</article></main></body></html>`;
}
