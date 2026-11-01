/** Read-only local UI state. No draft bodies or approval actions are sent to JS. */
export interface PreviewReviewStatus {
  state: 'blocked' | 'ready' | 'approved';
  revision?: string;
  missing: string[];
  reviewedSha256?: string;
}
export const reviewRequirements = [
  'مطابقة النص الأصلي والمراجعة البشرية للنسخة المحددة',
  'التحقق من المصادر والمراجع القرآنية والحديثية',
  'التحقق من حقوق الاستخدام ونسبة المصدر',
  'اكتمال الدراسة المصاحبة ومراجعتها',
  'مراجعة مدة إلقاء الخطبة',
  'اختيار موعد الجمعة وتاريخ النشر صراحةً',
  'مراجعة السياق وحل جميع ملاحظات الاستيراد',
];
export const unavailableReview = (): PreviewReviewStatus => ({
  state: 'blocked',
  missing: [
    'لم تتوفر مراجعة محلية صالحة مرتبطة بهذا النص.',
    ...reviewRequirements,
  ],
});
