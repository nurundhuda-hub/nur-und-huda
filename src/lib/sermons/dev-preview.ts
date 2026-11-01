import { splitSuppliedSermon } from './drafts.ts';
import { escapeHtml } from './render.ts';
import { readerFrame } from './reader-markup.ts';
import { educationalSeries } from '../../content/educational-series.ts';
import {
  unavailableReview,
  type PreviewReviewStatus,
} from './preview-status.ts';

export const PREVIEW_NOTICE = 'نسخة تجريبية للمراجعة — غير منشورة للعامة';
export const PREVIEW_PATH = '/nur-und-huda/_review/first-sermon';
// Only the supplied **bold** syntax is interpreted. No HTML, links, images or MDX.
const suppliedText = (text: string) =>
  escapeHtml(text).replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>');

/** Dev middleware calls this with the local source; no public catalog is constructed. */
export function renderLocalSermon(
  source: Uint8Array,
  review: PreviewReviewStatus = unavailableReview(),
): string {
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
  const ready =
    review.state === 'ready' &&
    /^[a-f0-9]{64}$/.test(review.reviewedSha256 ?? '') &&
    review.missing.length === 0;
  const approval = `<section class="reading-panel light-surface preview-approval" data-preview-approval aria-labelledby="approval-title"><h2 id="approval-title">اعتماد الخطبة</h2><p data-review-status>${review.state === 'approved' ? 'معتمدة محلياً — لم تُنشر للعامة' : ready ? 'اكتملت متطلبات المراجعة — بانتظار اعتماد صريح' : 'مسودة غير معتمدة — المتطلبات غير مكتملة'}</p>${review.revision ? `<p>النسخة: <bdi>${escapeHtml(review.revision)}</bdi></p>` : ''}${review.missing.length ? `<h3>المتطلبات المتبقية</h3><ul>${review.missing.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}<p id="approval-help">الاعتماد يتم بأمر محلي صريح بعد مراجعة النسخة وبصمتها. هذا الزر يعرض الأمر فقط؛ لا يعتمد ولا ينشر النص. النشر يحتاج إجراءً منفصلاً.</p><button type="button" class="button" data-preview-approve aria-describedby="approval-help" aria-expanded="false" aria-controls="approval-command" ${ready ? '' : 'disabled'}>اعتماد الخطبة — عرض الأمر المحلي</button><div id="approval-command" hidden><p>راجع النسخة ثم نفّذ الأمر في مجلد المشروع. أعد تحميل الصفحة بعد نجاحه.</p>${ready ? `<pre dir="ltr"><code>npm run sermon:workflow -- approve --input .sermon-review/reviewed-r1.json --confirm-sha256 ${review.reviewedSha256} --out .sermon-review/approved-r1.json</code></pre>` : ''}</div></section>`;
  const toolbar = `<section class="preview-toolbar light-surface" data-preview-toolbar aria-label="أدوات قراءة الخطبة"><div class="preview-control-row"><button type="button" class="button button-outline" data-preview-step="-2" disabled>− تصغير الخط</button><button type="button" class="button button-outline" data-preview-step="2" disabled>+ تكبير الخط</button><button type="button" class="button button-outline" data-preview-reset disabled>إعادة الحجم</button><output data-preview-size aria-live="polite">32 px</output><label>المظهر <select data-preview-theme disabled><option value="system">مظهر الجهاز</option><option value="light">فاتح</option><option value="dark">داكن</option></select></label><a href="#approval-title">اعتماد الخطبة</a></div><p class="small" data-preview-init role="status">جارٍ تهيئة أدوات القراءة…</p><noscript><p>أدوات القراءة تحتاج JavaScript؛ النص والطباعة من قائمة المتصفح متاحان.</p></noscript></section>`;
  return `<!doctype html><html lang="ar" dir="rtl" class="local-sermon-preview"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer"><title>${escapeHtml(title)} — مراجعة محلية</title><script type="module" src="/nur-und-huda/src/dev/sermon-preview-client.ts"></script></head><body><a class="skip-link" href="#main-content">انتقل إلى المحتوى</a><main id="main-content" class="shell page-body sermon-page" tabindex="-1"><nav class="sermon-nav" aria-label="العودة إلى السلسلة"><a href="/nur-und-huda/sermons.html#series-ma-la-yasa">السلسلة التعليمية</a></nav>${toolbar}${readerFrame(title, body('reader'), PREVIEW_NOTICE)}<article class="reading-panel light-surface sermon-article" data-preview-article><p class="preview-notice">${PREVIEW_NOTICE}</p><p class="preview-series">${escapeHtml(educationalSeries.title)} · الدرس ${topic.order}</p><h1>${escapeHtml(title)}</h1><div class="content-block preview-preamble">${suppliedText(preamble)}</div>${body('preview')}</article>${approval}</main></body></html>`;
}
