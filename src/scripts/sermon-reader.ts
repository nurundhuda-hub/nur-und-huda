import {
  READER_PREFERENCES_KEY,
  defaultPreferences,
  readPreferences,
  preserveReadingPosition,
  type ReaderTheme,
} from './reader-preferences';

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
  const viewport = root.querySelector<HTMLElement>('[data-reader-viewport]');
  const theme = root.querySelector<HTMLSelectElement>(
    'select[data-reader-theme]',
  );
  const reset = root.querySelector<HTMLButtonElement>('[data-font-reset]');
  const fullscreen = root.querySelector<HTMLButtonElement>(
    '[data-reader-fullscreen]',
  );
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
  let preferences = defaultPreferences();
  try {
    preferences = readPreferences(win.localStorage);
  } catch {
    /* Private browsing can deny storage access. */
  }
  const save = () => {
    try {
      win.localStorage.setItem(
        READER_PREFERENCES_KEY,
        JSON.stringify(preferences),
      );
    } catch {
      /* Session-only fallback. */
    }
  };
  const systemTheme = win.matchMedia?.('(prefers-color-scheme: dark)');
  const applyTheme = () => {
    dialog.dataset.readerTheme =
      preferences.theme === 'system'
        ? systemTheme?.matches
          ? 'dark'
          : 'light'
        : preferences.theme;
    if (theme) theme.value = preferences.theme;
  };
  if (theme)
    on(theme, 'change', () => {
      if (!['system', 'light', 'dark'].includes(theme.value)) return;
      preferences.theme = theme.value as ReaderTheme;
      applyTheme();
      save();
    });
  if (systemTheme && typeof systemTheme.addEventListener === 'function')
    on(systemTheme, 'change', applyTheme);
  applyTheme();
  const setSize = (value: number, persist = true) => {
    const bounded = Math.max(
      18,
      Math.min(44, Number.isFinite(value) ? Math.round(value) : 32),
    );
    size.value = String(bounded);
    const change = () =>
      dialog.style.setProperty('--reader-font', `${bounded / 16}rem`);
    if (viewport && dialog.open) preserveReadingPosition(viewport, change);
    else change();
    label.textContent = `${bounded} px`;
    size.setAttribute(
      'aria-valuetext',
      `${bounded} بكسل بالحجم الأساسي، مع احترام تكبير الجهاز`,
    );
    preferences.fontSize = bounded;
    steps.forEach(
      (button) =>
        (button.disabled =
          Number(button.dataset.fontStep) < 0 ? bounded <= 18 : bounded >= 44),
    );
    if (persist) save();
  };
  on(size, 'input', () => setSize(Number(size.value)));
  steps.forEach((button) =>
    on(button, 'click', () =>
      setSize(Number(size.value) + Number(button.dataset.fontStep)),
    ),
  );
  if (reset) on(reset, 'click', () => setSize(32));
  setSize(preferences.fontSize, false);
  const exitFullscreen = async () => {
    if (
      doc.fullscreenElement === dialog &&
      typeof doc.exitFullscreen === 'function'
    )
      await doc.exitFullscreen().catch(() => {});
  };
  if (
    fullscreen &&
    typeof dialog.requestFullscreen === 'function' &&
    doc.fullscreenEnabled !== false
  ) {
    fullscreen.hidden = false;
    on(fullscreen, 'click', () => {
      if (!dialog.open) return;
      if (doc.fullscreenElement === dialog) {
        void exitFullscreen();
        return;
      }
      void dialog
        .requestFullscreen()
        .then(() => {
          if (disposed || !dialog.open) void exitFullscreen();
        })
        .catch(() => {
          if (!disposed)
            status.textContent = 'تعذّر ملء الشاشة؛ وضع القراءة متاح.';
        });
    });
    on(doc, 'fullscreenchange', () => {
      const active = doc.fullscreenElement === dialog;
      fullscreen.setAttribute('aria-pressed', String(active));
      fullscreen.textContent = active ? 'إنهاء ملء الشاشة' : 'ملء الشاشة';
    });
  }
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
      void exitFullscreen();
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
    void exitFullscreen();
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
