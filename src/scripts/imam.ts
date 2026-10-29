export function initImamPreviews(root: ParentNode): void {
  root
    .querySelectorAll<HTMLElement>('[data-imam-preview]')
    .forEach((preview) => {
      if (preview.dataset.initialized) return;
      const open = preview.querySelector<HTMLButtonElement>('[data-imam-open]');
      const close =
        preview.querySelector<HTMLButtonElement>('[data-imam-close]');
      const dialog = preview.querySelector<HTMLDialogElement>('dialog');
      if (!open || !close || !dialog || typeof dialog.showModal !== 'function')
        return;

      open.addEventListener('click', () => {
        if (dialog.open) return;
        dialog.showModal();
        close.focus();
      });
      close.addEventListener('click', () => dialog.close());
      // Native <dialog> handles Escape and focus containment. Restore explicitly
      // for consistent behavior when closing by either keyboard or button.
      dialog.addEventListener('close', () => open.focus());
      open.hidden = false;
      preview.dataset.initialized = 'true';
    });
}
