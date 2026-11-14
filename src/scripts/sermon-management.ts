interface Assignment {
  sermonId: string;
  status: string;
  updatedAt: string;
}
interface View {
  version: number;
  sermons: {
    id: string;
    title: string;
    published: boolean;
    path: string | null;
  }[];
  assignments: Record<string, Assignment>;
  html: string;
  canUndo: boolean;
}
export function initSermonManagement(doc: Document) {
  const root = doc.querySelector<HTMLElement>('[data-sermon-management]');
  if (!root) return;
  const win = doc.defaultView!,
    find = <T extends HTMLElement = HTMLElement>(s: string) =>
      root.querySelector<T>(s)!;
  const status = find('[data-management-status]'),
    dialog = find<HTMLDialogElement>('[data-schedule-dialog]'),
    form = find<HTMLFormElement>('[data-schedule-form]');
  const choice = find<HTMLSelectElement>('#schedule-sermon'),
    date = find<HTMLInputElement>('#schedule-friday');
  let view: View,
    from = '',
    busy = false,
    retry: { key: string; body: unknown } | null = null;
  async function request(action = '', body?: unknown) {
    const response = await win.fetch(
      '/nur-und-huda/api/sermons/manage' + (action ? '/' + action : ''),
      {
        method: body ? 'POST' : 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        ...(body
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }
          : {}),
      },
    );
    const data = await response.json();
    if (!response.ok) throw Error(data.error?.code ?? 'NETWORK');
    return data;
  }
  const errors: Record<string, string> = {
    SCHEDULE_CONFLICT:
      'هذه الجمعة محجوزة لخطبة. اختر موعداً آخر، أو أزل الموعد الموجود صراحةً أولاً.',
    SCHEDULE_CHANGED:
      'تغير الجدول لدى زميلك. أعد فتح الموعد بعد مراجعة الجدول الأحدث.',
    FRIDAY_REQUIRED: 'اختر تاريخ يوم جمعة صحيحاً.',
    DELIVERY_IN_FUTURE: 'لا يمكن تأكيد إلقاء خطبة قبل يومها.',
    GROUP_ACCESS_REQUIRED: 'انتهت جلسة الدخول. سجّل الدخول مجدداً.',
    EDITOR_RATE_LIMIT: 'عمليات كثيرة؛ انتظر قليلاً ثم حاول مجدداً.',
  };
  function error(e: unknown) {
    const message =
      errors[e instanceof Error ? e.message : ''] ??
      'تعذر حفظ التغيير. أعد المحاولة؛ لا تفترض أن الطلب لم يصل.';
    status.textContent = message;
    find('[data-schedule-error]').textContent = message;
  }
  async function load() {
    view = await request();
    root!.dataset.managementReady = 'true';
    find('[data-management-content]').innerHTML = view.html;
    find('[data-schedule-undo]').hidden = !view.canUndo;
  }
  const confirmation = find<HTMLDialogElement>('[data-management-confirm]');
  function confirm(message: string) {
    find('[data-management-confirm-text]').textContent = message;
    confirmation.returnValue = '';
    confirmation.showModal();
    return new Promise<boolean>((resolve) =>
      confirmation.addEventListener(
        'close',
        () => resolve(confirmation.returnValue === 'yes'),
        { once: true },
      ),
    );
  }
  find('[data-management-yes]').onclick = () => confirmation.close('yes');
  find('[data-management-no]').onclick = () => confirmation.close('no');
  function open(id = '', day = '') {
    if (!view || busy) return;
    from = day;
    choice.replaceChildren();
    for (const s of view.sermons.filter((s) =>
      id ? s.id === id : s.published,
    )) {
      const option = doc.createElement('option');
      option.value = s.id;
      option.textContent = s.title + (s.published ? '' : ' — مسودة');
      choice.append(option);
    }
    if (!choice.options.length) {
      status.textContent = 'لا توجد خطب منشورة للاختيار. أنشئ خطبة جديدة.';
      return;
    }
    if (id) choice.value = id;
    date.value = day;
    choice.disabled = !!id;
    find('[data-schedule-current]').textContent = day
      ? 'الموعد الحالي: ' +
        day +
        ' · نقل الخطبة يحتفظ بالموعد السابق بوصفه لم يُلقَ / مؤجلاً.'
      : '';
    find('[data-schedule-remove]').hidden = !day;
    find('[data-schedule-error]').textContent = '';
    dialog.showModal();
    date.focus();
  }
  async function mutate(action: string, fields: Record<string, unknown>) {
    if (busy) return;
    busy = true;
    root!.setAttribute('aria-busy', 'true');
    root!
      .querySelectorAll<HTMLButtonElement>('button')
      .forEach((b) => (b.disabled = true));
    const data = { version: view.version, ...fields },
      key = JSON.stringify({ action, ...data });
    if (retry?.key !== key)
      retry = { key, body: { ...data, operationId: win.crypto.randomUUID() } };
    try {
      await request(action, retry.body);
      retry = null;
      await load();
      dialog.close();
      status.textContent =
        'تم حفظ التغيير. لم يتغير نص الخطبة أو إصدارها المنشور.';
    } catch (e) {
      error(e);
      if (e instanceof Error && e.message === 'SCHEDULE_CHANGED') {
        await load().catch(() => {});
      }
    } finally {
      busy = false;
      root!.setAttribute('aria-busy', 'false');
      root!
        .querySelectorAll<HTMLButtonElement>('button')
        .forEach((b) => (b.disabled = false));
    }
  }
  find('[data-schedule-reuse]').onclick = () => open();
  find('[data-schedule-close]').onclick = () => dialog.close();
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (!form.reportValidity() || busy) return;
    const target = date.value;
    if (from === target) {
      find('[data-schedule-error]').textContent = 'اختر موعداً مختلفاً للنقل.';
      return;
    }
    if (view.assignments[target]) {
      error(Error('SCHEDULE_CONFLICT'));
      return;
    }
    if (
      await confirm(
        from
          ? 'نقل هذه الخطبة وحفظ الموعد السابق بوصفه لم يُلقَ / مؤجلاً؟'
          : 'تعيين هذه الخطبة لهذا الموعد؟ النشر والإلقاء خطوتان منفصلتان.',
      )
    )
      void mutate(from ? 'move' : 'assign', {
        sermonId: choice.value,
        date: target,
        ...(from ? { fromDate: from } : {}),
      });
  };
  find('[data-schedule-remove]').onclick = async () => {
    if (
      await confirm(
        'إزالة هذا الموعد من الجدول؟ تبقى الخطبة وتاريخ التغيير محفوظين.',
      )
    )
      void mutate('remove', { sermonId: choice.value, date: from });
  };
  find('[data-schedule-undo]').onclick = async () => {
    if (
      await confirm(
        'استعادة المواعيد التي كانت موجودة قبل آخر تغيير؟ لا يتغير نص أي خطبة.',
      )
    )
      void mutate('undo', {});
  };
  root.addEventListener('click', async (event) => {
    const target = (event.target as Element).closest<HTMLButtonElement>(
      'button',
    );
    if (!target || busy) return;
    if (target.dataset.scheduleId)
      open(target.dataset.scheduleId, target.dataset.scheduleFrom);
    if (
      target.dataset.delivery &&
      (await confirm(
        target.dataset.delivery === 'delivered'
          ? 'تأكيد أن هذه الخطبة أُلقيت فعلاً في هذا الموعد؟'
          : 'تأكيد أن هذه الخطبة لم تُلقَ في هذا الموعد؟',
      ))
    )
      void mutate('delivery', {
        sermonId: target.dataset.id,
        date: target.dataset.date,
        status: target.dataset.delivery,
      });
  });
  void load()
    .then(() => {
      const id = win.location.hash.slice('#manage-'.length);
      if (
        win.location.hash.startsWith('#manage-') &&
        view.sermons.some((s) => s.id === id)
      ) {
        const current = Object.entries(view.assignments).find(
          ([, a]) => a.sermonId === id && a.status === 'scheduled',
        );
        open(id, current?.[0]);
      }
    })
    .catch(error);
}
