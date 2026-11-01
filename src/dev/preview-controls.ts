import { initSermonReaders } from '../scripts/sermon-reader';
import { preserveReadingPosition } from '../scripts/reader-preferences';
import { initPreviewReview } from './preview-review-controls';

/** Visible page controls delegate to the same reader, keeping one preference model. */
export function initPreviewControls(doc: Document): () => void {
  const cleanupReader = initSermonReaders(doc);
  const cleanupReview = initPreviewReview(doc);
  const cleanupBase = () => {
    cleanupReader();
    cleanupReview();
  };
  const toolbar = doc.querySelector<HTMLElement>('[data-preview-toolbar]');
  const article = doc.querySelector<HTMLElement>('[data-preview-article]');
  const dialog = doc.querySelector<HTMLDialogElement>('.sermon-reader');
  const theme = toolbar?.querySelector<HTMLSelectElement>(
    '[data-preview-theme]',
  );
  const readerTheme = dialog?.querySelector<HTMLSelectElement>(
    'select[data-reader-theme]',
  );
  const label = toolbar?.querySelector<HTMLOutputElement>(
    '[data-preview-size]',
  );
  const win = doc.defaultView;
  if (
    !toolbar ||
    !article ||
    !dialog ||
    !theme ||
    !readerTheme ||
    !label ||
    !win
  )
    return cleanupBase;
  const listeners: (() => void)[] = [];
  const on = (target: EventTarget, event: string, fn: EventListener) => {
    target.addEventListener(event, fn);
    listeners.push(() => target.removeEventListener(event, fn));
  };
  const steps = [
    ...toolbar.querySelectorAll<HTMLButtonElement>('[data-preview-step]'),
  ];
  const reset = toolbar.querySelector<HTMLButtonElement>(
    '[data-preview-reset]',
  )!;
  const sync = () => {
    const change = () =>
      article.style.setProperty(
        '--reader-font',
        dialog.style.getPropertyValue('--reader-font'),
      );
    preserveReadingPosition(article, change, {
      scrollElement: doc.scrollingElement ?? doc.documentElement,
      top: toolbar.getBoundingClientRect().bottom,
    });
    for (const target of [article, toolbar])
      target.dataset.previewTheme = dialog.dataset.readerTheme;
    theme.value = readerTheme.value;
    label.textContent = dialog.querySelector(
      '[data-reader-size-label]',
    )!.textContent;
    steps.forEach((button) => {
      button.disabled = dialog.querySelector<HTMLButtonElement>(
        `[data-font-step="${button.dataset.previewStep}"]`,
      )!.disabled;
    });
  };
  steps.forEach((button) =>
    on(button, 'click', () => {
      dialog
        .querySelector<HTMLButtonElement>(
          `[data-font-step="${button.dataset.previewStep}"]`,
        )!
        .click();
      sync();
    }),
  );
  on(reset, 'click', () => {
    dialog.querySelector<HTMLButtonElement>('[data-font-reset]')!.click();
    sync();
  });
  on(theme, 'change', () => {
    readerTheme.value = theme.value;
    readerTheme.dispatchEvent(new win.Event('change', { bubbles: true }));
    sync();
  });
  // Sync controls after changes made inside imam mode, including system theme changes.
  const observer = new win.MutationObserver(sync);
  observer.observe(dialog, {
    attributes: true,
    attributeFilter: ['style', 'data-reader-theme'],
  });
  const setToolbarHeight = () =>
    doc.documentElement.style.setProperty(
      '--preview-toolbar-height',
      `${toolbar.getBoundingClientRect().height + 16}px`,
    );
  const resize =
    typeof win.ResizeObserver === 'function'
      ? new win.ResizeObserver(setToolbarHeight)
      : undefined;
  resize?.observe(toolbar);
  on(win, 'resize', setToolbarHeight);
  sync();
  reset.disabled = false;
  theme.disabled = false;
  toolbar.dataset.initialized = 'true';
  toolbar.querySelector('[data-preview-init]')!.textContent =
    'أدوات القراءة جاهزة — تُحفظ تفضيلاتك على هذا الجهاز فقط.';
  setToolbarHeight();
  return () => {
    observer.disconnect();
    resize?.disconnect();
    listeners.forEach((remove) => remove());
    cleanupBase();
  };
}
