// Server-only seeds from the already validated private release, never review files.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { sermonArticle, studyArticle } from '../src/lib/sermons/render.ts';
import { readerMarkup } from '../src/lib/sermons/reader-markup.ts';
import {
  sermonPath,
  studyPath,
  downloadPath,
} from '../src/lib/sermons/publication.ts';
const base = '/nur-und-huda/';
const parse = (html) => new JSDOM(`<body>${html}</body>`).window.document;
const slot = (key) => `<!--EDITOR_${key}-->`;
function templates(article, reader, study) {
  const doc = parse(article),
    imam = parse(reader),
    expanded = study ? parse(study) : null;
  const originals = {};
  for (const [index, key] of ['first', 'second'].entries()) {
    const section = doc.querySelectorAll('.khutbah-part')[index];
    originals[key] = [...section.children]
      .slice(1)
      .map((n) => n.outerHTML)
      .join('');
    section.innerHTML =
      section.firstElementChild.outerHTML + slot(key.toUpperCase());
    const readerPart = imam.querySelectorAll('.khutbah-part')[index];
    readerPart.innerHTML =
      readerPart.firstElementChild.outerHTML + slot(key.toUpperCase());
  }
  doc.querySelector('h1').innerHTML = slot('TITLE');
  doc.querySelector('.status')?.remove();
  doc.querySelector('.content-metadata').outerHTML = slot('METADATA');
  doc.querySelector('.revision-history')?.remove();
  const offline = doc.querySelector('a[download]');
  if (offline) {
    offline.textContent = 'حفظ الخطبة للقراءة دون اتصال';
    offline.removeAttribute('download');
    offline.setAttribute('download', 'sermon.html');
  }
  imam.querySelector('#reader-title').innerHTML =
    slot('TITLE') + ' — ' + slot('REVISION');
  originals.study = null;
  if (expanded) {
    const sections = [
      ...expanded.querySelectorAll(
        'section[aria-labelledby^="study-section-"]',
      ),
    ];
    originals.study = sections.map((n) => n.outerHTML).join('');
    sections[0].insertAdjacentHTML('beforebegin', slot('STUDY'));
    sections.forEach((n) => n.remove());
    expanded.querySelector('.status')?.remove();
    expanded.querySelector('.content-metadata').outerHTML = slot('METADATA');
  }
  return {
    originals,
    templates: {
      article: doc.body.innerHTML,
      reader: imam.body.innerHTML,
      study: expanded?.body.innerHTML ?? null,
    },
  };
}
export function buildEditorSeeds(release) {
  const seeds = [];
  for (const item of release.published) {
    const s = item.sermon,
      study = item.study;
    seeds.push({
      id: s.id,
      title: s.title,
      path: sermonPath(s.id, s.revision),
      studyPath: study ? studyPath(study.id, study.revision) : null,
      downloadPath: downloadPath(s.id, s.revision),
      originalRevision: s.revision,
      friday: s.friday,
      publishedAt: s.publishAt,
      content: {
        title: s.title,
        first: s.parts[0].map((b) => b.text).join('\n\n'),
        second: s.parts[1].map((b) => b.text).join('\n\n'),
        study: study
          ? study.sections
              .map(
                (section) =>
                  section.heading +
                  '\n\n' +
                  section.blocks.map((b) => b.text).join('\n\n'),
              )
              .join('\n\n')
          : null,
      },
      ...templates(
        sermonArticle(release, s.id, s.revision, base),
        readerMarkup(item),
        study ? studyArticle(release, study.id, study.revision, base) : null,
      ),
    });
  }
  // Dedicated technical acceptance record. Never listed as a real sermon.
  if (seeds.length) {
    const template = seeds[0];
    const content = {
      title: 'اختبار المحرر — ليس خطبة',
      first: 'نص تقني تجريبي أول. ليس مادة دينية.',
      second: 'نص تقني تجريبي ثانٍ.',
      study: 'شرح تقني للاختبار فقط.',
    };
    seeds.push({
      ...template,
      id: 'editor-check',
      title: content.title,
      path: 'editor-check.html',
      studyPath: 'editor-check-study.html',
      downloadPath: 'editor-check-download.html',
      originalRevision: 'test-0',
      publishedAt: '2026-11-13T00:00:00Z',
      content,
      testOnly: true,
      templates: {
        article: `<h1>${slot('TITLE')}</h1>${slot('METADATA')}<section class="khutbah-part"><h2>الخطبة الأولى</h2>${slot('FIRST')}</section><section class="khutbah-part"><h2>الخطبة الثانية</h2>${slot('SECOND')}</section><p class="study-link"><a href="${base}editor-check-study.html">اقرأ الموضوع كاملاً</a></p><a download href="${base}editor-check-download.html">حفظ نسخة</a>`,
        reader: template.templates.reader
          .replace(
            /<section class="sermon-introduction">[\s\S]*?<\/section>/,
            '',
          )
          .replace(
            /<section class="content-references"[\s\S]*?<\/section>/,
            '',
          ),
        study: `<h1>دراسة الاختبار</h1>${slot('METADATA')}${slot('STUDY')}<a href="${base}editor-check.html">العودة إلى الخطبة</a>`,
      },
      originals: {
        first: '<p class="content-block">' + content.first + '</p>',
        second: '<p class="content-block">' + content.second + '</p>',
        study: '<p class="content-block">' + content.study + '</p>',
      },
    });
  }
  return seeds;
}
export async function prepareSermonEditor(root, release) {
  const seeds = buildEditorSeeds(release);
  await writeFile(path.join(root, 'editor-seeds.json'), JSON.stringify(seeds), {
    mode: 0o600,
  });
  for (const seed of seeds.filter((s) => !s.testOnly)) {
    const file = path.join(root, 'site', seed.path);
    const html = await readFile(file, 'utf8');
    const button = `<p class="sermon-actions"><a class="button button-outline" data-sermon-edit href="${base}sermon-editor.html?id=${seed.id}">تعديل</a> <a class="button button-outline" href="${base}sermons.html#manage-${seed.id}">تغيير الموعد</a></p>`;
    await writeFile(
      file,
      html.replace('<div id="imam"', button + '<div id="imam"'),
    );
  }
}
