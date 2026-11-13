import { mountSermonReader } from './sermon-reader';
interface Content {
  title: string;
  first: string;
  second: string;
  study: string | null;
}
interface Revision {
  number: number;
  publishedAt: string;
  content: Content;
  sha256: string;
}
interface State {
  version: number;
  originalRevision: string;
  published: Revision;
  previous: Revision | null;
  draft: { content: Content; savedAt: string } | null;
  path: string;
  testOnly: boolean;
}
export function initSermonEditor(doc: Document) {
  const root = doc.querySelector<HTMLElement>('[data-sermon-editor]');
  if (!root) return;
  const win = doc.defaultView!;
  const find = <T extends Element = HTMLElement>(selector: string) =>
    doc.querySelector<T>(selector)!;
  const status = find('[data-editor-status]');
  const form = find<HTMLFormElement>('[data-editor-form]');
  const field = (key: string) =>
    form.elements.namedItem(key) as HTMLInputElement | HTMLTextAreaElement;
  const id = new URL(win.location.href).searchParams.get('id');
  if (!id || !/^[a-z0-9-]{1,80}$/.test(id)) {
    status.textContent = 'افتح «تعديل» من صفحة الخطبة التي تريد تعديلها.';
    return;
  }
  const url = '/nur-und-huda/api/sermons/' + id;
  let state: State,
    dirty = false,
    busy = false,
    conflict = false;
  let retry: { action: string; serialized: string; body: unknown } | null =
    null;
  let disposeReader: (() => void) | undefined;
  const content = (): Content => ({
    title: field('title').value,
    first: field('first').value,
    second: field('second').value,
    study: state.published.content.study === null ? null : field('study').value,
  });
  const say = (text: string) => {
    status.textContent = text;
  };
  function controls() {
    root!.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      b.disabled = busy || (conflict && !b.hasAttribute('data-editor-reload'));
    });
    root!.setAttribute('aria-busy', String(busy));
    form
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input,textarea',
      )
      .forEach((f) => {
        f.readOnly = busy;
      });
  }
  async function request(action = '', body?: unknown) {
    const response = await win.fetch(url + (action ? '/' + action : ''), {
      method: body ? 'POST' : 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      ...(body
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        : {}),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        response.status === 401
          ? 'SESSION'
          : response.status === 409
            ? (error.error?.code ?? 'EDITOR_CONFLICT')
            : response.status === 429
              ? 'RATE'
              : response.status === 400 || response.status === 413
                ? 'SIZE'
                : 'NETWORK',
      );
    }
    return response.json();
  }
  const dateLabel = (value: string) =>
    new Intl.DateTimeFormat('ar', {
      timeZone: 'Europe/Berlin',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value)) + ' بتوقيت برلين';
  function show(next: State) {
    state = next;
    const c = state.draft?.content ?? state.published.content;
    for (const key of ['title', 'first', 'second', 'study'] as const)
      field(key).value = c[key] ?? '';
    find('[data-editor-study]').hidden = c.study === null;
    field('study').required = c.study !== null;
    find('[data-editor-revision]').textContent =
      `${state.testOnly ? 'محتوى اختبار تقني — ليس خطبة. ' : ''}النسخة المنشورة: ${state.published.number ? 'تعديل ' + state.published.number : 'الأصل ' + state.originalRevision} · ${dateLabel(state.published.publishedAt)}${state.draft ? ' · مسودة محفوظة: ' + dateLabel(state.draft.savedAt) : ''}`;
    const link = find<HTMLAnchorElement>('[data-editor-read]');
    link.href = '/nur-und-huda/' + state.path;
    link.hidden = false;
    find('[data-editor-history]').hidden = !state.previous;
    if (state.previous)
      find('[data-editor-previous]').textContent =
        `${state.previous.number ? 'تعديل ' + state.previous.number : 'الأصل ' + state.originalRevision} · ${dateLabel(state.previous.publishedAt)}`;
    form.hidden = false;
    dirty = false;
    conflict = false;
    find('[data-editor-conflict]').hidden = true;
    controls();
  }
  function failure(error: unknown) {
    const code = error instanceof Error ? error.message : 'NETWORK';
    if (code === 'EDITOR_CONFLICT') {
      conflict = true;
      find('[data-editor-conflict]').hidden = false;
    }
    const messages: Record<string, string> = {
      SESSION: 'انتهت جلسة الدخول. احتفظ بنصك ثم سجّل الدخول مجدداً.',
      EDITOR_CONFLICT: 'توجد نسخة أحدث؛ لم تُستبدل تغييرات زميلك.',
      EDITOR_NO_CHANGE: 'لا توجد تغييرات جديدة للنشر.',
      EDITOR_NO_PREVIOUS: 'لا توجد نسخة سابقة للاستعادة.',
      RATE: 'عمليات كثيرة. انتظر قليلاً ثم حاول مجدداً.',
      SIZE: 'تحقق من الحقول المطلوبة وحدود طول النص.',
      NETWORK:
        'تعذر إتمام الطلب. النص باقٍ في المحرر؛ أعد المحاولة. قد يكون الطلب السابق قد وصل إلى الخادم.',
    };
    say(messages[code] ?? messages.NETWORK!);
  }
  async function load() {
    busy = true;
    controls();
    try {
      show(await request());
      say(
        state.draft
          ? 'تم فتح المسودة المحفوظة؛ لم تُنشر بعد.'
          : 'تم فتح النسخة المنشورة للتعديل.',
      );
    } catch (e) {
      failure(e);
    } finally {
      busy = false;
      controls();
    }
  }
  form.addEventListener('input', () => {
    dirty = true;
  });
  win.addEventListener('beforeunload', (event) => {
    if (dirty) {
      event.preventDefault();
    }
  });
  const dialog = find<HTMLDialogElement>('[data-editor-confirm]');
  function confirm(text: string): Promise<boolean> {
    find('[data-editor-confirm-text]').textContent = text;
    dialog.returnValue = '';
    dialog.showModal();
    return new Promise((resolve) =>
      dialog.addEventListener(
        'close',
        () => resolve(dialog.returnValue === 'yes'),
        { once: true },
      ),
    );
  }
  find('[data-editor-confirm-ok]').addEventListener('click', () =>
    dialog.close('yes'),
  );
  find('[data-editor-confirm-cancel]').addEventListener('click', () =>
    dialog.close('no'),
  );
  async function mutate(action: 'draft' | 'publish' | 'restore') {
    if (
      busy ||
      conflict ||
      !state ||
      (action !== 'restore' && !form.reportValidity())
    )
      return;
    if (
      action !== 'draft' &&
      !(await confirm(
        action === 'restore'
          ? 'استعادة النسخة السابقة ونشرها الآن؟ سيُستبدل النص المنشور وتُحفظ مراجعته الحالية. تُزال المسودة المحفوظة.'
          : 'هل راجعت النص وتريد نشر التعديلات الآن لجميع أعضاء المجموعة؟',
      ))
    )
      return;
    const data = {
      version: state.version,
      ...(action !== 'restore' ? { content: content() } : {}),
    };
    const serialized = JSON.stringify(data);
    if (!retry || retry.action !== action || retry.serialized !== serialized)
      retry = {
        action,
        serialized,
        body: { ...data, operationId: win.crypto.randomUUID() },
      };
    busy = true;
    controls();
    try {
      await request(action, retry.body);
      const next = await request();
      show(next);
      retry = null;
      say(
        action === 'draft'
          ? 'حُفظت المسودة. النص المنشور لم يتغير.'
          : action === 'restore'
            ? 'استُعيدت النسخة السابقة في مراجعة جديدة.'
            : 'نُشرت التعديلات. يمكن للزملاء قراءتها الآن.',
      );
    } catch (e) {
      failure(e);
    } finally {
      busy = false;
      controls();
    }
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void mutate('draft');
  });
  find('[data-editor-publish]').addEventListener(
    'click',
    () => void mutate('publish'),
  );
  find('[data-editor-restore]').addEventListener(
    'click',
    () => void mutate('restore'),
  );
  find('[data-editor-reload]').addEventListener('click', async () => {
    if (
      await confirm(
        'فتح النسخة الأحدث سيستبدل النص في هذه الحقول. انسخ تعديلاتك أولاً إذا أردت الاحتفاظ بها.',
      )
    )
      void load();
  });
  const panel = find<HTMLElement>('[data-editor-preview-panel]');
  find('[data-editor-preview]').addEventListener('click', async () => {
    if (busy || !form.reportValidity()) return;
    busy = true;
    controls();
    try {
      const preview = await request('preview', { content: content() });
      disposeReader?.();
      // The server renders through fixed templates and escapes all editable text.
      find('[data-editor-preview-article]').innerHTML = preview.article;
      find('[data-editor-preview-article]')
        .querySelectorAll('.sermon-actions, .study-link')
        .forEach((n) => n.remove());
      find('[data-editor-preview-reader]').innerHTML = preview.reader;
      const study = find('[data-editor-preview-study]');
      study.innerHTML = preview.study ?? '';
      study.hidden = !preview.study;
      panel.hidden = false;
      disposeReader = mountSermonReader(
        panel.querySelector<HTMLElement>('[data-sermon-reader]')!,
      );
      panel.focus();
      panel.scrollIntoView({ block: 'start' });
      say('هذه معاينة فقط. لم يتغير النص المنشور.');
    } catch (e) {
      failure(e);
    } finally {
      busy = false;
      controls();
    }
  });
  find('[data-editor-preview-close]').addEventListener('click', () => {
    disposeReader?.();
    panel.hidden = true;
    field('title').focus();
  });
  void load();
}
