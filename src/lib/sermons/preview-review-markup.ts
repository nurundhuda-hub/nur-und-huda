import { escapeHtml } from './render.ts';
import {
  canShowApprovalSteps,
  reviewCategories,
  type PreviewReviewStatus,
} from './preview-status.ts';

/** Render a status snapshot, never a web approval form or an authenticated action. */
export function previewReviewMarkup(review: PreviewReviewStatus): string {
  const ready = canShowApprovalSteps(review);
  const approved =
    review.state === 'approved' &&
    review.reviewRecorded === true &&
    review.missing.length === 0;
  const evidence =
    ready || approved
      ? 'سجل الأدلة مكتمل وفق التحقق المحلي'
      : review.reviewRecorded
        ? 'المراجعة موثقة؛ التحقق النهائي لم يكتمل'
        : 'لم يُتحقق من اكتمال سجل الأدلة';
  return `<section class="reading-panel light-surface preview-approval" data-preview-approval data-review-eligible="${ready}" aria-labelledby="approval-title">
<h2 id="approval-title">اعتماد الخطبة</h2>
<p>النسخة الحالية: <bdi data-review-revision>${escapeHtml(review.revision ?? 'غير متاحة')}</bdi></p>
<p data-review-status>${approved ? 'معتمدة محلياً — لم تُنشر للعامة' : ready ? 'اكتملت متطلبات المراجعة — بانتظار اعتماد صريح' : 'مسودة غير معتمدة — المتطلبات المتبقية تمنع الاعتماد'}</p>
<p id="review-checklist-help">هذه القائمة تساعدك على تنظيم المراجعة البشرية في هذه الجلسة فقط. تحديد المربعات لا يتحقق من صحة المصادر، ولا يحفظ دليلاً، ولا يعتمد الخطبة. يجب توثيق الأدلة وحل الملاحظات في سجل المراجعة المحلي أولاً.</p>
<fieldset class="review-checklist" aria-describedby="review-checklist-help" ${approved ? 'disabled' : ''}><legend>قائمة المراجعة البشرية</legend>
${reviewCategories.map((category) => `<div class="review-category"><label for="review-check-${category.id}"><input id="review-check-${category.id}" type="checkbox" data-review-check="${category.id}" aria-describedby="review-evidence-${category.id}"><span>راجعت ${category.title}</span></label><p id="review-evidence-${category.id}" class="small">المطلوب: ${category.evidence}<br><span data-review-evidence>${evidence}</span></p></div>`).join('')}
</fieldset>
<p class="small" data-review-progress role="status">لم تُحدد بنود المراجعة في هذه الجلسة.</p>
<details class="review-technical"><summary>تفاصيل تقنية وملاحظات المراجعة (${review.missing.length})</summary><p class="small">ملاحظات السجل المحلي كما هي؛ لا تعني مجرد قراءتها أو تحديد المربعات أنها حُلّت.</p>${review.missing.length ? `<ul>${review.missing.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>لا توجد موانع مسجلة في حالة التحقق الحالية.</p>'}</details>
<p id="approval-help">لا يوجد اعتماد مباشر من هذه الصفحة. الاعتماد الحالي يتم عبر أمر محلي في الطرفية بعد مراجعة النسخة وبصمتها. الزر التالي يعرض الخطوات فقط. إعداد ملف النشر والإذن بالنشر إجراءان منفصلان لاحقاً.</p>
<button type="button" class="button" data-preview-approve aria-describedby="approval-help review-action-help" aria-expanded="false" aria-controls="approval-command" disabled>عرض خطوات الاعتماد المحلي</button>
<p class="small" id="review-action-help">${approved ? 'هذه النسخة معتمدة محلياً بالفعل؛ النشر لا يزال إجراءً منفصلاً.' : ready ? 'أكمل قائمة المراجعة في هذه الجلسة لعرض خطوات الأمر المحلي.' : 'عرض الخطوات معطّل حتى يكتمل توثيق الأدلة والتحقق من النسخة. تحديد جميع المربعات لن يزيل هذا المنع.'}</p>
<div id="approval-command" hidden><p>راجع النسخة والبصمة ثم نفّذ الأمر بنفسك في مجلد المشروع. أعد تحميل الصفحة بعد نجاحه. عرض هذا الأمر لا ينفّذه ولا ينشر النص.</p>${ready ? `<pre dir="ltr"><code>npm run sermon:workflow -- approve --input .sermon-review/reviewed-r1.json --confirm-sha256 ${review.reviewedSha256} --out .sermon-review/approved-r1.json</code></pre>` : ''}</div>
</section>`;
}
