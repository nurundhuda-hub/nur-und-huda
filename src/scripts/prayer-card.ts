import {
  PRAYERS,
  berlinDate,
  formatCountdown,
  formatPrayerTime,
  formatScheduleDate,
  getPrayerState,
  type ValidationOptions,
  type UnavailableReason,
} from '../lib/prayer-times';

const messages: Record<UnavailableReason, string> = {
  missing: 'بانتظار اعتماد المواقيت',
  unapproved: 'بانتظار اعتماد المواقيت',
  invalid: 'المواقيت غير متاحة',
  stale: 'المواقيت بحاجة إلى تحديث',
  'not-yet-valid': 'المواقيت غير سارية بعد؛ تحقّق من ساعة جهازك',
  'no-current-day': 'لا توجد مواقيت معتمدة لهذا اليوم',
};
const mounted = new WeakMap<HTMLElement, () => void>();
function setText(node: HTMLElement, value: string): void {
  if (node.textContent !== value) node.textContent = value;
}

/** Pure source injection: no fetch, storage, URL parameters or provider APIs. */
export function mountPrayerCard(
  card: HTMLElement,
  data: unknown,
  options: ValidationOptions & { now?: () => number } = {},
): () => void {
  const existing = mounted.get(card);
  if (existing) return existing;
  const doc = card.ownerDocument;
  const win = doc.defaultView;
  const name = card.querySelector<HTMLElement>('[data-prayer-next]');
  const status = card.querySelector<HTMLElement>('[data-prayer-status]');
  const clock = card.querySelector<HTMLElement>('[data-prayer-clock]');
  const explanation = card.querySelector<HTMLElement>(
    '[data-prayer-explanation]',
  );
  const provenance = card.querySelector<HTMLElement>('[data-prayer-source]');
  const date = card.querySelector<HTMLElement>('[data-prayer-date]');
  const note = card.querySelector<HTMLElement>('[data-prayer-note]');
  const list = card.querySelector<HTMLElement>('#all-prayers');
  const details = card.querySelector<HTMLDetailsElement>('.prayer-details');
  const disclosureLabel = card.querySelector<HTMLElement>(
    '[data-prayer-disclosure-label]',
  );
  const fridayInfo = card.querySelector<HTMLElement>('[data-friday-info]');
  const sermon = card.querySelector<HTMLElement>('[data-friday-sermon]');
  const iqama = card.querySelector<HTMLElement>('[data-friday-iqama]');
  const rows = PRAYERS.map(({ id }) =>
    card.querySelector<HTMLElement>(`[data-prayer-time="${id}"]`),
  );
  if (
    !win ||
    !name ||
    !status ||
    !clock ||
    !explanation ||
    !provenance ||
    !date ||
    !note ||
    !list ||
    !details ||
    !disclosureLabel ||
    !fridayInfo ||
    !sermon ||
    !iqama ||
    rows.some((row) => !row)
  )
    return () => {};

  let timer: number | undefined;
  let disposed = false;
  let suspended = false;
  const now = options.now ?? Date.now;
  const showTime = (
    element: HTMLElement,
    at: string | null,
    fallback: string,
  ) => {
    if (!at) {
      setText(element, fallback);
      return;
    }
    let time = element.querySelector('time');
    if (!time) {
      time = doc.createElement('time');
      time.dir = 'ltr';
      element.replaceChildren(time);
    }
    time.dateTime = at;
    setText(time, formatPrayerTime(at));
  };
  const render = (state: ReturnType<typeof getPrayerState>) => {
    const daily = state.daily;
    if (daily.status === 'ready') {
      setText(status, 'مواقيت معتمدة');
      date.hidden = false;
      setText(date, formatScheduleDate(daily.date));
      list.setAttribute(
        'aria-label',
        `الصلوات الخمس — ${formatScheduleDate(daily.date)}`,
      );
      daily.prayers.forEach((prayer, index) =>
        showTime(rows[index]!, prayer.at, 'غير معتمد بعد'),
      );
      provenance.hidden = false;
      setText(
        provenance,
        `المصدر: ${daily.source} · آخر تحديث: ${formatScheduleDate(berlinDate(Date.parse(daily.updatedAt)))}، ${formatPrayerTime(daily.updatedAt)} (Europe/Berlin)`,
      );
      setText(
        note,
        'المواقيت المعتمدة معروضة بتوقيت برلين. العدّ التنازلي يعتمد على ساعة جهازك.',
      );
      if (daily.next && daily.remainingSeconds !== null) {
        setText(name, daily.next.label);
        setText(
          explanation,
          `الموعد التالي: ${formatScheduleDate(berlinDate(daily.next.epoch))} بتوقيت برلين`,
        );
        if (!clock.querySelector('[data-countdown]')) {
          const at = doc.createElement('p');
          at.className = 'next-prayer-time';
          at.dataset.nextPrayerTime = '';
          const remaining = doc.createElement('p');
          remaining.className = 'prayer-countdown';
          remaining.dataset.countdown = '';
          remaining.dir = 'ltr';
          remaining.setAttribute('role', 'timer');
          remaining.setAttribute('aria-live', 'off');
          remaining.setAttribute('aria-label', 'الوقت المتبقي للصلاة القادمة');
          clock.replaceChildren(at, remaining);
        }
        showTime(
          clock.querySelector<HTMLElement>('[data-next-prayer-time]')!,
          daily.next.at,
          '',
        );
        setText(
          clock.querySelector<HTMLElement>('[data-countdown]')!,
          formatCountdown(daily.remainingSeconds),
        );
      } else {
        clock.replaceChildren();
        setText(name, 'بانتظار مواقيت الصلاة القادمة');
        setText(explanation, 'لم تتوفر بعد مواقيت معتمدة للصلاة التالية.');
      }
    } else {
      setText(
        status,
        daily.reason === 'stale' ? 'بحاجة إلى تحديث' : 'بانتظار الاعتماد',
      );
      setText(name, messages[daily.reason]);
      setText(
        explanation,
        'ستظهر الصلاة القادمة والعدّ التنازلي بعد التحقق من مصدر موثوق.',
      );
      clock.replaceChildren();
      rows.forEach((row) => setText(row!, 'غير معتمد بعد'));
      list.setAttribute('aria-label', 'الصلوات الخمس — لا توجد مواقيت معتمدة');
      date.hidden = true;
      setText(date, '');
      provenance.hidden = true;
      setText(provenance, '');
      setText(
        note,
        'لا توجد مواقيت معتمدة صالحة الآن؛ لا تعتمد على هذه البطاقة للصلاة أو الإفطار.',
      );
    }
    const friday = state.friday;
    if (friday.status === 'ready') {
      showTime(sermon, friday.sermonAt, 'لم يُحدّد بعد');
      showTime(iqama, friday.iqamaAt, 'لم يُحدّد بعد');
      fridayInfo.hidden = false;
      setText(
        fridayInfo,
        `${formatScheduleDate(friday.date)} · المصدر: ${friday.source}`,
      );
    } else {
      setText(sermon, 'لم يُحدّد بعد');
      setText(iqama, 'لم يُحدّد بعد');
      fridayInfo.hidden = friday.reason === 'missing';
      setText(
        fridayInfo,
        friday.reason === 'stale'
          ? 'معلومات الجمعة بحاجة إلى تحديث.'
          : 'لا توجد معلومات جمعة معتمدة صالحة الآن.',
      );
    }
  };
  const stop = () => {
    if (timer !== undefined) {
      win.clearInterval(timer);
      timer = undefined;
    }
  };
  const canChange = (state: ReturnType<typeof getPrayerState>) =>
    [state.daily, state.friday].some(
      (part) =>
        part.status === 'ready' ||
        part.reason === 'not-yet-valid' ||
        part.reason === 'no-current-day',
    );
  const tick = () => {
    if (disposed) return false;
    if (!card.isConnected) {
      destroy();
      return false;
    }
    const state = getPrayerState(data, now(), options);
    render(state);
    const active = canChange(state);
    if (!active) stop();
    return active;
  };
  const resume = () => {
    stop();
    if (disposed || suspended) return;
    const active = tick();
    if (active && !doc.hidden) timer = win.setInterval(tick, 1000);
  };
  const hide = () => {
    suspended = true;
    stop();
  };
  const show = () => {
    suspended = false;
    resume();
  };
  const visibility = () => {
    if (doc.hidden) stop();
    else resume();
  };
  const disclosure = () =>
    setText(
      disclosureLabel,
      details.open ? 'إخفاء الصلوات الخمس' : 'عرض الصلوات الخمس',
    );
  function destroy() {
    if (disposed) return;
    disposed = true;
    stop();
    doc.removeEventListener('visibilitychange', visibility);
    win!.removeEventListener('pagehide', hide);
    win!.removeEventListener('pageshow', show);
    details!.removeEventListener('toggle', disclosure);
    mounted.delete(card);
    // Never leave a stopped, apparently live countdown in a retained element.
    if (card.isConnected) render(getPrayerState(null, now()));
  }
  mounted.set(card, destroy);
  details.addEventListener('toggle', disclosure);
  doc.addEventListener('visibilitychange', visibility);
  win.addEventListener('pagehide', hide);
  win.addEventListener('pageshow', show);
  disclosure();
  resume();
  return destroy;
}

export function initPrayerCards(root: ParentNode): () => void {
  const cleanups = [
    ...root.querySelectorAll<HTMLElement>('[data-prayer-card]'),
  ].map((card) => {
    let data: unknown = null;
    try {
      data = JSON.parse(card.dataset.prayerPayload ?? 'null');
    } catch {
      data = {};
    }
    return mountPrayerCard(card, data); // test-fixture purpose is rejected by default
  });
  return () => cleanups.forEach((cleanup) => cleanup());
}
