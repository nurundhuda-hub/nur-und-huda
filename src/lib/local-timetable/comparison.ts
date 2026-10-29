import { PRAYERS, type PrayerName } from '../prayer-times.ts';
import { calculatePrayerDay } from '../prayer-calculation/adapter.ts';
import { berlinWallTime } from '../prayer-calculation/calendar.ts';
import type { CalculationSettings } from '../prayer-calculation/config.ts';
import type { ReferenceSample } from '../prayer-calculation/comparison.ts';
import type { TimetableReview } from './importer.ts';

/** Diagnostics only. Neither agreement nor missing reference coverage approves data. */
export function compareLocalTimetable(
  review: TimetableReview,
  settings: CalculationSettings,
  references: ReferenceSample[],
) {
  const differences = (
    a: Record<PrayerName, string>,
    b: Record<PrayerName, string>,
  ) =>
    Object.fromEntries(
      PRAYERS.map(({ id }) => [
        id,
        (Date.parse(a[id]) - Date.parse(b[id])) / 60000,
      ]),
    ) as Record<PrayerName, number>;
  return {
    purpose: 'local-timetable-comparison-only',
    sourceRevision: review.manifest.source.revision,
    normalizedSha256: review.normalizedSha256,
    timeMeaning: review.manifest.timeMeaning,
    calculationSettings: structuredClone(settings),
    acceptableTolerance: null,
    assessment: 'human-review-required',
    missingLocalReferenceDates: references
      .filter((ref) => !review.days.some((day) => day.date === ref.date))
      .map((ref) => ({ date: ref.date, source: ref.source })),
    rows: review.days.map((day) => {
      let calculated: ReturnType<typeof calculatePrayerDay> | null = null;
      let calculationError: string | null = null;
      try {
        calculated = calculatePrayerDay(settings, day.date);
      } catch (error) {
        calculationError =
          error instanceof Error ? error.message : 'Calculation unavailable';
      }
      const matches = references.filter((ref) => ref.date === day.date);
      return {
        date: day.date,
        calculationError,
        calculatedMinusLocalMinutes: calculated
          ? differences(calculated.day.times, day.times)
          : null,
        references: matches.map((ref) => {
          const times = Object.fromEntries(
            PRAYERS.map(({ id }) => [
              id,
              berlinWallTime(ref.date, ref.times[id]),
            ]),
          ) as Record<PrayerName, string>;
          return {
            source: ref.source,
            context: ref.context,
            localMinusReferenceMinutes: differences(day.times, times),
            calculatedMinusReferenceMinutes: calculated
              ? differences(calculated.day.times, times)
              : null,
          };
        }),
        referenceStatus: matches.length
          ? 'matched-date'
          : 'no-reference-for-date',
      };
    }),
  };
}
