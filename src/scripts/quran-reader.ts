import { quranReader, quranReaderUrl } from '../lib/quran-reader';

/** Navigate the verified external reader only. No frame DOM, text, cookies or API
 * is read by our application. A new frame makes its supported initial fragment
 * work even when the provider has no handler for same-document hash navigation. */
export function initQuranReader(root: HTMLElement): () => void {
  let frame = root.querySelector<HTMLIFrameElement>('[data-quran-frame]');
  const direct = root.querySelector<HTMLAnchorElement>('[data-quran-direct]');
  const select = root.querySelector<HTMLSelectElement>('[data-quran-surah]');
  const view = root.ownerDocument.defaultView;
  if (!frame || !direct || !select || !view?.matchMedia) return () => {};
  const media = view.matchMedia(quranReader.desktopQuery);
  const update = () => {
    const surah = Number(select.value);
    if (!Number.isInteger(surah) || surah < 1 || surah > 114) return;
    const url = quranReaderUrl(media.matches, surah);
    if (frame!.getAttribute('src') !== url) {
      const next = frame!.cloneNode(false) as HTMLIFrameElement;
      next.src = url;
      frame!.replaceWith(next);
      frame = next;
    }
    direct.href = url;
  };
  select.disabled = false;
  update();
  select.addEventListener('change', update);
  media.addEventListener('change', update);
  return () => {
    select.removeEventListener('change', update);
    media.removeEventListener('change', update);
  };
}
