import type {
  PrayerCardData,
  PrayerDay,
  PrayerMetadata,
} from '../../src/lib/prayer-times';

// Arbitrary clock values for software tests. NEVER prayer guidance or public data.
export const FIXTURE_MARKER = 'SYNTHETIC_PRAYER_TEST_ONLY_NOT_FOR_WORSHIP';
export function metadata(): PrayerMetadata {
  return {
    revision: 'synthetic-r1',
    source: { id: FIXTURE_MARKER, label: FIXTURE_MARKER },
    approval: {
      status: 'approved',
      revision: 'synthetic-r1',
      reviewedBy: FIXTURE_MARKER,
      reviewedAt: '2029-12-01T00:00:00Z',
    },
    freshness: {
      updatedAt: '2029-12-01T00:00:00Z',
      validFrom: '2029-12-01T00:00:00Z',
      expiresAt: '2031-01-01T00:00:00Z',
    },
  };
}
export function day(date = '2030-01-01', offset = '+01:00'): PrayerDay {
  return {
    date,
    times: {
      fajr: `${date}T05:00:00${offset}`,
      dhuhr: `${date}T12:00:00${offset}`,
      asr: `${date}T14:00:00${offset}`,
      maghrib: `${date}T17:00:00${offset}`,
      isha: `${date}T19:00:00${offset}`,
    },
  };
}
export function fixture(days = [day(), day('2030-01-02')]): PrayerCardData {
  return {
    schemaVersion: 1,
    purpose: 'test-fixture',
    timezone: 'Europe/Berlin',
    daily: { ...metadata(), days },
    friday: null,
  };
}
