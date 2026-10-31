import type { PublishedSermon } from './model.ts';
import { escapeHtml, sermonBody } from './render.ts';

export function readerMarkup(item: PublishedSermon): string {
  return readerFrame(
    `${item.sermon.title} — ${item.sermon.revision}`,
    sermonBody(item, 'reader'),
  );
}

/** Shared controls; renderedBody must come from an escaping renderer, never raw input. */
export function readerFrame(
  title: string,
  renderedBody: string,
  notice = '',
): string {
  return `<div data-sermon-reader><div class="sermon-actions"><button type="button" class="button" data-reader-open aria-haspopup="dialog" aria-controls="sermon-reader-dialog" hidden>وضع الإمام</button><button type="button" class="button button-outline" data-sermon-print hidden>طباعة الخطبة</button></div><noscript><p>النص متاح للقراءة والطباعة من قائمة المتصفح. أدوات وضع الإمام تحتاج JavaScript.</p></noscript><dialog id="sermon-reader-dialog" class="sermon-reader light-surface" aria-labelledby="reader-title"><div class="reader-toolbar"><button type="button" class="button button-outline" data-reader-close autofocus>إغلاق وضع الإمام</button><div class="reader-size"><label for="reader-font-size">حجم الخط</label><button type="button" class="button button-outline" data-font-step="-2" aria-label="تصغير الخط">−</button><input id="reader-font-size" type="range" min="18" max="44" step="2" value="32" data-reader-size><button type="button" class="button button-outline" data-font-step="2" aria-label="تكبير الخط">+</button><output for="reader-font-size" data-reader-size-label aria-live="polite">32 px</output><button type="button" class="button button-outline" data-font-reset aria-label="إعادة حجم الخط الافتراضي">إعادة الحجم</button></div><label class="reader-theme">المظهر <select data-reader-theme><option value="system">مظهر الجهاز</option><option value="light">فاتح</option><option value="dark">داكن</option></select></label><button type="button" class="button button-outline" data-reader-fullscreen aria-pressed="false" hidden>ملء الشاشة</button><button type="button" class="button button-outline" data-reader-wake aria-pressed="false">إبقاء الشاشة مضاءة</button><button type="button" class="button button-outline" data-sermon-print>طباعة الخطبة</button><p class="small" data-wake-status role="status"></p></div><div class="reader-viewport" data-reader-viewport tabindex="0" role="region" aria-label="نص الخطبة"><div class="reader-text"><h2 id="reader-title">${escapeHtml(title)}</h2>${notice ? `<p class="preview-notice">${escapeHtml(notice)}</p>` : ''}${renderedBody}</div></div></dialog></div>`;
}
