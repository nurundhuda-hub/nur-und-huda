import {
  CalculationParameters,
  Coordinates,
  PrayerTimes,
  Rounding,
} from 'adhan';
import {
  PRAYERS,
  berlinDate,
  type PrayerDay,
  type PrayerCardData,
  type FridayPrayerSchedule,
} from '../prayer-times.ts';
import {
  adjacentDate,
  berlinWallTime,
  calculationCalendarDate,
  requireCivilDate,
} from './calendar.ts';
import {
  ENGINE_VERSION,
  methodDescription,
  validateSettings,
  type CalculationSettings,
  type FivePrayerTimes,
} from './config.ts';

export function roundInstant(
  epoch: number,
  rounding: CalculationSettings['rounding'],
): number {
  if (!Number.isFinite(epoch))
    throw new Error('Calculation returned a non-finite time.');
  if (rounding === 'none') return epoch;
  return (
    (rounding === 'up' ? Math.ceil(epoch / 60000) : Math.round(epoch / 60000)) *
    60000
  );
}

export interface CalculatedDay {
  day: PrayerDay;
  diagnostics: {
    sunrise: string;
    astronomicalSunset: string;
    effectiveIshaInterval: number;
    method: string;
  };
}

/** Offline calculation only. Output has no approval semantics. */
export function calculatePrayerDay(
  settings: CalculationSettings,
  date: string,
): CalculatedDay {
  validateSettings(settings);
  const civil = calculationCalendarDate(date);
  const interval =
    settings.isha.kind === 'minutes-after-sunset'
      ? (settings.isha.dateOverrides.find(
          (range) => range.from <= date && date <= range.through,
        )?.minutes ?? settings.isha.minutes)
      : 0;
  const params = new CalculationParameters(
    settings.preset,
    settings.fajrAngle,
    settings.isha.kind === 'angle' ? settings.isha.angle : 0,
    interval,
    settings.maghribAngle,
  );
  params.madhab = settings.madhab;
  params.highLatitudeRule = settings.highLatitudeRule;
  params.polarCircleResolution = settings.polarCircleResolution;
  params.shafaq = settings.shafaq;
  params.adjustments = { ...settings.adjustments };
  params.methodAdjustments = { ...settings.methodAdjustments };
  // Apply rounding here so an already exact minute is never moved by "up".
  params.rounding = Rounding.None;
  const raw = new PrayerTimes(
    new Coordinates(settings.location.latitude, settings.location.longitude),
    civil,
    params,
  );
  if (
    ![raw.sunrise, raw.sunset].every((value) =>
      Number.isFinite(value.getTime()),
    )
  )
    throw new Error(
      `No sunrise/sunset solution for ${date}; review the polar policy.`,
    );
  const times = {} as FivePrayerTimes;
  let previous = -Infinity;
  for (const { id } of PRAYERS) {
    const epoch = roundInstant(raw[id].getTime(), settings.rounding);
    const localDate = berlinDate(epoch);
    if (
      epoch <= previous ||
      (localDate !== date &&
        !(id === 'isha' && localDate === adjacentDate(date, 1)))
    )
      throw new Error(
        `Invalid ${id} chronology/date for ${date}. Review settings; no substitution was made.`,
      );
    times[id] = new Date(epoch).toISOString();
    previous = epoch;
  }
  const sunrise = raw.sunrise.getTime();
  if (!(Date.parse(times.fajr) < sunrise && sunrise < Date.parse(times.dhuhr)))
    throw new Error('Fajr/sunrise/Dhuhr ordering is invalid.');
  if (
    settings.maghribAngle > 0 &&
    raw.maghrib.getTime() -
      (settings.adjustments.maghrib + settings.methodAdjustments.maghrib) *
        60000 <=
      raw.sunset.getTime()
  )
    throw new Error(
      'Requested Maghrib angle could not be resolved; refusing silent sunset substitution.',
    );
  return {
    day: { date, times },
    diagnostics: {
      sunrise: raw.sunrise.toISOString(),
      astronomicalSunset: raw.sunset.toISOString(),
      effectiveIshaInterval: interval,
      method: methodDescription(settings),
    },
  };
}

export interface FridaySettings {
  revision: string;
  source: { id: string; label: string };
  date: string;
  sermon: string | null;
  iqama: string | null;
}
export interface DraftWindow {
  updatedAt: string;
  validFrom: string;
  expiresAt: string;
}

function validateWindow(window: DraftWindow): void {
  for (const value of [window.updatedAt, window.validFrom, window.expiresAt]) {
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(Date.parse(value)).toISOString().slice(0, 19) !==
        value.slice(0, 19)
    )
      throw new Error(
        'Review window timestamps must be valid UTC ISO instants.',
      );
  }
  if (
    Date.parse(window.validFrom) >= Date.parse(window.expiresAt) ||
    Date.parse(window.updatedAt) >= Date.parse(window.expiresAt)
  )
    throw new Error('Review window must end after its start and update.');
}

export function createFridayDraft(
  settings: FridaySettings,
  window: DraftWindow,
): FridayPrayerSchedule {
  validateWindow(window);
  requireCivilDate(settings.date);
  if (new Date(`${settings.date}T12:00:00Z`).getUTCDay() !== 5)
    throw new Error('Friday schedule date must be a Friday.');
  if (
    !settings.revision?.trim() ||
    !settings.source?.id?.trim() ||
    !settings.source.label?.trim()
  )
    throw new Error('Friday schedule requires its own source and revision.');
  const sermonAt =
    settings.sermon === null
      ? null
      : berlinWallTime(settings.date, settings.sermon);
  const iqamaAt =
    settings.iqama === null
      ? null
      : berlinWallTime(settings.date, settings.iqama);
  if (
    (!sermonAt && !iqamaAt) ||
    (sermonAt && iqamaAt && Date.parse(iqamaAt) <= Date.parse(sermonAt))
  )
    throw new Error('Specify independent, ordered Friday times.');
  return {
    revision: settings.revision,
    source: { ...settings.source },
    approval: { status: 'pending' },
    freshness: { ...window },
    date: settings.date,
    sermonAt,
    iqamaAt,
  };
}

export function createCalculationDraft(
  settings: CalculationSettings,
  from: string,
  through: string,
  window: DraftWindow,
  friday: FridaySettings | null = null,
) {
  validateSettings(settings);
  requireCivilDate(from);
  requireCivilDate(through);
  validateWindow(window);
  const count =
    (Date.parse(`${through}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86400000 +
    1;
  if (!Number.isInteger(count) || count < 1 || count > 370)
    throw new Error('Review range must contain 1–370 consecutive civil dates.');
  const calculated: CalculatedDay[] = [];
  for (let date = from; date <= through; date = adjacentDate(date, 1))
    calculated.push(calculatePrayerDay(settings, date));
  for (let i = 1; i < calculated.length; i++) {
    if (
      Date.parse(calculated[i - 1]!.day.times.isha) >=
      Date.parse(calculated[i]!.day.times.fajr)
    )
      throw new Error(
        'Isha reaches the following Fajr; human policy review required.',
      );
  }
  const data: PrayerCardData = {
    schemaVersion: 1,
    purpose: 'production',
    timezone: 'Europe/Berlin',
    daily: {
      revision: settings.revision,
      source: { id: ENGINE_VERSION, label: 'حساب مستقل — Adhan 4.4.6' },
      method: methodDescription(settings),
      approval: { status: 'pending' },
      freshness: { ...window },
      days: calculated.map((value) => value.day),
    },
    friday: friday ? createFridayDraft(friday, window) : null,
  };
  return {
    warning: 'REVIEW_ONLY_NOT_FOR_WORSHIP',
    engine: ENGINE_VERSION,
    settings: structuredClone(settings),
    data,
    diagnostics: calculated.map((value) => ({
      date: value.day.date,
      ...value.diagnostics,
    })),
  };
}

/** Includes yesterday's delayed Isha and tomorrow's Fajr; reads the Berlin date. */
export function calculateAroundInstant(
  settings: CalculationSettings,
  now: number,
): CalculatedDay[] {
  if (!Number.isFinite(new Date(now).getTime()))
    throw new Error('Invalid device clock.');
  const today = berlinDate(now);
  return [-1, 0, 1].map((offset) =>
    calculatePrayerDay(settings, adjacentDate(today, offset)),
  );
}
