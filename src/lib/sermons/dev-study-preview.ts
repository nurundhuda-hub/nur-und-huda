import { escapeHtml } from './render.ts';
import { PREVIEW_PATH, PREVIEW_NOTICE, previewToolbar } from './dev-preview.ts';
import { readerFrame } from './reader-markup.ts';
import type { PrivateStudyRevision, StudyBlock } from './private-study.ts';

const inline = (text: string) =>
  escapeHtml(text).replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>');
export function renderStudyBlocks(
  blocks: StudyBlock[],
  reader = false,
): string {
  let html = '',
    list: 'ol' | 'ul' | null = null;
  const close = () => {
    if (list) html += `</${list}>`;
    list = null;
  };
  for (const block of blocks) {
    const type =
      block.kind === 'ordered'
        ? 'ol'
        : block.kind === 'unordered'
          ? 'ul'
          : null;
    if (list && list !== type) close();
    if (type) {
      if (!list) {
        list = type;
        html += `<${type}>`;
      }
      html += `<li class="content-block"${type === 'ol' ? ` value="${block.number}"` : ''}>${inline(block.text)}</li>`;
    } else if (block.kind === 'heading') {
      const level = reader && block.level === 1 ? 2 : block.level;
      html += `<h${level}>${inline(block.text)}</h${level}>`;
    } else if (block.kind === 'paragraph')
      html += `<p class="content-block">${inline(block.text)}</p>`;
    else if (block.kind === 'rule') html += '<hr>';
  }
  close();
  return html;
}
export function renderLocalStudy(study: PrivateStudyRevision): string {
  const title = study.blocks.find(
    (block) => block.kind === 'heading' && block.level === 1,
  )!.text;
  const metadata = `<p class="preview-notice">${PREVIEW_NOTICE}</p><p class="small" data-study-status>الدراسة ${study.revision} مرتبطة بالخطبة ${study.sermon.revision}. موافقة تحريرية من المالك فقط؛ التحقق من المراجع وحقوق الاستخدام وإذن النشر ما زالت معلّقة. عبارات حالة المسودة في النص الأصلي محفوظة كما وردت.</p>`;
  return `<!doctype html><html lang="ar" dir="rtl" class="local-sermon-preview"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer"><title>${escapeHtml(title)} — مراجعة الدراسة محلياً</title><script type="module" src="/nur-und-huda/src/dev/sermon-preview-client.ts"></script></head><body><a class="skip-link" href="#main-content">انتقل إلى المحتوى</a><main id="main-content" class="shell page-body sermon-page" tabindex="-1"><nav class="sermon-nav" aria-label="التنقل بين الخطبة والدراسة"><a href="${PREVIEW_PATH}">العودة إلى الخطبة</a><a href="/nur-und-huda/sermons.html#series-ma-la-yasa">السلسلة التعليمية</a></nav>${previewToolbar(true)}${readerFrame(title, metadata + `<div data-private-study-body>${renderStudyBlocks(study.blocks, true)}</div>`, PREVIEW_NOTICE)}<article class="reading-panel light-surface sermon-article" data-preview-article>${metadata}<div data-private-study-body>${renderStudyBlocks(study.blocks)}</div><nav class="sermon-nav" aria-label="العودة بعد الدراسة"><a href="${PREVIEW_PATH}">العودة إلى الخطبة</a></nav></article></main></body></html>`;
}
