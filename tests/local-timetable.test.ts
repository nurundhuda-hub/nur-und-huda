import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  importTimetable,
  sha256,
  type TimetableManifest,
} from '../src/lib/local-timetable/importer';
import { compareLocalTimetable } from '../src/lib/local-timetable/comparison';
import {
  adjacentDate,
  berlinWallTime,
} from '../src/lib/prayer-calculation/calendar';
import { settingsFromPreset } from '../src/lib/prayer-calculation/config';
import { hospitalLocation } from '../src/data/prayer-settings';
import { prayerData } from '../src/data/prayer-data';
import { getPrayerState } from '../src/lib/prayer-times';

// Arbitrary software fixtures, never As-Salam times, permission or approval.
const marker = 'SYNTHETIC_PRAYER_TEST_ONLY_NOT_FOR_WORSHIP';
const options = {
  now: Date.parse('2027-01-01T00:00:00Z'),
  allowTestFixtures: true,
};
const row = (date: string) => ({
  date,
  times: {
    fajr: '05:00',
    dhuhr: '12:00',
    asr: '15:00',
    maghrib: '18:00',
    isha: '21:00',
  },
});
const bytes = (input: string) => new TextEncoder().encode(input);
function manifest(
  input: Uint8Array,
  from = '2027-03-27',
  through = '2027-03-28',
  format: 'csv' | 'json' = 'json',
): TimetableManifest {
  return {
    schemaVersion: 1,
    purpose: 'test-fixture',
    timezone: 'Europe/Berlin',
    source: {
      id: marker,
      label: marker,
      url: 'https://example.invalid/synthetic',
      publisher: marker,
      mosqueName: marker,
      address: marker,
      revision: 'synthetic-r1',
      issuedAt: '2026-12-01T00:00:00Z',
      acquiredAt: '2026-12-02T00:00:00Z',
      identity: {
        status: 'verified',
        evidenceRef: marker,
        verifiedBy: marker,
        verifiedAt: '2026-12-02T00:00:00Z',
      },
    },
    timeMeaning: { kind: 'prayer-entry', evidenceRef: marker },
    permission: {
      status: 'granted',
      evidenceRef: marker,
      grantedBy: marker,
      grantedAt: '2026-12-02T00:00:00Z',
      validUntil: '2032-01-01T00:00:00Z',
      scopes: ['local-review'],
      attribution: marker,
      restrictions: 'SYNTHETIC fixture only',
    },
    coverage: { from, through },
    validity: {
      validFrom: berlinWallTime(from, '00:00').replace('.000', ''),
      expiresAt: berlinWallTime(adjacentDate(through, 1), '00:00').replace(
        '.000',
        '',
      ),
    },
    input: { format, sha256: sha256(input) },
  };
}
const input = () =>
  bytes(JSON.stringify([row('2027-03-27'), row('2027-03-28')]));
const importRows = (
  rows: unknown[],
  from = '2027-03-27',
  through = '2027-03-28',
) => {
  const b = bytes(JSON.stringify(rows));
  return importTimetable(b, manifest(b, from, through), options);
};

describe('authorized local timetable boundary', () => {
  it('keeps real source unverified, samples absent and production inactive', () => {
    const register = JSON.parse(
      readFileSync('validation/local-source-permissions.json', 'utf8'),
    );
    expect(register.candidate.authorizedSampleCount).toBe(0);
    expect(register.candidate.authorizedInput).toBeNull();
    expect(register.candidate.permission.status).toBe('not-obtained');
    expect(register.independentCalculationRole).toBe(
      'comparison-and-diagnostics-only',
    );
    expect(prayerData).toBeNull();
    expect(() =>
      importTimetable(
        input(),
        JSON.parse(
          readFileSync('validation/local-manifest.template.json', 'utf8'),
        ),
        options,
      ),
    ).toThrow();
  });
  it('rejects fixture input without explicit test opt-in, including the CLI default', () => {
    expect(() =>
      importTimetable(input(), manifest(input()), { now: options.now }),
    ).toThrow(/fixture/);
  });
  it('creates only a pending review artifact, with no hospital Friday data or public payload', () => {
    const m = manifest(input()),
      before = JSON.stringify(m);
    const result = importTimetable(input(), m, options);
    expect(result.purpose).toBe('review-only');
    expect(result.approval).toEqual({ status: 'pending' });
    expect(result.hospitalFriday).toBeNull();
    expect(result.normalizedSha256).toBe(sha256(JSON.stringify(result.days)));
    expect(result.manifest.permission.scopes).toEqual(['local-review']);
    expect(JSON.stringify(m)).toBe(before);
    expect(getPrayerState(result, options.now).daily.status).toBe(
      'unavailable',
    );
  });
  it.each([
    [
      'missing permission',
      (m: TimetableManifest) => {
        m.permission.status = 'pending' as 'granted';
      },
    ],
    [
      'missing identity',
      (m: TimetableManifest) => {
        m.source.identity.status = 'pending' as 'verified';
      },
    ],
    [
      'unknown semantics',
      (m: TimetableManifest) => {
        m.timeMeaning.kind = 'unknown' as 'adhan';
      },
    ],
    [
      'iqama semantics',
      (m: TimetableManifest) => {
        m.timeMeaning.kind = 'iqama' as 'adhan';
      },
    ],
    [
      'missing evidence',
      (m: TimetableManifest) => {
        m.timeMeaning.evidenceRef = '';
      },
    ],
    [
      'missing scope',
      (m: TimetableManifest) => {
        m.permission.scopes = ['public-display'];
      },
    ],
    [
      'expired permission',
      (m: TimetableManifest) => {
        m.permission.validUntil = '2026-12-31T23:59:59Z';
      },
    ],
    [
      'future grant',
      (m: TimetableManifest) => {
        m.permission.grantedAt = '2027-01-02T00:00:00Z';
      },
    ],
    [
      'future acquisition',
      (m: TimetableManifest) => {
        m.source.acquiredAt = '2027-01-02T00:00:00Z';
      },
    ],
    [
      'wrong timezone',
      (m: TimetableManifest) => {
        m.timezone = 'UTC' as 'Europe/Berlin';
      },
    ],
    [
      'wrong checksum',
      (m: TimetableManifest) => {
        m.input.sha256 = '0'.repeat(64);
      },
    ],
    [
      'invalid UTC stamp',
      (m: TimetableManifest) => {
        m.source.issuedAt = '2026-02-30T00:00:00Z';
      },
    ],
    [
      'invalid source URL',
      (m: TimetableManifest) => {
        m.source.url = 'https://user:password@example.invalid';
      },
    ],
    [
      'missing revision',
      (m: TimetableManifest) => {
        m.source.revision = '';
      },
    ],
    [
      'expiry beyond coverage',
      (m: TimetableManifest) => {
        m.validity.expiresAt = '2027-04-01T00:00:00Z';
      },
    ],
    [
      'expiry beyond permission',
      (m: TimetableManifest) => {
        m.permission.validUntil = '2027-03-27T00:00:00Z';
      },
    ],
  ] as const)('rejects %s', (_label, mutate) => {
    const m = manifest(input());
    mutate(m);
    expect(() => importTimetable(input(), m, options)).toThrow();
  });
  it('preserves documented adhan semantics without treating them as prayer entry', () => {
    const m = manifest(input());
    m.timeMeaning.kind = 'adhan';
    const result = importTimetable(input(), m, options);
    expect(result.manifest.timeMeaning.kind).toBe('adhan');
    expect(result.approval.status).toBe('pending');
  });
  it('reports future, current and stale timetable windows without rejecting historical diagnostics', () => {
    const m = manifest(input());
    expect(importTimetable(input(), m, options).freshness).toBe(
      'not-yet-valid',
    );
    expect(
      importTimetable(input(), m, {
        ...options,
        now: Date.parse(m.validity.validFrom),
      }).freshness,
    ).toBe('current');
    expect(
      importTimetable(input(), m, {
        ...options,
        now: Date.parse(m.validity.expiresAt),
      }).freshness,
    ).toBe('stale');
  });
});

describe('date, time and file validation', () => {
  it.each([
    ['2027-03-27', '2027-03-28', 23],
    ['2027-10-30', '2027-10-31', 25],
  ] as const)(
    'converts consecutive civil days across DST %s',
    (a, b, hours) => {
      const result = importRows([row(b), row(a)], a, b);
      expect(result.days.map((day) => day.date)).toEqual([a, b]);
      expect(
        Date.parse(result.days[1]!.times.fajr) -
          Date.parse(result.days[0]!.times.fajr),
      ).toBe(hours * 3600000);
    },
  );
  it('rejects spring gaps and ambiguous autumn clocks; explicit valid offsets resolve the fold', () => {
    for (const date of ['2027-03-28', '2027-10-31']) {
      const value = row(date);
      value.times.fajr = '02:30';
      expect(() => importRows([value], date, date)).toThrow(
        /missing or ambiguous/,
      );
    }
    const a = row('2027-10-31');
    a.times.fajr = '2027-10-31T02:30:00+02:00';
    const b = structuredClone(a);
    b.times.fajr = '2027-10-31T02:30:00+01:00';
    expect(
      Date.parse(importRows([b], b.date, b.date).days[0]!.times.fajr) -
        Date.parse(importRows([a], a.date, a.date).days[0]!.times.fajr),
    ).toBe(3600000);
    a.times.fajr = '2027-10-31T05:00:00+02:00';
    expect(() => importRows([a], a.date, a.date)).toThrow(/Berlin timestamp/);
  });
  it('requires explicit after-midnight Isha and rejects cross-day overlap', () => {
    const a = row('2027-03-27'),
      b = row('2027-03-28');
    a.times.isha = '00:30';
    expect(() => importRows([a, b])).toThrow(/chronology/);
    a.times.isha = '00:30+1';
    expect(importRows([a, b]).days[0]!.times.isha).toBe(
      '2027-03-27T23:30:00.000Z',
    );
    a.times.isha = '05:00+1';
    expect(() => importRows([a, b])).toThrow(/following Fajr/);
    a.times.isha = '21:00';
    a.times.maghrib = '00:30+1';
    expect(() => importRows([a, b])).toThrow(/Only Isha/);
  });
  it('accepts leap day/year rollover and rejects gaps, duplicates, invalid and extra dates', () => {
    expect(
      importRows(
        [row('2028-02-28'), row('2028-02-29'), row('2028-03-01')],
        '2028-02-28',
        '2028-03-01',
      ).days,
    ).toHaveLength(3);
    expect(
      importRows(
        [row('2027-12-31'), row('2028-01-01')],
        '2027-12-31',
        '2028-01-01',
      ).days,
    ).toHaveLength(2);
    for (const rows of [
      [row('2027-03-27')],
      [row('2027-03-28')],
      [row('2027-03-27'), row('2027-03-27')],
      [row('2027-03-27'), row('2027-03-29')],
      [row('2027-02-29')],
    ])
      expect(() => importRows(rows)).toThrow();
  });
  it('requires exactly five times and does not ignore sunrise, iqama or Friday columns', () => {
    for (const extra of ['sunrise', 'iqama', 'friday']) {
      expect(() =>
        importRows([
          {
            ...row('2027-03-27'),
            times: { ...row('2027-03-27').times, [extra]: '12:00' },
          },
          row('2027-03-28'),
        ]),
      ).toThrow(/exactly/);
    }
    const missing = row('2027-03-27');
    Reflect.deleteProperty(missing.times, 'fajr');
    expect(() => importRows([missing, row('2027-03-28')])).toThrow();
  });
  it('rejects malformed, blank, formula, out-of-order and invalid timestamp cells', () => {
    for (const value of [
      '',
      '=NOW()',
      '24:00',
      '05:60',
      '05:00 AM',
      '2027-03-27T05:00:00',
      '2027-03-27T02:30:00+02:00',
      '20:00',
    ]) {
      const a = row('2027-03-27');
      a.times.fajr = value;
      expect(() => importRows([a, row('2027-03-28')])).toThrow();
    }
  });
  it('normalizes quoted/BOM/CRLF CSV identically to JSON, without guessed column mapping', () => {
    const csv =
      '\uFEFF"date",fajr,dhuhr,asr,maghrib,isha\r\n2027-03-27,"05:00",12:00,15:00,18:00,21:00\r\n2027-03-28,05:00,12:00,15:00,18:00,21:00\r\n';
    const b = bytes(csv);
    expect(
      importTimetable(b, manifest(b, undefined, undefined, 'csv'), options)
        .days,
    ).toEqual(importTimetable(input(), manifest(input()), options).days);
    for (const broken of [
      csv.replace('fajr', 'iqama'),
      csv.replace('"05:00"', '"05:00"x'),
      csv.replace('"05:00"', '"05:00'),
      csv.replace(',21:00', ',21:00,22:00'),
      csv.replace('"05:00"', '"05,00"'),
      csv.replaceAll(',', ';'),
    ]) {
      const bad = bytes(broken);
      expect(() =>
        importTimetable(
          bad,
          manifest(bad, undefined, undefined, 'csv'),
          options,
        ),
      ).toThrow();
    }
  });
  it('rejects malformed JSON, non-UTF8 and oversized files', () => {
    for (const b of [
      bytes('['),
      new Uint8Array([255]),
      new Uint8Array(2 * 1024 * 1024 + 1),
    ])
      expect(() => importTimetable(b, manifest(b), options)).toThrow();
  });
  it('rejects duplicate JSON fields instead of silently taking the last value', () => {
    for (const key of ['fajr', 'faj\\u0072']) {
      const duplicate = bytes(
        new TextDecoder()
          .decode(input())
          .replace('"fajr":"05:00"', `"fajr":"04:00","${key}":"05:00"`),
      );
      expect(() =>
        importTimetable(duplicate, manifest(duplicate), options),
      ).toThrow(/Duplicate JSON key/);
    }
  });
});

it('CLI refuses synthetic input and public output paths without changing production', () => {
  const prefix = `.prayer-review/cli-test-${randomUUID()}`;
  const original = readFileSync('src/data/prayer-data.ts', 'utf8');
  mkdirSync('.prayer-review', { recursive: true });
  writeFileSync(`${prefix}-input.json`, input());
  writeFileSync(`${prefix}-manifest.json`, JSON.stringify(manifest(input())));
  const args = [
    '--experimental-strip-types',
    'scripts/timetable-import.ts',
    '--input',
    `${prefix}-input.json`,
    '--manifest',
    `${prefix}-manifest.json`,
    '--out',
    `${prefix}-output.json`,
  ];
  try {
    const rejected = spawnSync(process.execPath, args, { encoding: 'utf8' });
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toContain('fixture purpose');
    expect(existsSync(`${prefix}-output.json`)).toBe(false);
    const outside = spawnSync(
      process.execPath,
      [...args.slice(0, -1), 'src/data/prayer-data.ts'],
      { encoding: 'utf8' },
    );
    expect(outside.status).not.toBe(0);
    expect(outside.stderr).toContain('directly inside .prayer-review');
    expect(readFileSync('src/data/prayer-data.ts', 'utf8')).toBe(original);
  } finally {
    for (const suffix of ['input', 'manifest', 'output'])
      rmSync(`${prefix}-${suffix}.json`, { force: true });
  }
});

describe('local comparison diagnostics', () => {
  it('reports signed differences and uncovered dates without tolerances or approval', () => {
    const local = importTimetable(input(), manifest(input()), options);
    const settings = settingsFromPreset('MuslimWorldLeague', hospitalLocation);
    settings.highLatitudeRule = 'seventhofthenight';
    const reference = {
      ...row('2027-03-27'),
      source: marker,
      context: 'synthetic comparison',
    };
    reference.times.maghrib = '18:02';
    const result = compareLocalTimetable(local, settings, [
      reference,
      { ...reference, date: '2027-06-21' },
    ]);
    expect(
      result.rows[0]!.references[0]!.localMinusReferenceMinutes.maghrib,
    ).toBe(-2);
    expect(result.rows[1]!.referenceStatus).toBe('no-reference-for-date');
    expect(result.missingLocalReferenceDates).toEqual([
      { date: '2027-06-21', source: marker },
    ]);
    expect(result.acceptableTolerance).toBeNull();
    expect(result.assessment).toBe('human-review-required');
    expect(local.approval.status).toBe('pending');
    settings.location.latitude = 90;
    const unavailable = compareLocalTimetable(local, settings, [reference]);
    expect(unavailable.rows[0]!.calculationError).not.toBeNull();
    expect(unavailable.rows[0]!.calculatedMinusLocalMinutes).toBeNull();
  });
});
