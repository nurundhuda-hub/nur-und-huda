import { PRAYERS, type PrayerName } from '../prayer-times.ts';
import { calculatePrayerDay } from './adapter.ts';
import { berlinWallTime } from './calendar.ts';
import type { CalculationSettings } from './config.ts';

export interface ReferenceSample {
  date: string;
  source: string;
  context: string;
  times: Record<PrayerName, string>;
}

/** Report differences, never convert agreement into religious approval. */
export function compareReference(
  settings: CalculationSettings,
  sample: ReferenceSample,
) {
  const calculated = calculatePrayerDay(settings, sample.date);
  const differencesMinutes = {} as Record<PrayerName, number>;
  for (const { id } of PRAYERS) {
    const reference = berlinWallTime(sample.date, sample.times[id]);
    differencesMinutes[id] =
      (Date.parse(calculated.day.times[id]) - Date.parse(reference)) / 60000;
  }
  return {
    ...sample,
    calculated: calculated.day.times,
    differencesMinutes,
    acceptableTolerance: null,
    assessment: 'human-review-required' as const,
  };
}
