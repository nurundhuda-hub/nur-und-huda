export const prayerLabels: Record<string, string> = {
  fajr: 'الفجر',
  dhuhr: 'الظهر',
  asr: 'العصر',
  maghrib: 'المغرب',
  isha: 'العشاء',
};
export interface CommunityGathering {
  id: string;
  prayer: string;
  startsAt: string;
  participantCount: number;
  participantNames?: string[];
  note?: string;
  joined: boolean;
  participationRevision: number;
  organizer: boolean;
  cancelled: boolean;
}
export function berlinLocal(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (key: string) => parts.find((p) => p.type === key)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
export function berlinToUtc(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error('INVALID_TIME');
  const reference = Date.parse(value + 'Z'),
    matches: string[] = [];
  for (let minutes = -180; minutes <= 180; minutes += 30) {
    const candidate = new Date(reference + minutes * 60_000);
    if (
      Number.isFinite(candidate.getTime()) &&
      berlinLocal(candidate) === value
    )
      matches.push(candidate.toISOString());
  }
  // Do not silently pick an hour when DST makes a local time ambiguous.
  if (matches.length !== 1) throw new Error('INVALID_TIME');
  return matches[0]!;
}
export const communityErrors: Record<string, string> = {
  GROUP_ACCESS_REQUIRED: 'انتهى إذن الدخول. أدخل رمز المجموعة للمتابعة.',
  STAGING_ACCESS_REQUIRED: 'أدخل رمز الاختبار الخاص بك. لا تشاركه مع غيرك.',
  STAGING_CLOSED: 'انتهت فترة الاختبار أو أُغلق الوصول. تواصل مع المسؤول.',
  INVALID_TIME:
    'اختر وقتاً واضحاً بعد دقيقة على الأقل وخلال الساعات الأربع والعشرين القادمة، بتوقيت برلين.',
  INVALID_INPUT: 'تحقق من الاسم والصلاة والوقت ثم حاول مجدداً.',
  INVALID_NAME: 'اكتب الاسم الأول فقط، بحروف عربية أو لاتينية، حتى ٤٠ حرفاً.',
  INVALID_NOTE: 'اكتب ملاحظة قصيرة حتى ١٢٠ حرفاً، دون روابط أو بيانات حساسة.',
  OWNERSHIP_REQUIRED:
    'تعذر التحقق من مشاركتك على هذا المتصفح. أعد تحميل الصفحة.',
  NOT_OWNER: 'يمكن لمن أنشأ الجماعة فقط إلغاءها.',
  NOT_FOUND: 'لم تعد هذه الجماعة متاحة. تم تحديث القائمة.',
  EXPIRED: 'انتهى موعد هذه الجماعة أو أُلغيت.',
  STALE_COMMAND: 'تغيرت المشاركة. حدّث القائمة قبل المحاولة مجدداً.',
  CAPACITY: 'اكتمل العدد المتاح حالياً. اختر جماعة أخرى أو حاول لاحقاً.',
  RATE_LIMITED:
    'طلبات كثيرة الآن. انتظر دقيقة ثم حدّث القائمة؛ قد يستمر الحد اليومي حتى الغد.',
  UNAVAILABLE: 'تعذر تأكيد العملية. حدّث القائمة للتحقق قبل إعادة المحاولة.',
  STORAGE:
    'لا يمكن حفظ مفتاح مشاركتك في هذا المتصفح. اسمح بتخزين بيانات الموقع قبل المشاركة.',
  OFFLINE:
    'أنت غير متصل. لم تُرسل أي عملية جديدة؛ اتصل بالإنترنت ثم حدّث القائمة.',
};
export function apiEndpoint(value: string, local = false) {
  if (!value) return null;
  if (value === '/nur-und-huda/api') return value;
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(
        local &&
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      ))
  )
    throw new Error('Invalid community API URL');
  return url.href.replace(/\/$/, '');
}
