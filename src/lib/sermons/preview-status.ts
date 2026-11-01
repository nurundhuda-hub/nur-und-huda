/** Read-only presentation contract. A future authenticated adapter must validate
 * evidence/identity server-side; this snapshot and browser checks grant no authority. */
export interface PreviewReviewStatus {
  state: 'blocked' | 'ready' | 'approved';
  revision?: string;
  missing: string[];
  reviewedSha256?: string;
  reviewRecorded?: boolean;
  study?: { state: 'present' | 'missing' | 'invalid'; revision?: string };
}
export const reviewCategories = [
  {
    id: 'sourceText',
    title: 'النص والنسخة',
    evidence: 'مطابقة النص الأصلي وتوثيق المراجعة للنسخة المحددة.',
  },
  {
    id: 'references',
    title: 'المصادر والأدلة الشرعية',
    evidence: 'توثيق مصدر الكتاب ومواضع الاقتباسات ومراجعة الآيات والأحاديث.',
  },
  {
    id: 'rights',
    title: 'حقوق الاستخدام',
    evidence: 'دليل الإذن بالاستخدام ونسبة المحتوى إلى مصدره.',
  },
  {
    id: 'completeStudy',
    title: 'الدراسة المصاحبة',
    evidence: 'دراسة مكتملة ومراجعة، مرتبطة بهذه النسخة من الخطبة.',
  },
  {
    id: 'duration',
    title: 'مدة الإلقاء',
    evidence: 'تسجيل مراجعة بشرية لمدة قراءة الخطبتين.',
  },
  {
    id: 'dates',
    title: 'المواعيد',
    evidence: 'اختيار موعد الجمعة وتاريخ النشر صراحةً.',
  },
  {
    id: 'context',
    title: 'السياق والملاحظات',
    evidence: 'مراجعة المعلومات المحلية والوعود الزمنية وحل ملاحظات الاستيراد.',
  },
] as const;
export type ReviewCategoryId = (typeof reviewCategories)[number]['id'];
export function canShowApprovalSteps(review: PreviewReviewStatus): boolean {
  return (
    review.state === 'ready' &&
    review.reviewRecorded === true &&
    /^[a-f0-9]{64}$/.test(review.reviewedSha256 ?? '') &&
    review.missing.length === 0
  );
}
export const unavailableReview = (): PreviewReviewStatus => ({
  state: 'blocked',
  missing: ['لم تتوفر مراجعة محلية صالحة مرتبطة بهذا النص.'],
});
