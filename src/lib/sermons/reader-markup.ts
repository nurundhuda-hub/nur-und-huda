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
  return `<div id="imam" data-sermon-reader><div class="sermon-actions"><button type="button" class="button" data-reader-open aria-haspopup="dialog" aria-controls="sermon-reader-dialog" hidden>وضع الإمام</button><button type="button" class="button button-outline" data-sermon-print hidden>طباعة الخطبة</button></div><noscript><p>النص متاح للقراءة والطباعة من قائمة المتصفح. أدوات وضع الإمام تحتاج JavaScript.</p></noscript>
<dialog id="sermon-reader-dialog" class="sermon-reader light-surface" aria-labelledby="reader-title">
<div class="reader-toolbar">
<div class="reader-primary"><button type="button" class="button button-outline" data-reader-close autofocus aria-label="إغلاق وضع الإمام">خروج</button><button type="button" class="button button-outline" data-font-step="-2" aria-label="تصغير الخط">−</button><button type="button" class="button button-outline" data-font-step="2" aria-label="تكبير الخط">+</button><label class="reader-theme"><span class="sr-only">المظهر</span><select data-reader-theme><option value="system">مظهر الجهاز</option><option value="light">فاتح</option><option value="dark">داكن</option></select></label></div>
<div class="reader-auto" data-auto-controls hidden>
<button type="button" class="button reader-auto-toggle" data-auto-toggle aria-pressed="false">بدء</button>
<div class="reader-speed"><label for="imam-scroll-speed">سرعة التمرير</label><output id="imam-scroll-speed-label" for="imam-scroll-speed" data-auto-speed-label aria-live="polite">2 / 10 · 10 بكسل/ث</output><input id="imam-scroll-speed" type="range" min="1" max="10" step="1" value="2" data-auto-speed aria-describedby="imam-scroll-speed-label"></div>
<div class="reader-part-controls"><button type="button" class="button button-outline" data-auto-reset>بداية الخطبة</button><button type="button" class="button button-outline" data-auto-part>الانتقال إلى الخطبة الثانية</button></div>
<p data-auto-status class="reader-auto-status" role="status" aria-live="polite"></p>
</div>
<details class="reader-options"><summary>خيارات القراءة</summary><div class="reader-option-controls"><div class="reader-size"><label for="reader-font-size">حجم الخط</label><input id="reader-font-size" type="range" min="18" max="44" step="2" value="32" data-reader-size><output for="reader-font-size" data-reader-size-label aria-live="polite">32 px</output><button type="button" class="button button-outline" data-font-reset aria-label="إعادة حجم الخط الافتراضي">إعادة الحجم</button></div><button type="button" class="button button-outline" data-reader-fullscreen aria-pressed="false" hidden>ملء الشاشة</button><button type="button" class="button button-outline" data-reader-wake aria-pressed="false">إبقاء الشاشة مضاءة</button><button type="button" class="button button-outline" data-sermon-print>طباعة الخطبة</button><p class="small" data-wake-status role="status"></p></div></details>
</div><div class="reader-viewport" data-reader-viewport tabindex="0" role="region" aria-label="نص الخطبة"><div class="reader-text"><h2 id="reader-title">${escapeHtml(title)}</h2>${notice ? `<p class="preview-notice">${escapeHtml(notice)}</p>` : ''}${renderedBody}</div></div></dialog></div>`;
}
