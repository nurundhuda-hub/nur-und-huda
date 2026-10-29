import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { PRAYERS, berlinDate, getPrayerState } from '../src/lib/prayer-times';
import {
  hospitalLocation,
  prayerSettings,
  fridaySettings,
} from '../src/data/prayer-settings';
import { prayerData } from '../src/data/prayer-data';
import {
  settingsFromPreset,
  validateSettings,
} from '../src/lib/prayer-calculation/config';
import {
  calculatePrayerDay,
  calculateAroundInstant,
  createCalculationDraft,
  createFridayDraft,
  roundInstant,
} from '../src/lib/prayer-calculation/adapter';
import {
  adjacentDate,
  berlinWallTime,
} from '../src/lib/prayer-calculation/calendar';
import {
  compareReference,
  type ReferenceSample,
} from '../src/lib/prayer-calculation/comparison';

const settings = () => {
  const value = settingsFromPreset('MuslimWorldLeague', hospitalLocation);
  value.revision = 'SYNTHETIC_PRAYER_TEST_ONLY_NOT_FOR_WORSHIP';
  value.highLatitudeRule = 'seventhofthenight';
  return value;
};
const window = {
  updatedAt: '2026-01-01T00:00:00Z',
  validFrom: '2026-01-01T00:00:00Z',
  expiresAt: '2029-01-01T00:00:00Z',
};
const calculate = (date: string) => calculatePrayerDay(settings(), date);
const utc = (value: string) => Date.parse(value);

describe('independent calculation and explicit configuration', () => {
  it('keeps all production switches inactive', () => {
    expect(prayerData).toBeNull();
    expect(prayerSettings).toBeNull();
    expect(fridaySettings).toBeNull();
    expect(hospitalLocation.status).toBe('provisional');
  });
  it.each([
    '2026-02-19',
    '2026-03-19',
    '2027-06-21',
    '2027-09-22',
    '2027-12-21',
    '2028-02-29',
  ])('calculates five ordered times for the local date %s', (date) => {
    const result = calculate(date);
    expect(Object.keys(result.day.times)).toEqual(PRAYERS.map((p) => p.id));
    const epochs = PRAYERS.map((p) => utc(result.day.times[p.id]));
    expect(epochs.every(Number.isFinite)).toBe(true);
    expect(epochs).toEqual([...epochs].sort((a, b) => a - b));
    for (const prayer of PRAYERS.slice(0, 4))
      expect(berlinDate(utc(result.day.times[prayer.id]))).toBe(date);
    expect(utc(result.day.times.fajr)).toBeLessThan(
      utc(result.diagnostics.sunrise),
    );
    expect(utc(result.day.times.maghrib)).toBeGreaterThan(
      utc(result.day.times.asr),
    );
  });
  it.each([
    '2027-02-29',
    '2028-02-30',
    '2026-13-01',
    'not-a-date',
    '2100-02-29',
  ])('rejects invalid calendar date %s', (date) => {
    expect(() => calculate(date)).toThrow();
  });
  it('handles leap-day and year rollover using civil calendar arithmetic', () => {
    expect(adjacentDate('2028-02-28', 1)).toBe('2028-02-29');
    expect(adjacentDate('2028-02-29', 1)).toBe('2028-03-01');
    const result = calculateAroundInstant(
      settings(),
      utc('2026-12-31T23:30:00Z'),
    );
    expect(result.map((value) => value.day.date)).toEqual([
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });
  it('is independent of the machine timezone, including summer and DST dates', () => {
    const code = `import {calculatePrayerDay} from './src/lib/prayer-calculation/adapter.ts'; import {settingsFromPreset} from './src/lib/prayer-calculation/config.ts'; import {hospitalLocation} from './src/data/prayer-settings.ts'; const s=settingsFromPreset('MuslimWorldLeague',hospitalLocation); s.highLatitudeRule='seventhofthenight'; console.log(JSON.stringify(['2027-03-28','2027-06-21','2027-10-31','2028-02-29'].map(d=>calculatePrayerDay(s,d).day)));`;
    const results = [
      'UTC',
      'America/Los_Angeles',
      'Asia/Tokyo',
      'Europe/Berlin',
    ].map((TZ) =>
      execFileSync(
        process.execPath,
        ['--experimental-strip-types', '--input-type=module', '-e', code],
        { encoding: 'utf8', env: { ...process.env, TZ } },
      ),
    );
    results.forEach((result) => expect(result).toBe(results[0]));
  });
  it('keeps the published civil date across both Berlin DST transitions', () => {
    const cases = [
      ['2027-03-27', '2027-03-28', 60],
      ['2027-10-30', '2027-10-31', -60],
    ] as const;
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    for (const [before, after, jump] of cases) {
      const a = calculate(before).day.times.dhuhr,
        b = calculate(after).day.times.dhuhr;
      const minutes = (stamp: string) => {
        const [h, m] = formatter.format(utc(stamp)).split(':').map(Number);
        return h! * 60 + m!;
      };
      // Check the civil/absolute-time offset identity; this is not a prayer tolerance.
      expect(minutes(b) - minutes(a) - ((utc(b) - utc(a)) / 60000 - 1440)).toBe(
        jump,
      );
    }
  });
  it('exposes Asr, angles, offsets and rounding as effective settings', () => {
    const s = settings();
    s.rounding = 'none';
    const original = calculatePrayerDay(s, '2027-01-16');
    s.madhab = 'hanafi';
    expect(
      utc(calculatePrayerDay(s, '2027-01-16').day.times.asr),
    ).toBeGreaterThan(utc(original.day.times.asr));
    s.madhab = 'shafi';
    s.fajrAngle = 19.5;
    expect(
      utc(calculatePrayerDay(s, '2027-01-16').day.times.fajr),
    ).toBeLessThan(utc(original.day.times.fajr));
    s.fajrAngle = 18;
    s.adjustments.maghrib = 2;
    expect(
      utc(calculatePrayerDay(s, '2027-01-16').day.times.maghrib) -
        utc(original.day.times.maghrib),
    ).toBe(120000);
  });
  it('rounds exact minutes without accidentally adding a minute', () => {
    const exact = utc('2027-01-16T12:00:00Z');
    expect(roundInstant(exact, 'up')).toBe(exact);
    expect(roundInstant(exact + 1, 'up')).toBe(exact + 60000);
    expect(roundInstant(exact + 29999, 'nearest')).toBe(exact);
    expect(roundInstant(exact + 30000, 'nearest')).toBe(exact + 60000);
    expect(roundInstant(exact + 30123, 'none')).toBe(exact + 30123);
  });
  it('applies an explicit dated Isha interval without guessing Ramadan dates', () => {
    const s = settings();
    s.rounding = 'none';
    s.isha = {
      kind: 'minutes-after-sunset',
      minutes: 90,
      dateOverrides: [
        {
          from: '2027-02-08',
          through: '2027-02-09',
          minutes: 120,
          reason: 'SYNTHETIC TEST DATE OVERRIDE',
        },
      ],
    };
    for (const [date, minutes] of [
      ['2027-02-07', 90],
      ['2027-02-08', 120],
      ['2027-02-09', 120],
      ['2027-02-10', 90],
    ] as const) {
      const result = calculatePrayerDay(s, date);
      expect(
        utc(result.day.times.isha) - utc(result.diagnostics.astronomicalSunset),
      ).toBe(minutes * 60000);
    }
  });
  it('keeps a full leap-year draft finite and ordered with an explicitly selected policy', () => {
    const draft = createCalculationDraft(
      settings(),
      '2028-01-01',
      '2028-12-31',
      window,
    );
    expect(draft.data.daily!.days).toHaveLength(366);
    expect(draft.data.daily!.approval).toEqual({ status: 'pending' });
    expect(draft.data.daily!.method).toContain('seventhofthenight');
  });
  it('never approves a draft or fills in Friday times from Dhuhr', () => {
    const draft = createCalculationDraft(
      settings(),
      '2027-06-20',
      '2027-06-22',
      window,
    );
    expect(draft.data.friday).toBeNull();
    expect(draft.warning).toBe('REVIEW_ONLY_NOT_FOR_WORSHIP');
    const state = getPrayerState(draft.data, utc('2027-06-21T12:00:00Z')).daily;
    expect(state).toMatchObject({
      status: 'unavailable',
      reason: 'unapproved',
      provenance: { source: 'حساب مستقل — Adhan 4.4.6' },
    });
    expect(state).not.toHaveProperty('next');
  });
  it('uses calculated absolute times across midnight only after explicit test approval', () => {
    const { data } = createCalculationDraft(
      settings(),
      '2027-06-20',
      '2027-06-22',
      window,
    );
    data.purpose = 'test-fixture';
    data.daily!.approval = {
      status: 'approved',
      revision: data.daily!.revision,
      reviewedBy: 'SYNTHETIC_PRAYER_TEST_ONLY_NOT_FOR_WORSHIP',
      reviewedAt: window.updatedAt,
    };
    const expected = data.daily!.days.find((day) => day.date === '2027-06-22')!
      .times.fajr;
    for (const now of ['2027-06-21T21:59:59Z', '2027-06-21T22:00:00Z']) {
      const state = getPrayerState(data, utc(now), {
        allowTestFixtures: true,
      }).daily;
      expect(state).toMatchObject({
        status: 'ready',
        next: { name: 'fajr', at: expected },
      });
      if (state.status === 'ready')
        expect(state.remainingSeconds).toBe((utc(expected) - utc(now)) / 1000);
    }
    expect(
      getPrayerState(data, utc(window.expiresAt), { allowTestFixtures: true })
        .daily,
    ).toMatchObject({ status: 'unavailable', reason: 'stale' });
    expect(getPrayerState(data, utc('2027-06-21T22:00:00Z')).daily.status).toBe(
      'unavailable',
    );
  });
  it('rejects overlapping dated overrides and incomplete offset configuration', () => {
    const s = settings();
    s.isha = {
      kind: 'minutes-after-sunset',
      minutes: 90,
      dateOverrides: [
        {
          from: '2027-02-08',
          through: '2027-03-01',
          minutes: 120,
          reason: 'test',
        },
        {
          from: '2027-03-01',
          through: '2027-03-02',
          minutes: 120,
          reason: 'overlap',
        },
      ],
    };
    expect(() => validateSettings(s)).toThrow(/overlapping/);
    const incomplete = settings();
    Reflect.deleteProperty(incomplete.methodAdjustments, 'dhuhr');
    expect(() => validateSettings(incomplete)).toThrow(/adjustment/);
  });
  it('does not silently substitute polar times or invalid settings', () => {
    const s = settings();
    s.location.latitude = 90;
    expect(() => calculatePrayerDay(s, '2027-06-21')).toThrow();
    const bad = settings();
    bad.fajrAngle = NaN;
    expect(() => validateSettings(bad)).toThrow();
    const offsets = settings();
    offsets.adjustments.fajr = 1000;
    expect(() => calculatePrayerDay(offsets, '2027-01-16')).toThrow();
    expect(() =>
      createCalculationDraft(settings(), '2027-01-02', '2027-01-01', window),
    ).toThrow();
    expect(() =>
      createCalculationDraft(settings(), '2027-01-01', '2027-01-02', {
        ...window,
        expiresAt: window.validFrom,
      }),
    ).toThrow();
  });
  it('rejects an unresolved Maghrib angle and a summer Isha/Fajr collision', () => {
    const angle = settings();
    angle.maghribAngle = 25;
    expect(() => calculatePrayerDay(angle, '2027-06-21')).toThrow(
      /silent sunset substitution/,
    );
    const middle = settings();
    middle.highLatitudeRule = 'middleofthenight';
    expect(() =>
      createCalculationDraft(middle, '2027-06-20', '2027-06-22', window),
    ).toThrow(/following Fajr/);
  });
  it('does not leak mutation across calls or alter source settings', () => {
    const s = settings(),
      before = JSON.stringify(s);
    const a = calculatePrayerDay(s, '2027-06-21');
    calculatePrayerDay(s, '2027-12-21');
    expect(calculatePrayerDay(s, '2027-06-21')).toEqual(a);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('independent Friday civil-time adapter', () => {
  it('keeps the local sermon time stable while UTC changes with DST', () => {
    const make = (date: string) =>
      createFridayDraft(
        {
          revision: 'test-friday',
          source: { id: 'test', label: 'SYNTHETIC TEST' },
          date,
          sermon: '13:00',
          iqama: '13:15',
        },
        window,
      );
    expect(make('2027-03-26').sermonAt).toBe('2027-03-26T12:00:00.000Z');
    expect(make('2027-04-02').sermonAt).toBe('2027-04-02T11:00:00.000Z');
    expect(make('2027-04-02').approval.status).toBe('pending');
    expect(() => make('2027-04-03')).toThrow();
  });
  it('rejects spring gaps and autumn folds instead of choosing an offset', () => {
    expect(() => berlinWallTime('2027-03-28', '02:30')).toThrow(/ambiguous/);
    expect(() => berlinWallTime('2027-10-31', '02:30')).toThrow(/ambiguous/);
    expect(() => berlinWallTime('2027-02-30', '13:00')).toThrow();
  });
});

describe('published reference comparison', () => {
  const references = JSON.parse(
    readFileSync('validation/prayer-references.json', 'utf8'),
  ) as { purpose: string; samples: ReferenceSample[] };
  it('includes four seasons, Ramadan and DST reference samples', () => {
    const months = new Set(
      references.samples.map((sample) => sample.date.slice(5, 7)),
    );
    for (const month of ['01', '03', '06', '09'])
      expect(months.has(month)).toBe(true);
    expect(
      references.samples.some((sample) => sample.context.includes('Ramadan')),
    ).toBe(true);
    expect(references.purpose).toBe(
      'REFERENCE_SAMPLES_NOT_AN_APPROVED_TIMETABLE',
    );
  });
  it('reports every signed difference without assigning an acceptable tolerance', () => {
    for (const sample of references.samples) {
      const result = compareReference(settings(), sample);
      expect(result.acceptableTolerance).toBeNull();
      expect(result.assessment).toBe('human-review-required');
      expect(
        Object.values(result.differencesMinutes).every(Number.isFinite),
      ).toBe(true);
    }
  });
  it('records the unresolved summer discrepancy instead of passing the reference', () => {
    const sample = references.samples.find(
      (sample) => sample.date === '2027-06-21',
    )!;
    const result = compareReference(settings(), sample);
    expect(result.differencesMinutes).toMatchObject({
      fajr: 26,
      maghrib: -7,
      isha: -17,
    });
    expect(result.assessment).toBe('human-review-required');
  });
});
