export const PRAYER_TIMEZONE = 'Europe/Berlin' as const;
export const PRAYERS = [
  { id: 'fajr', label: 'الفجر' },
  { id: 'dhuhr', label: 'الظهر' },
  { id: 'asr', label: 'العصر' },
  { id: 'maghrib', label: 'المغرب' },
  { id: 'isha', label: 'العشاء' },
] as const;
export type PrayerName = (typeof PRAYERS)[number]['id'];

export interface Approval {
  status: 'pending' | 'approved' | 'rejected';
  revision?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}
export interface PrayerMetadata {
  revision: string;
  source: { id: string; label: string };
  approval: Approval;
  freshness: { updatedAt: string; validFrom: string; expiresAt: string };
}
export interface PrayerDay {
  /** Berlin schedule date; only Isha may extend into the next civil date. */
  date: string;
  /** ISO instants with Z or an explicit, correct Berlin UTC offset. */
  times: Record<PrayerName, string>;
}
export interface DailyPrayerSchedule extends PrayerMetadata {
  days: PrayerDay[];
}
export interface FridayPrayerSchedule extends PrayerMetadata {
  date: string;
  sermonAt: string | null;
  iqamaAt: string | null;
}
export interface PrayerCardData {
  schemaVersion: 1;
  purpose: 'production' | 'test-fixture';
  timezone: typeof PRAYER_TIMEZONE;
  daily: DailyPrayerSchedule | null;
  friday: FridayPrayerSchedule | null;
}
export interface ValidationOptions {
  /** Test callers only. The production component never enables this option. */
  allowTestFixtures?: boolean;
}
export type UnavailableReason =
  | 'missing'
  | 'invalid'
  | 'unapproved'
  | 'stale'
  | 'not-yet-valid'
  | 'no-current-day';
type Unavailable = { status: 'unavailable'; reason: UnavailableReason };
export interface PrayerOccurrence {
  name: PrayerName;
  label: string;
  at: string;
  epoch: number;
}
export type DailyPrayerState =
  | Unavailable
  | {
      status: 'ready';
      date: string;
      prayers: PrayerOccurrence[];
      next: PrayerOccurrence | null;
      remainingSeconds: number | null;
      source: string;
      updatedAt: string;
    };
export type FridayPrayerState =
  | Unavailable
  | {
      status: 'ready';
      date: string;
      sermonAt: string | null;
      iqamaAt: string | null;
      source: string;
      updatedAt: string;
    };

const berlinParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: PRAYER_TIMEZONE,
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const clockFormat = new Intl.DateTimeFormat('ar', {
  timeZone: PRAYER_TIMEZONE,
  numberingSystem: 'latn',
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
});
const dateFormat = new Intl.DateTimeFormat('ar', {
  timeZone: PRAYER_TIMEZONE,
  calendar: 'gregory',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
function localStamp(epoch: number): string {
  const parts = Object.fromEntries(
    berlinParts.formatToParts(epoch).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
export function berlinDate(epoch: number): string {
  return localStamp(epoch).slice(0, 10);
}
export function formatPrayerTime(instant: string): string {
  return clockFormat.format(Date.parse(instant));
}
export function formatScheduleDate(date: string): string {
  return dateFormat.format(Date.parse(`${date}T12:00:00Z`));
}
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= 200
  );
}
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const epoch = Date.parse(`${value}T12:00:00Z`);
  return (
    Number.isFinite(epoch) &&
    new Date(epoch).toISOString().slice(0, 10) === value
  );
}
/** UTC calendar arithmetic, never "add 24h" to a Berlin midnight. */
function adjacentDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function instant(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (
    !match ||
    !validDate(match[1]) ||
    Number(match[2]) > 23 ||
    Number(match[3]) > 59 ||
    Number(match[4]) > 59
  )
    return null;
  if (
    match[5] !== 'Z' &&
    (Number(match[7]) > 14 ||
      Number(match[8]) > 59 ||
      (Number(match[7]) === 14 && Number(match[8]) !== 0))
  )
    return null;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? epoch : null;
}
function prayerInstant(value: unknown): number | null {
  const epoch = instant(value);
  if (epoch === null || typeof value !== 'string') return null;
  // UTC Z is unambiguous. Local strings must actually match Berlin at that
  // instant, rejecting skipped DST hours and incorrect seasonal offsets.
  if (!value.endsWith('Z') && localStamp(epoch) !== value.slice(0, 19))
    return null;
  return epoch;
}
function metadataReason(value: unknown, now: number): UnavailableReason | null {
  if (
    !record(value) ||
    !text(value.revision) ||
    !record(value.source) ||
    !text(value.source.id) ||
    !text(value.source.label) ||
    !record(value.approval)
  )
    return 'invalid';
  const approval = value.approval;
  if (approval.status !== 'approved') return 'unapproved';
  const reviewed = instant(approval.reviewedAt);
  if (
    approval.revision !== value.revision ||
    !text(approval.reviewedBy) ||
    reviewed === null ||
    !record(value.freshness)
  )
    return 'invalid';
  const updated = instant(value.freshness.updatedAt);
  const from = instant(value.freshness.validFrom);
  const until = instant(value.freshness.expiresAt);
  if (
    updated === null ||
    from === null ||
    until === null ||
    until <= from ||
    updated >= until ||
    reviewed >= until ||
    updated > reviewed
  )
    return 'invalid';
  if (now < from || now < updated || now < reviewed) return 'not-yet-valid';
  if (now >= until) return 'stale';
  return null;
}
const unavailable = (reason: UnavailableReason): Unavailable => ({
  status: 'unavailable',
  reason,
});

function dailyState(value: unknown, now: number): DailyPrayerState {
  if (value === null) return unavailable('missing');
  const reason = metadataReason(value, now);
  if (reason) return unavailable(reason);
  if (
    !record(value) ||
    !Array.isArray(value.days) ||
    value.days.length === 0 ||
    value.days.length > 370
  )
    return unavailable('invalid');
  const dates = new Set<string>();
  const occurrences: (PrayerOccurrence & { date: string })[] = [];
  for (const day of value.days) {
    if (
      !record(day) ||
      !validDate(day.date) ||
      dates.has(day.date) ||
      !record(day.times) ||
      Object.keys(day.times).length !== PRAYERS.length
    )
      return unavailable('invalid');
    dates.add(day.date);
    let previous = -Infinity;
    for (const prayer of PRAYERS) {
      const at = day.times[prayer.id];
      const epoch = prayerInstant(at);
      if (epoch === null || typeof at !== 'string' || epoch <= previous)
        return unavailable('invalid');
      const localDate = berlinDate(epoch);
      if (
        localDate !== day.date &&
        !(prayer.id === 'isha' && localDate === adjacentDate(day.date, 1))
      )
        return unavailable('invalid');
      occurrences.push({
        name: prayer.id,
        label: prayer.label,
        at,
        epoch,
        date: day.date,
      });
      previous = epoch;
    }
  }
  // A delayed Isha must still precede the following day's Fajr.
  const ordered = [...occurrences].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      PRAYERS.findIndex((p) => p.id === a.name) -
        PRAYERS.findIndex((p) => p.id === b.name),
  );
  if (
    ordered.some(
      (item, index) => index > 0 && item.epoch <= ordered[index - 1]!.epoch,
    )
  )
    return unavailable('invalid');
  const today = berlinDate(now);
  if (!dates.has(today)) return unavailable('no-current-day');
  const tomorrow = adjacentDate(today, 1);
  const next =
    ordered.find(
      (item) =>
        item.epoch > now &&
        (berlinDate(item.epoch) === today ||
          (item.name === 'fajr' && item.date === tomorrow) ||
          (item.name === 'isha' && item.date === today)),
    ) ?? null;
  const data = value as unknown as DailyPrayerSchedule; // metadata and every day validated above
  return {
    status: 'ready',
    date: today,
    prayers: ordered.filter((item) => item.date === today),
    next,
    remainingSeconds: next ? Math.ceil((next.epoch - now) / 1000) : null,
    source: data.source.label,
    updatedAt: data.freshness.updatedAt,
  };
}
function fridayState(value: unknown, now: number): FridayPrayerState {
  if (value === null) return unavailable('missing');
  const reason = metadataReason(value, now);
  if (reason) return unavailable(reason);
  if (
    !record(value) ||
    !validDate(value.date) ||
    new Date(`${value.date}T12:00:00Z`).getUTCDay() !== 5
  )
    return unavailable('invalid');
  if (value.date < berlinDate(now)) return unavailable('stale');
  const sermon = value.sermonAt === null ? null : prayerInstant(value.sermonAt);
  const iqama = value.iqamaAt === null ? null : prayerInstant(value.iqamaAt);
  if (
    (value.sermonAt !== null && sermon === null) ||
    (value.iqamaAt !== null && iqama === null) ||
    (sermon === null && iqama === null)
  )
    return unavailable('invalid');
  if (
    [sermon, iqama].some(
      (epoch) => epoch !== null && berlinDate(epoch) !== value.date,
    ) ||
    (sermon !== null && iqama !== null && iqama <= sermon)
  )
    return unavailable('invalid');
  const data = value as unknown as FridayPrayerSchedule;
  return {
    status: 'ready',
    date: data.date,
    sermonAt: data.sermonAt,
    iqamaAt: data.iqamaAt,
    source: data.source.label,
    updatedAt: data.freshness.updatedAt,
  };
}

/** Pure evaluation; no provider calls, location lookup, or inferred times. */
export function getPrayerState(
  input: unknown,
  now: number,
  options: ValidationOptions = {},
): { daily: DailyPrayerState; friday: FridayPrayerState } {
  if (input === null || input === undefined)
    return { daily: unavailable('missing'), friday: unavailable('missing') };
  if (
    !Number.isFinite(new Date(now).getTime()) ||
    !record(input) ||
    input.schemaVersion !== 1 ||
    input.timezone !== PRAYER_TIMEZONE ||
    (input.purpose !== 'production' &&
      !(input.purpose === 'test-fixture' && options.allowTestFixtures === true))
  )
    return { daily: unavailable('invalid'), friday: unavailable('invalid') };
  return {
    daily: dailyState(input.daily, now),
    friday: fridayState(input.friday, now),
  };
}
