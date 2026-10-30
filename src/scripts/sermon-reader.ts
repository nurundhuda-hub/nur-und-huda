interface WakeHandle extends EventTarget {
  release(): Promise<void>;
}
export interface ReaderOptions {
  requestWakeLock?: () => Promise<WakeHandle>;
  print?: () => void;
}
const mounted = new WeakMap<HTMLElement, () => void>();
export function mountSermonReader(
  root: HTMLElement,
  options: ReaderOptions = {},
): () => void {
  const prior = mounted.get(root);
  if (prior) return prior;
  const doc = root.ownerDocument,
    win = doc.defaultView;
  const dialog = root.querySelector<HTMLDialogElement>('dialog');
  const open = root.querySelector<HTMLButtonElement>('[data-reader-open]');
  const close = root.querySelector<HTMLButtonElement>('[data-reader-close]');
  const size = root.querySelector<HTMLInputElement>('[data-reader-size]');
  const label = root.querySelector<HTMLOutputElement>(
    '[data-reader-size-label]',
  );
  const wake = root.querySelector<HTMLButtonElement>('[data-reader-wake]');
  const status = root.querySelector<HTMLElement>('[data-wake-status]');
  if (!win || !dialog || !open || !close || !size || !label || !wake || !status)
    return () => {};
  const listeners: (() => void)[] = [];
  const on = (target: EventTarget, event: string, handler: EventListener) => {
    target.addEventListener(event, handler);
    listeners.push(() => target.removeEventListener(event, handler));
  };
  let disposed = false,
    wanted = false,
    pending = false,
    hiddenPage = false,
    generation = 0,
    handle: WakeHandle | null = null;
  const request =
    options.requestWakeLock ??
    (win.isSecureContext && win.navigator.wakeLock
      ? () => win.navigator.wakeLock.request('screen')
      : undefined);
  const updateButton = () => {
    wake.setAttribute('aria-pressed', String(wanted));
    wake.textContent = wanted
      ? 'إيقاف إبقاء الشاشة مضاءة'
      : 'إبقاء الشاشة مضاءة';
  };
  const release = () => {
    generation++;
    const previous = handle;
    handle = null;
    if (previous) void previous.release().catch(() => {});
  };
  const acquire = async () => {
    if (
      !request ||
      !wanted ||
      pending ||
      handle ||
      disposed ||
      doc.hidden ||
      hiddenPage ||
      !dialog.open ||
      !root.isConnected
    )
      return;
    pending = true;
    const ticket = generation;
    try {
      const lock = await request();
      if (
        ticket !== generation ||
        !wanted ||
        disposed ||
        !dialog.open ||
        doc.hidden ||
        hiddenPage ||
        !root.isConnected
      ) {
        await lock.release().catch(() => {});
        return;
      }
      handle = lock;
      status.textContent = 'الشاشة مضاءة أثناء القراءة.';
      lock.addEventListener(
        'release',
        () => {
          if (handle !== lock) return;
          handle = null;
          if (!doc.hidden && !hiddenPage) {
            wanted = false;
            updateButton();
          }
          status.textContent = 'انتهى إبقاء الشاشة مضاءة؛ يمكن إعادة المحاولة.';
        },
        { once: true },
      );
    } catch {
      if (ticket === generation && !disposed) {
        wanted = false;
        updateButton();
        status.textContent =
          'تعذّر إبقاء الشاشة مضاءة. القراءة والطباعة متاحتان.';
      }
    } finally {
      pending = false;
      if (ticket !== generation && wanted && !disposed) void acquire();
    }
  };
  const steps = [
    ...root.querySelectorAll<HTMLButtonElement>('[data-font-step]'),
  ];
  const setSize = (value: number) => {
    const bounded = Math.max(
      1.5,
      Math.min(3, Number.isFinite(value) ? value : 2),
    );
    size.value = String(bounded);
    dialog.style.setProperty('--reader-font', `${bounded}rem`);
    label.textContent = `${Math.round((bounded / 2) * 100)}٪`;
    steps.forEach(
      (button) =>
        (button.disabled =
          Number(button.dataset.fontStep) < 0 ? bounded <= 1.5 : bounded >= 3),
    );
  };
  on(size, 'input', () => setSize(Number(size.value)));
  steps.forEach((button) =>
    on(button, 'click', () =>
      setSize(Number(size.value) + Number(button.dataset.fontStep)),
    ),
  );
  setSize(2);
  root
    .querySelectorAll<HTMLButtonElement>('[data-sermon-print]')
    .forEach((button) => {
      if (typeof win.print === 'function' || options.print) {
        button.hidden = false;
        on(button, 'click', () => {
          (options.print ?? (() => win.print()))();
        });
      }
    });
  if (typeof dialog.showModal === 'function') {
    open.hidden = false;
    on(open, 'click', () => {
      if (!dialog.open) {
        dialog.showModal();
        close.focus();
      }
    });
    on(close, 'click', () => dialog.close());
    on(dialog, 'close', () => {
      wanted = false;
      release();
      updateButton();
      status.textContent = '';
      open.focus();
    });
  }
  wake.disabled = !request;
  if (!request)
    status.textContent =
      'إبقاء الشاشة مضاءة غير مدعوم هنا. القراءة والطباعة متاحتان.';
  on(wake, 'click', () => {
    if (!dialog.open || !request) return;
    wanted = !wanted;
    updateButton();
    if (wanted) void acquire();
    else {
      release();
      status.textContent = 'تم إيقاف إبقاء الشاشة مضاءة.';
    }
  });
  on(doc, 'visibilitychange', () => {
    if (doc.hidden) {
      release();
      if (wanted) status.textContent = 'إبقاء الشاشة مضاءة متوقف مؤقتاً.';
    } else void acquire();
  });
  on(win, 'pagehide', () => {
    hiddenPage = true;
    release();
  });
  on(win, 'pageshow', () => {
    hiddenPage = false;
    void acquire();
  });
  const cleanup = () => {
    disposed = true;
    wanted = false;
    release();
    listeners.forEach((remove) => remove());
    if (dialog.open) dialog.close();
    open.hidden = true;
    mounted.delete(root);
  };
  mounted.set(root, cleanup);
  return cleanup;
}
export function initSermonReaders(root: ParentNode): () => void {
  const cleanups = [
    ...root.querySelectorAll<HTMLElement>('[data-sermon-reader]'),
  ].map((node) => mountSermonReader(node));
  return () => cleanups.forEach((cleanup) => cleanup());
}
