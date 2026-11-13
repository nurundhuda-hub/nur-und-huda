// Deliberate opt-in teleprompter. No words/minute estimates or content changes.
export const SCROLL_SPEEDS = [6, 10, 16, 24, 32] as const;
export const SCROLL_SPEED_KEY = 'nur-und-huda.imam-speed.v1';
export function readScrollSpeed(storage: Pick<Storage, 'getItem'>): number {
  try {
    const level = Number(storage.getItem(SCROLL_SPEED_KEY));
    if (Number.isInteger(level) && level >= 1 && level <= 5) return level;
  } catch {
    /* Device storage is optional. */
  }
  return 2;
}
export function mountAutoScroll(
  dialog: HTMLDialogElement,
  viewport: HTMLElement,
) {
  const doc = dialog.ownerDocument,
    win = doc.defaultView!;
  const parts = [...viewport.querySelectorAll<HTMLElement>('.khutbah-part')];
  const panel = dialog.querySelector<HTMLElement>('[data-auto-controls]');
  const toggle = dialog.querySelector<HTMLButtonElement>('[data-auto-toggle]');
  const speed = dialog.querySelector<HTMLInputElement>('[data-auto-speed]');
  const output = dialog.querySelector<HTMLOutputElement>(
    '[data-auto-speed-label]',
  );
  const reset = dialog.querySelector<HTMLButtonElement>('[data-auto-reset]');
  const next = dialog.querySelector<HTMLButtonElement>('[data-auto-part]');
  const status = dialog.querySelector<HTMLElement>('[data-auto-status]');
  const noop = { pause: () => {}, opened: () => {}, dispose: () => {} };
  if (
    !panel ||
    !toggle ||
    !speed ||
    !output ||
    !reset ||
    !next ||
    !status ||
    parts.length !== 2 ||
    typeof win.requestAnimationFrame !== 'function' ||
    typeof win.cancelAnimationFrame !== 'function'
  )
    return noop;
  let level = 2;
  try {
    level = readScrollSpeed(win.localStorage);
  } catch {
    /* Optional storage. */
  }
  let part = 0,
    running = false,
    frame: number | null = null,
    last: number | null = null,
    position = 0,
    expected = 0,
    disposed = false;
  const listeners: (() => void)[] = [];
  const on = (target: EventTarget, name: string, fn: EventListener) => {
    target.addEventListener(name, fn, { passive: true });
    listeners.push(() => target.removeEventListener(name, fn));
  };
  const limit = () => {
    const bottom = parts[part]!.getBoundingClientRect().bottom;
    const top = viewport.getBoundingClientRect().top + viewport.clientTop;
    const padding =
      parseFloat(win.getComputedStyle(viewport).paddingBottom) || 0;
    return Math.max(
      0,
      Math.min(
        viewport.scrollHeight - viewport.clientHeight,
        bottom - top + viewport.scrollTop - viewport.clientHeight + padding,
      ),
    );
  };
  const update = () => {
    toggle.textContent = running ? 'إيقاف مؤقت' : 'بدء';
    toggle.setAttribute('aria-pressed', String(running));
    reset.disabled = running;
    next.disabled = running;
    next.textContent =
      part === 0 ? 'الانتقال إلى الخطبة الثانية' : 'العودة إلى الخطبة الأولى';
    panel.dataset.running = String(running);
  };
  const pause = (message = 'متوقف مؤقتاً. اضغط بدء للمتابعة.') => {
    running = false;
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = null;
    last = null;
    update();
    status.textContent = message;
  };
  const ended = () =>
    pause(
      part === 0
        ? 'انتهت الخطبة الأولى. انتقل للثانية يدوياً.'
        : 'انتهت الخطبة الثانية.',
    );
  const move = (value: number) => {
    position = Math.max(0, Math.min(limit(), value));
    viewport.scrollTop = position;
    expected = viewport.scrollTop;
  };
  function tick(time: number) {
    frame = null;
    if (
      !running ||
      disposed ||
      !dialog.open ||
      doc.hidden ||
      !dialog.isConnected
    ) {
      pause();
      return;
    }
    const elapsed = last === null ? 0 : time - last;
    last = time;
    // Never catch up with a jump after a stalled frame/background suspension.
    if (elapsed < 0 || elapsed > 250) {
      pause('توقف التمرير مؤقتاً. اضغط بدء للمتابعة.');
      return;
    }
    move(position + (SCROLL_SPEEDS[level - 1]! * elapsed) / 1000);
    if (position >= limit() - 0.05) {
      ended();
      return;
    }
    frame = win.requestAnimationFrame(tick);
  }
  const applyPart = () => {
    dialog.dataset.autoPart = String(part);
    update();
  };
  const applySpeed = () => {
    speed.value = String(level);
    output.textContent = `${level} / 5 · ${SCROLL_SPEEDS[level - 1]} بكسل/ث`;
    speed.setAttribute(
      'aria-valuetext',
      `المستوى ${level} من 5، ${SCROLL_SPEEDS[level - 1]} بكسل في الثانية`,
    );
  };
  parts.forEach((p, i) => {
    p.dataset.imamPart = String(i);
  });
  panel.hidden = false;
  applyPart();
  applySpeed();
  update();
  status.textContent = 'الخطبة الأولى. اضغط بدء للتمرير.';
  on(toggle, 'click', () => {
    if (!dialog.open) return;
    if (running) {
      pause();
      return;
    }
    position = viewport.scrollTop;
    expected = position;
    if (position >= limit() - 0.05) {
      ended();
      return;
    }
    running = true;
    last = null;
    update();
    status.textContent =
      part === 0
        ? 'الخطبة الأولى — تمرير تلقائي.'
        : 'الخطبة الثانية — تمرير تلقائي.';
    frame = win.requestAnimationFrame(tick);
  });
  on(speed, 'input', () => {
    const selected = Number(speed.value);
    if (!Number.isInteger(selected) || selected < 1 || selected > 5) return;
    level = selected;
    applySpeed();
    try {
      win.localStorage.setItem(SCROLL_SPEED_KEY, String(level));
    } catch {
      /* Session-only preference. */
    }
  });
  on(reset, 'click', () => {
    if (running) return;
    pause('بداية الخطبة. اضغط بدء للتمرير.');
    move(0);
  });
  on(next, 'click', () => {
    if (running) return;
    part = part === 0 ? 1 : 0;
    applyPart();
    move(0);
    pause(
      part === 0
        ? 'الخطبة الأولى. اضغط بدء للتمرير.'
        : 'الخطبة الثانية. اضغط بدء للتمرير.',
    );
  });
  const manual = () => {
    if (running) pause('توقف التمرير أثناء القراءة اليدوية.');
  };
  for (const name of ['wheel', 'touchstart', 'pointerdown'])
    on(viewport, name, manual);
  on(viewport, 'keydown', (event) => {
    if (
      [
        'ArrowUp',
        'ArrowDown',
        'PageUp',
        'PageDown',
        'Home',
        'End',
        ' ',
      ].includes((event as KeyboardEvent).key)
    )
      manual();
  });
  on(viewport, 'scroll', () => {
    if (running && Math.abs(viewport.scrollTop - expected) > 1) manual();
  });
  on(doc, 'visibilitychange', () => {
    if (doc.hidden) pause();
  });
  on(win, 'pagehide', () => pause());
  on(win, 'resize', () => {
    if (running) pause();
  });
  on(win, 'beforeprint', () => pause());
  on(dialog, 'close', () => pause());
  const resize =
    typeof win.ResizeObserver === 'function'
      ? new win.ResizeObserver(() => {
          if (running) pause('تغير حجم القراءة. اضغط بدء للمتابعة.');
        })
      : null;
  resize?.observe(viewport);
  parts.forEach((p) => resize?.observe(p));
  return {
    pause: () => pause(),
    opened: () => {
      pause(
        part === 0
          ? 'الخطبة الأولى. اضغط بدء للتمرير.'
          : 'الخطبة الثانية. اضغط بدء للتمرير.',
      );
      move(viewport.scrollTop);
    },
    dispose: () => {
      pause();
      disposed = true;
      resize?.disconnect();
      listeners.forEach((remove) => remove());
      delete dialog.dataset.autoPart;
      parts.forEach((p) => {
        delete p.dataset.imamPart;
      });
      panel.hidden = true;
    },
  };
}
