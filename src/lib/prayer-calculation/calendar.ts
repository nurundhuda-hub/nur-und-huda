import { adjacentDate, validDate } from '../prayer-times.ts';

export { adjacentDate, validDate };

export function requireCivilDate(date: string): void {
  if (
    !validDate(date) ||
    Number(date.slice(0, 4)) < 1900 ||
    Number(date.slice(0, 4)) > 2199
  ) {
    throw new Error('Expected a valid Gregorian date in 1900–2199.');
  }
}

/** The library consumes host-local Y/M/D fields, not an instant in Berlin. */
export function calculationCalendarDate(date: string): Date {
  requireCivilDate(date);
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(year!, month! - 1, day!, 12);
  if (
    value.getFullYear() !== year ||
    value.getMonth() !== month! - 1 ||
    value.getDate() !== day
  ) {
    throw new Error(
      'This civil date cannot be represented in the host timezone.',
    );
  }
  return value;
}

const berlin = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
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
function wallEpoch(epoch: number): number {
  const p = Object.fromEntries(
    berlin.formatToParts(epoch).map(({ type, value }) => [type, value]),
  );
  return Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
}

/** Reject skipped/repeated local times. Friday settings never guess a DST fold. */
export function berlinWallTime(date: string, clock: string): string {
  requireCivilDate(date);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock))
    throw new Error('Expected HH:mm.');
  const nominal = Date.parse(`${date}T${clock}:00Z`);
  const offsets = new Set(
    [-1, 0, 1].map((day) => {
      const probe = nominal + day * 86400000;
      return wallEpoch(probe) - probe;
    }),
  );
  const matches = [...offsets]
    .map((offset) => nominal - offset)
    .filter((epoch) => wallEpoch(epoch) === nominal);
  if (matches.length !== 1)
    throw new Error('Local time is missing or ambiguous in Europe/Berlin.');
  return new Date(matches[0]!).toISOString();
}
