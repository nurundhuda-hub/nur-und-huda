import { describe, expect, it } from 'vitest';
import {
  berlinDate,
  formatCountdown,
  getPrayerState,
  type PrayerCardData,
} from '../src/lib/prayer-times';
import { prayerData } from '../src/data/prayer-data';
import { day, fixture, metadata } from './fixtures/prayer-data';

const evaluate = (data: unknown, now = '2030-01-01T03:00:00Z') =>
  getPrayerState(data, Date.parse(now), { allowTestFixtures: true });
const ready = (data: unknown, now?: string) => {
  const result = evaluate(data, now).daily;
  expect(result.status).toBe('ready');
  if (result.status !== 'ready')
    throw new Error('Expected valid synthetic fixture');
  return result;
};
const unavailable = (reason: string) => ({ status: 'unavailable', reason });

describe('approval and freshness gates', () => {
  it('ships no active data and rejects synthetic fixtures in the public path', () => {
    expect(prayerData).toBeNull();
    expect(
      getPrayerState(fixture(), Date.parse('2030-01-01T03:00:00Z')).daily,
    ).toEqual(unavailable('invalid'));
    expect(evaluate(null).daily).toEqual(unavailable('missing'));
  });
  it.each(['pending', 'rejected'] as const)(
    'does not activate %s data',
    (status) => {
      const data = fixture();
      data.daily!.approval.status = status;
      expect(evaluate(data).daily).toEqual(unavailable('unapproved'));
    },
  );
  it.each([
    (data: PrayerCardData) => {
      data.daily!.approval.revision = 'old-revision';
    },
    (data: PrayerCardData) => {
      delete data.daily!.approval.reviewedBy;
    },
    (data: PrayerCardData) => {
      data.daily!.source.label = '';
    },
    (data: PrayerCardData) => {
      data.daily!.freshness.expiresAt = '2029-01-01T00:00:00Z';
    },
  ])('rejects incomplete or inconsistent metadata (%#)', (mutate) => {
    const data = fixture();
    mutate(data);
    expect(evaluate(data).daily).toEqual(unavailable('invalid'));
  });
  it('expires exactly at the boundary; does not display future validity', () => {
    const data = fixture();
    data.daily!.freshness.expiresAt = '2030-01-01T03:00:00Z';
    expect(evaluate(data).daily).toEqual(unavailable('stale'));
    data.daily!.freshness.expiresAt = '2031-01-01T00:00:00Z';
    data.daily!.freshness.validFrom = '2030-01-02T00:00:00Z';
    expect(evaluate(data).daily).toEqual(unavailable('not-yet-valid'));
  });
  it('rejects a data update newer than the recorded review', () => {
    const data = fixture();
    data.daily!.freshness.updatedAt = '2029-12-02T00:00:00Z';
    expect(evaluate(data).daily).toEqual(unavailable('invalid'));
  });
  it.each([
    {},
    [],
    { ...fixture(), timezone: 'UTC' },
    { ...fixture(), schemaVersion: 2 },
  ])('fails closed for malformed envelopes (%#)', (data) => {
    expect(evaluate(data).daily).toEqual(unavailable('invalid'));
  });
  it.each([NaN, Infinity, 1e20])(
    'handles invalid device timestamps (%s)',
    (now) => {
      expect(
        getPrayerState(fixture(), now, { allowTestFixtures: true }).daily,
      ).toEqual(unavailable('invalid'));
    },
  );
});

describe('Berlin dates and next prayer', () => {
  it('calculates from absolute instants and advances at the exact prayer time', () => {
    const data = fixture();
    expect(ready(data).remainingSeconds).toBe(3600);
    expect(ready(data).next!.name).toBe('fajr');
    expect(ready(data, '2030-01-01T04:00:00Z').next!.name).toBe('dhuhr');
    expect(formatCountdown(3600)).toBe('01:00:00');
    expect(formatCountdown(-1)).toBe('00:00:00');
  });
  it('selects tomorrow Fajr after Isha, but never repeats or invents it', () => {
    expect(ready(fixture(), '2030-01-01T20:00:00Z').next!.at).toBe(
      '2030-01-02T05:00:00+01:00',
    );
    expect(ready(fixture([day()]), '2030-01-01T20:00:00Z').next).toBeNull();
  });
  it('switches the five displayed prayers at Berlin midnight, independent of UTC date', () => {
    expect(berlinDate(Date.parse('2030-01-01T23:00:00Z'))).toBe('2030-01-02');
    expect(ready(fixture(), '2030-01-01T23:00:00Z').date).toBe('2030-01-02');
    expect(evaluate(fixture([day()]), '2030-01-01T23:00:00Z').daily).toEqual(
      unavailable('no-current-day'),
    );
  });
  it('retains an explicitly supplied previous evening Isha after midnight', () => {
    const data = fixture();
    data.daily!.days[0]!.times.isha = '2030-01-02T00:30:00+01:00';
    expect(ready(data, '2030-01-01T23:00:00Z').next!.name).toBe('isha');
    expect(ready(data, '2030-01-01T23:00:00Z').remainingSeconds).toBe(1800);
  });
  it.each([
    (data: PrayerCardData) => {
      delete (data.daily!.days[0]!.times as Partial<Record<string, string>>)
        .fajr;
    },
    (data: PrayerCardData) => {
      data.daily!.days.push(day());
    },
    (data: PrayerCardData) => {
      data.daily!.days[0]!.times.asr = data.daily!.days[0]!.times.dhuhr;
    },
    (data: PrayerCardData) => {
      data.daily!.days[0]!.times.fajr = '2030-02-30T05:00:00+01:00';
    },
    (data: PrayerCardData) => {
      data.daily!.days[0]!.times.fajr = '2030-01-01T05:00:00';
    },
    (data: PrayerCardData) => {
      data.daily!.days[0]!.times.isha = '2030-01-02T06:00:00+01:00';
    },
  ])(
    'rejects incomplete, duplicated, unordered or ambiguous times (%#)',
    (mutate) => {
      const data = fixture();
      mutate(data);
      expect(evaluate(data).daily).toEqual(unavailable('invalid'));
    },
  );
  it('uses absolute elapsed time over the spring DST jump', () => {
    const data = fixture([day('2030-03-31', '+02:00')]);
    data.daily!.days[0]!.times.fajr = '2030-03-31T03:30:00+02:00';
    expect(ready(data, '2030-03-31T01:30:00+01:00').remainingSeconds).toBe(
      3600,
    );
    data.daily!.days[0]!.times.fajr = '2030-03-31T02:30:00+01:00';
    expect(evaluate(data, '2030-03-31T00:30:00Z').daily).toEqual(
      unavailable('invalid'),
    );
  });
  it.each([
    ['+02:00', 1800],
    ['+01:00', 5400],
  ] as const)(
    'disambiguates the autumn repeated hour with %s',
    (offset, seconds) => {
      const data = fixture([day('2030-10-27')]);
      data.daily!.days[0]!.times.fajr = `2030-10-27T02:30:00${offset}`;
      expect(ready(data, '2030-10-27T00:00:00Z').remainingSeconds).toBe(
        seconds,
      );
    },
  );
  it('accepts UTC instants and rejects incorrect Berlin seasonal offsets', () => {
    const data = fixture();
    data.daily!.days[0]!.times.fajr = '2030-01-01T04:00:00Z';
    expect(ready(data).remainingSeconds).toBe(3600);
    data.daily!.days[0]!.times.fajr = '2030-01-01T05:00:00+02:00';
    expect(evaluate(data).daily).toEqual(unavailable('invalid'));
  });
});

describe('independent Friday approval', () => {
  const withFriday = () => ({
    ...fixture(),
    friday: {
      ...metadata(),
      date: '2030-01-04',
      sermonAt: '2030-01-04T10:00:00Z',
      iqamaAt: '2030-01-04T10:15:00Z',
    },
  });
  it('does not infer Friday from Dhuhr, or require daily data for Friday', () => {
    expect(evaluate(fixture()).friday).toEqual(unavailable('missing'));
    const data: PrayerCardData = withFriday();
    data.daily = null;
    expect(evaluate(data).friday.status).toBe('ready');
  });
  it('rejects unapproved Friday without blocking daily prayers', () => {
    const data = withFriday();
    data.friday.approval.status = 'pending';
    expect(evaluate(data).friday).toEqual(unavailable('unapproved'));
    expect(evaluate(data).daily.status).toBe('ready');
  });
  it('allows one independently supplied field and leaves the other unavailable', () => {
    const data: PrayerCardData = withFriday();
    data.friday!.iqamaAt = null;
    expect(evaluate(data).friday).toMatchObject({
      status: 'ready',
      iqamaAt: null,
    });
  });
  it('rejects non-Friday, reversed times and past Friday data', () => {
    const data = withFriday();
    data.friday.date = '2030-01-03';
    expect(evaluate(data).friday).toEqual(unavailable('invalid'));
    data.friday.date = '2030-01-04';
    data.friday.iqamaAt = '2030-01-04T09:00:00Z';
    expect(evaluate(data).friday).toEqual(unavailable('invalid'));
    expect(evaluate(withFriday(), '2030-01-05T00:00:00Z').friday).toEqual(
      unavailable('stale'),
    );
  });
});
