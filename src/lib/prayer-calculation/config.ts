import {
  CalculationMethod,
  HighLatitudeRule,
  Madhab,
  PolarCircleResolution,
  Shafaq,
} from 'adhan';
import type { PrayerName } from '../prayer-times.ts';
import { requireCivilDate } from './calendar.ts';

export const ENGINE_VERSION = 'adhan@4.4.6';
export const EVENTS = [
  'fajr',
  'sunrise',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
] as const;
export type EventName = (typeof EVENTS)[number];
export type Preset = keyof typeof CalculationMethod;
export type Adjustments = Record<EventName, number>;
export interface CalculationSettings {
  revision: string;
  timezone: 'Europe/Berlin';
  location: {
    label: string;
    latitude: number;
    longitude: number;
    sourceUrl: string;
    status: 'provisional' | 'confirmed';
  };
  preset: Preset;
  fajrAngle: number;
  isha:
    | { kind: 'angle'; angle: number }
    | {
        kind: 'minutes-after-sunset';
        minutes: number;
        dateOverrides: {
          from: string;
          through: string;
          minutes: number;
          reason: string;
        }[];
      };
  maghribAngle: number;
  madhab: 'shafi' | 'hanafi';
  highLatitudeRule: 'middleofthenight' | 'seventhofthenight' | 'twilightangle';
  polarCircleResolution: 'Unresolved' | 'AqrabYaum' | 'AqrabBalad';
  shafaq: 'general' | 'ahmer' | 'abyad';
  rounding: 'nearest' | 'up' | 'none';
  adjustments: Adjustments;
  methodAdjustments: Adjustments;
}

/** Review starting point only: a preset is never local religious approval. */
export function settingsFromPreset(
  preset: Preset,
  location: CalculationSettings['location'],
): CalculationSettings {
  const params = CalculationMethod[preset]();
  return {
    revision: 'unreviewed-settings',
    timezone: 'Europe/Berlin',
    location: { ...location },
    preset,
    fajrAngle: params.fajrAngle,
    isha:
      params.ishaInterval > 0
        ? {
            kind: 'minutes-after-sunset',
            minutes: params.ishaInterval,
            dateOverrides: [],
          }
        : { kind: 'angle', angle: params.ishaAngle },
    maghribAngle: params.maghribAngle,
    madhab: params.madhab,
    highLatitudeRule:
      params.highLatitudeRule as CalculationSettings['highLatitudeRule'],
    polarCircleResolution: 'Unresolved',
    shafaq: params.shafaq,
    rounding: params.rounding,
    adjustments: { ...params.adjustments },
    methodAdjustments: { ...params.methodAdjustments },
  };
}

export function validateSettings(settings: CalculationSettings): void {
  const finite = (value: number, min: number, max: number) =>
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max;
  const label = (value: string) =>
    typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
  if (
    !settings ||
    settings.timezone !== 'Europe/Berlin' ||
    !Object.hasOwn(CalculationMethod, settings.preset) ||
    !label(settings.revision)
  )
    throw new Error('Invalid calculation settings.');
  const location = settings.location;
  if (
    !location ||
    !label(location.label) ||
    !finite(location.latitude, -90, 90) ||
    !finite(location.longitude, -180, 180) ||
    !['provisional', 'confirmed'].includes(location.status)
  )
    throw new Error('Invalid location.');
  const url = new URL(location.sourceUrl);
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('Location needs an HTTPS source URL.');
  if (
    !finite(settings.fajrAngle, 0.01, 30) ||
    !finite(settings.maghribAngle, 0, 30)
  )
    throw new Error('Invalid angle.');
  if (
    !Object.values(Madhab).includes(settings.madhab) ||
    !Object.values(HighLatitudeRule).includes(settings.highLatitudeRule) ||
    !Object.keys(PolarCircleResolution).includes(
      settings.polarCircleResolution,
    ) ||
    !Object.values(Shafaq).includes(settings.shafaq) ||
    !['nearest', 'up', 'none'].includes(settings.rounding)
  )
    throw new Error('Unknown calculation policy.');
  for (const offsets of [settings.adjustments, settings.methodAdjustments]) {
    if (
      !offsets ||
      Object.keys(offsets).length !== EVENTS.length ||
      EVENTS.some((key) => !finite(offsets[key], -1440, 1440))
    )
      throw new Error('Provide every finite minute adjustment explicitly.');
  }
  if (settings.isha?.kind === 'angle') {
    if (!finite(settings.isha.angle, 0.01, 30))
      throw new Error('Invalid Isha angle.');
  } else if (settings.isha?.kind === 'minutes-after-sunset') {
    if (
      !finite(settings.isha.minutes, 1, 720) ||
      !Array.isArray(settings.isha.dateOverrides)
    )
      throw new Error('Invalid Isha interval.');
    const ranges = [...settings.isha.dateOverrides].sort((a, b) =>
      a.from.localeCompare(b.from),
    );
    ranges.forEach((range, index) => {
      requireCivilDate(range.from);
      requireCivilDate(range.through);
      if (
        range.through < range.from ||
        !finite(range.minutes, 1, 720) ||
        !label(range.reason) ||
        (index > 0 && ranges[index - 1]!.through >= range.from)
      )
        throw new Error('Invalid or overlapping explicit Isha date overrides.');
    });
  } else throw new Error('Specify the Isha calculation.');
}

export function methodDescription(settings: CalculationSettings): string {
  return `${settings.preset}; Fajr ${settings.fajrAngle}°; Isha ${settings.isha.kind === 'angle' ? `${settings.isha.angle}°` : `${settings.isha.minutes} min + dated overrides`}; Asr ${settings.madhab}; ${settings.highLatitudeRule}; ${settings.rounding}`;
}
export type FivePrayerTimes = Record<PrayerName, string>;
