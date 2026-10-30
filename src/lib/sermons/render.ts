import type {
  ContentBlock,
  RevisionBase,
  PublicSermonCatalog,
  PublishedSermon,
} from './model.ts';
import { downloadPath, sermonPath, studyPath } from './publication.ts';

export const escapeHtml = (text: string): string =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );
export function requirePublished(
  release: PublicSermonCatalog,
  id: string,
  revision: string,
): PublishedSermon {
  const item = release.published.find(
    (item) => item.sermon.id === id && item.sermon.revision === revision,
  );
  if (!item)
    throw new Error('No published approved sermon/study pair for this route.');
  return item;
}
function blocks(
  items: ContentBlock[],
  base: RevisionBase,
  prefix: string,
): string {
  return items
    .map(
      (block) =>
        `<p class="content-block content-${block.kind}">${escapeHtml(block.text)}${block.citations.map((id) => ` <a class="citation" href="#${prefix}-reference-${id}" aria-label="المصدر ${base.references.findIndex((ref) => ref.id === id) + 1}">[${base.references.findIndex((ref) => ref.id === id) + 1}]</a>`).join('')}</p>`,
    )
    .join('');
}
function references(base: RevisionBase, prefix: string): string {
  return `<section class="content-references" aria-labelledby="${prefix === 'reader' ? 'reader-title ' : ''}${prefix}-references"><h2 id="${prefix}-references">المصادر والمراجع</h2><ol>${base.references.map((ref) => `<li id="${prefix}-reference-${ref.id}">${ref.url ? `<a href="${escapeHtml(ref.url)}">${escapeHtml(ref.label)}</a>` : escapeHtml(ref.label)} — ${escapeHtml(ref.locator)}</li>`).join('')}</ol><p>${escapeHtml(base.rights.attribution)}</p></section>`;
}
export function sermonBody(item: PublishedSermon, prefix = 'sermon'): string {
  return (
    item.sermon.parts
      .map(
        (part, index) =>
          `<section class="khutbah-part" aria-labelledby="${prefix === 'reader' ? 'reader-title ' : ''}${prefix}-part-${index + 1}"><h2 id="${prefix}-part-${index + 1}">${index === 0 ? 'الخطبة الأولى' : 'الخطبة الثانية'}</h2>${blocks(part, item.sermon, prefix)}</section>`,
      )
      .join('') + references(item.sermon, prefix)
  );
}
function metadata(base: RevisionBase): string {
  return `<dl class="content-metadata"><div><dt>المراجعة</dt><dd>${escapeHtml(base.revision)}</dd></div><div><dt>تاريخ النشر المحدد</dt><dd><time datetime="${base.publishAt}" dir="ltr">${base.publishAt}</time></dd></div><div><dt>المراجع البشري</dt><dd>${escapeHtml(base.approval.reviewer!)}</dd></div><div><dt>تاريخ الاعتماد</dt><dd><time datetime="${base.approval.reviewedAt}" dir="ltr">${base.approval.reviewedAt}</time></dd></div></dl>`;
}
export function sermonArticle(
  release: PublicSermonCatalog,
  id: string,
  revision: string,
  base: string,
): string {
  const item = requirePublished(release, id, revision),
    s = item.sermon;
  const versions = release.published
    .filter((item) => item.sermon.id === id)
    .sort(
      (a, b) =>
        Number(b.sermon.revision.slice(1)) - Number(a.sermon.revision.slice(1)),
    );
  return `<h1>${escapeHtml(s.title)}</h1><p class="status">منشورة بعد الاعتماد</p><p>الجمعة: <time datetime="${s.friday}" dir="ltr">${s.friday}</time> · المدة التقديرية بعد المراجعة: ${s.duration.minutes} دقائق</p>${metadata(s)}${sermonBody(item)}<p class="study-link"><a class="button" href="${base}${studyPath(item.study.id, item.study.revision)}">اقرأ الموضوع كاملاً</a></p><p class="sermon-actions"><a href="${base}${downloadPath(id, revision)}" download="${id}-${revision}.html">حفظ الخطبة المعتمدة للقراءة دون اتصال — ${revision}</a></p><nav class="revision-history" aria-label="المراجعات المنشورة"><h2>المراجعات المنشورة</h2><ul>${versions.map(({ sermon }) => `<li><a href="${base}${sermonPath(id, sermon.revision)}"${sermon.revision === revision ? ' aria-current="page"' : ''}>${sermon.revision}</a></li>`).join('')}</ul></nav>`;
}
export function studyArticle(
  release: PublicSermonCatalog,
  id: string,
  revision: string,
  base: string,
): string {
  const parents = release.published.filter(
    (item) => item.study.id === id && item.study.revision === revision,
  );
  const study = parents[0]?.study;
  if (!study) throw new Error('No published linked study.');
  return `<h1>${escapeHtml(study.title)}</h1><p class="status">دراسة موسّعة معتمدة</p>${metadata(study)}${study.sections.map((section, index) => `<section aria-labelledby="study-section-${index}"><h2 id="study-section-${index}">${escapeHtml(section.heading)}</h2>${blocks(section.blocks, study, 'study')}</section>`).join('')}${references(study, 'study')}<nav aria-label="الخطب المرتبطة"><h2>الخطب المرتبطة</h2><ul>${parents.map(({ sermon }) => `<li><a href="${base}${sermonPath(sermon.id, sermon.revision)}">${escapeHtml(sermon.title)} — ${sermon.revision}</a></li>`).join('')}</ul></nav>`;
}
