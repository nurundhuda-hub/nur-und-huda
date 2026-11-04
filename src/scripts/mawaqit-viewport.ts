/** Controls only our container; never accesses or changes MAWAQIT content. */
export function initMawaqitViewport(root: ParentNode): () => void {
  const cleanups: (() => void)[] = [];
  for (const card of root.querySelectorAll<HTMLElement>(
    '[data-mawaqit-card]',
  )) {
    const panel = card.querySelector<HTMLElement>('.mawaqit-scroll');
    const controls = card.querySelector<HTMLElement>('[data-mawaqit-controls]');
    const zoom = card.querySelector<HTMLButtonElement>('[data-mawaqit-zoom]');
    const pan = card.querySelector<HTMLElement>('[data-mawaqit-pan]');
    const right = card.querySelector<HTMLButtonElement>('[data-mawaqit-right]');
    const left = card.querySelector<HTMLButtonElement>('[data-mawaqit-left]');
    const hint = card.querySelector<HTMLElement>('.mawaqit-scroll-hint');
    const win = card.ownerDocument.defaultView;
    if (
      !panel ||
      !controls ||
      !zoom ||
      !pan ||
      !left ||
      !right ||
      !hint ||
      !win
    )
      continue;
    let enlarged = false;
    const update = () => {
      const overflow = panel.scrollWidth > panel.clientWidth + 1;
      controls.hidden = !enlarged && panel.clientWidth >= 640;
      pan.hidden = hint.hidden = !enlarged || !overflow;
      if (!hint.hidden) panel.setAttribute('aria-describedby', hint.id);
      else panel.removeAttribute('aria-describedby');
      left.disabled = panel.scrollLeft <= 1;
      right.disabled =
        panel.scrollLeft >= panel.scrollWidth - panel.clientWidth - 1;
    };
    const toggle = () => {
      enlarged = !enlarged;
      card.dataset.widgetZoomed = String(enlarged);
      zoom.setAttribute('aria-pressed', String(enlarged));
      zoom.textContent = enlarged ? 'عرض اللوحة كاملة' : 'تكبير اللوحة';
      // LTR scroll coordinates are consistent in WebKit; iframe retains its own RTL.
      panel.scrollLeft = enlarged ? panel.scrollWidth - panel.clientWidth : 0;
      update();
    };
    const moveLeft = () => {
      panel.scrollLeft -= panel.clientWidth * 0.8;
      update();
    };
    const moveRight = () => {
      panel.scrollLeft += panel.clientWidth * 0.8;
      update();
    };
    zoom.addEventListener('click', toggle);
    left.addEventListener('click', moveLeft);
    right.addEventListener('click', moveRight);
    panel.addEventListener('scroll', update);
    win.addEventListener('resize', update);
    const observer =
      typeof win.ResizeObserver === 'function'
        ? new win.ResizeObserver(update)
        : null;
    observer?.observe(panel);
    update();
    cleanups.push(() => {
      zoom.removeEventListener('click', toggle);
      left.removeEventListener('click', moveLeft);
      right.removeEventListener('click', moveRight);
      panel.removeEventListener('scroll', update);
      win.removeEventListener('resize', update);
      observer?.disconnect();
      controls.hidden = pan.hidden = hint.hidden = true;
      delete card.dataset.widgetZoomed;
      zoom.setAttribute('aria-pressed', 'false');
      zoom.textContent = 'تكبير اللوحة';
      panel.removeAttribute('aria-describedby');
    });
  }
  return () => cleanups.forEach((cleanup) => cleanup());
}
