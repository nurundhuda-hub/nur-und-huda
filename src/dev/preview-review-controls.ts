/** Session-only review aid. No storage, fetch, approval mutation or credentials. */
export function initPreviewReview(doc: Document): () => void {
  const root = doc.querySelector<HTMLElement>('[data-preview-approval]');
  const button = root?.querySelector<HTMLButtonElement>(
    '[data-preview-approve]',
  );
  const command = root?.querySelector<HTMLElement>('#approval-command');
  const progress = root?.querySelector<HTMLElement>('[data-review-progress]');
  if (!root || !button || !command || !progress) return () => {};
  const checks = [
    ...root.querySelectorAll<HTMLInputElement>('[data-review-check]'),
  ];
  // Read-only server snapshot, not authorization. This can enable only command help.
  const eligible = root.dataset.reviewEligible === 'true';
  const update = () => {
    const count = checks.filter((check) => check.checked).length;
    button.disabled =
      !eligible || checks.length === 0 || count !== checks.length;
    progress.textContent = `راجعت ${count} من ${checks.length} بنود في هذه الجلسة. هذه العلامات لا تعتمد الخطبة ولا تغيّر سجل الأدلة.`;
    if (button.disabled) {
      command.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }
  };
  const show = () => {
    if (button.disabled) return;
    command.hidden = !command.hidden;
    button.setAttribute('aria-expanded', String(!command.hidden));
  };
  // Do not restore browser form history as a new human attestation.
  const reset = () => {
    checks.forEach((check) => {
      check.checked = false;
    });
    update();
  };
  reset();
  checks.forEach((check) => check.addEventListener('change', update));
  button.addEventListener('click', show);
  doc.defaultView?.addEventListener('pageshow', reset);
  return () => {
    checks.forEach((check) => check.removeEventListener('change', update));
    button.removeEventListener('click', show);
    doc.defaultView?.removeEventListener('pageshow', reset);
  };
}
