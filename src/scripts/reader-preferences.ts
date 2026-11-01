export const READER_PREFERENCES_KEY = 'nur-und-huda.reader.v1';
export type ReaderTheme = 'system' | 'light' | 'dark';
export interface ReaderPreferences {
  version: 1;
  fontSize: number;
  theme: ReaderTheme;
}
export const defaultPreferences = (): ReaderPreferences => ({
  version: 1,
  fontSize: 32,
  theme: 'system',
});
export function readPreferences(
  storage: Pick<Storage, 'getItem'>,
): ReaderPreferences {
  try {
    const value = JSON.parse(storage.getItem(READER_PREFERENCES_KEY) ?? 'null');
    if (
      value?.version === 1 &&
      Number.isInteger(value.fontSize) &&
      value.fontSize >= 18 &&
      value.fontSize <= 44 &&
      ['system', 'light', 'dark'].includes(value.theme)
    )
      return { version: 1, fontSize: value.fontSize, theme: value.theme };
  } catch {
    /* Reading remains available when device storage is restricted. */
  }
  return defaultPreferences();
}

/** Preserve the text nearest the top of the reading viewport across reflow. */
export function preserveReadingPosition(
  viewport: HTMLElement,
  change: () => void,
  page?: { scrollElement: Element; top: number },
): void {
  const doc = viewport.ownerDocument;
  const rect = viewport.getBoundingClientRect();
  const bounds = {
    left: rect.left,
    right: rect.right,
    top: page ? Math.max(rect.top, page.top) : rect.top,
  };
  const scroller = page?.scrollElement ?? viewport;
  const rangeDoc = doc as unknown as {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let range: Range | null = null;
  try {
    const textBounds =
      viewport.querySelector('.reader-text')?.getBoundingClientRect() ?? bounds;
    const x = Math.max(
        bounds.left + 8,
        Math.min(bounds.right - 24, textBounds.right - 8),
      ),
      y = bounds.top + 12;
    const caret = rangeDoc.caretPositionFromPoint?.(x, y);
    range = caret
      ? doc.createRange()
      : (rangeDoc.caretRangeFromPoint?.(x, y) ?? null);
    if (caret && range) range.setStart(caret.offsetNode, caret.offset);
    if (
      range &&
      viewport.contains(range.startContainer) &&
      range.startContainer.nodeType === 3
    ) {
      const node = range.startContainer,
        offset = Math.min(
          range.startOffset,
          Math.max(0, node.textContent!.length - 1),
        );
      range.setStart(node, offset);
      range.setEnd(node, offset + 1);
    } else range = null;
  } catch {
    range = null;
  }
  const block = [
    ...viewport.querySelectorAll<HTMLElement>('.content-block, h1, h2, h3'),
  ].find((node) => node.getBoundingClientRect().bottom > bounds.top + 4);
  const blockBounds = block?.getBoundingClientRect();
  const blockFraction = blockBounds?.height
    ? Math.max(
        0,
        Math.min(1, (bounds.top + 12 - blockBounds.top) / blockBounds.height),
      )
    : 0;
  const top = () => {
    if (range) return range.getBoundingClientRect().top;
    const rect = block?.getBoundingClientRect();
    return rect ? rect.top + blockFraction * rect.height : undefined;
  };
  const before = top();
  const oldRange = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  const ratio = oldRange ? scroller.scrollTop / oldRange : 0;
  change();
  const after = top();
  if (before !== undefined && after !== undefined)
    scroller.scrollTop += after - before;
  else
    scroller.scrollTop =
      ratio * Math.max(0, scroller.scrollHeight - scroller.clientHeight);
}
