const mounted = new WeakMap<HTMLDialogElement, () => void>();
export function initMobileNavigation(root: ParentNode): () => void {
  const opener = root.querySelector<HTMLAnchorElement>('[data-more-open]');
  const dialog = root.querySelector<HTMLDialogElement>('#mobile-more');
  const close = dialog?.querySelector<HTMLButtonElement>('[data-more-close]');
  if (!opener || !dialog || !close || typeof dialog.showModal !== 'function')
    return () => {};
  const prior = mounted.get(dialog);
  if (prior) return prior;
  const open = (event: Event) => {
    event.preventDefault();
    if (!dialog.open) dialog.showModal();
    opener.setAttribute('aria-expanded', 'true');
    close.focus();
  };
  const dismiss = () => dialog.close();
  const restore = () => {
    opener.setAttribute('aria-expanded', 'false');
    opener.focus();
  };
  const backdrop = (event: MouseEvent) => {
    const box = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom)
    )
      dismiss();
  };
  const trapTab = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || !dialog.open) return;
    const items = [
      ...dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      ),
    ].filter((item) => !item.hidden);
    const first = items[0],
      last = items.at(-1);
    if (!first || !last) return;
    const active = dialog.ownerDocument.activeElement;
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };
  opener.addEventListener('click', open);
  close.addEventListener('click', dismiss);
  dialog.addEventListener('close', restore);
  dialog.addEventListener('click', backdrop);
  dialog.addEventListener('keydown', trapTab);
  const cleanup = () => {
    if (dialog.open) dialog.close();
    opener.removeEventListener('click', open);
    close.removeEventListener('click', dismiss);
    dialog.removeEventListener('close', restore);
    dialog.removeEventListener('click', backdrop);
    dialog.removeEventListener('keydown', trapTab);
    mounted.delete(dialog);
  };
  mounted.set(dialog, cleanup);
  return cleanup;
}
