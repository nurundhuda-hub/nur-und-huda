import { createHash } from 'node:crypto';
import {
  PRAYERS,
  berlinDate,
  prayerInstant,
  type PrayerDay,
} from '../prayer-times.ts';
import {
  adjacentDate,
  berlinWallTime,
  requireCivilDate,
} from '../prayer-calculation/calendar.ts';

export const LOCAL_REVIEW_MARKER =
  'LOCAL_TIMETABLE_REVIEW_ONLY_NOT_FOR_WORSHIP';
export interface TimetableManifest {
  schemaVersion: 1;
  purpose: 'authorized-source' | 'test-fixture';
  timezone: 'Europe/Berlin';
  source: {
    id: string;
    label: string;
    url: string;
    publisher: string;
    mosqueName: string;
    address: string;
    revision: string;
    issuedAt: string;
    acquiredAt: string;
    identity: {
      status: 'verified';
      evidenceRef: string;
      verifiedBy: string;
      verifiedAt: string;
    };
  };
  timeMeaning: { kind: 'prayer-entry' | 'adhan'; evidenceRef: string };
  permission: {
    status: 'granted';
    evidenceRef: string;
    grantedBy: string;
    grantedAt: string;
    validUntil: string;
    scopes: ('local-review' | 'public-display')[];
    attribution: string;
    restrictions: string;
  };
  coverage: { from: string; through: string };
  validity: { validFrom: string; expiresAt: string };
  input: { format: 'csv' | 'json'; sha256: string };
}
export interface TimetableReview {
  warning: typeof LOCAL_REVIEW_MARKER;
  purpose: 'review-only';
  manifest: TimetableManifest;
  importedAt: string;
  approval: { status: 'pending' };
  freshness: 'current' | 'not-yet-valid' | 'stale';
  days: PrayerDay[];
  normalizedSha256: string;
  hospitalFriday: null;
}
const prayers = PRAYERS.map(({ id }) => id);
const MAX_BYTES = 2 * 1024 * 1024;
export const sha256 = (input: string | Uint8Array): string =>
  createHash('sha256').update(input).digest('hex');

/** Reject ambiguous duplicate JSON keys, including differently escaped names. */
export function parseStrictJson(input: string): unknown {
  const parsed: unknown = JSON.parse(input);
  const stack: (Set<string> | null)[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '{') stack.push(new Set());
    else if (ch === '[') stack.push(null);
    else if (ch === '}' || ch === ']') stack.pop();
    else if (ch === '"') {
      const start = i++;
      while (input[i] !== '"') {
        if (input[i] === '\\') i++;
        i++;
      }
      let next = i + 1;
      while (/\s/.test(input[next] ?? 'x')) next++;
      if (input[next] === ':') {
        const key = JSON.parse(input.slice(start, i + 1)) as string;
        const keys = stack.at(-1)!;
        if (keys.has(key)) throw new Error('Duplicate JSON key.');
        keys.add(key);
      }
    }
  }
  return parsed;
}

function object(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw new Error(`Expected exactly these fields: ${keys.join(', ')}`);
  }
  return value as Record<string, unknown>;
}
function text(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > 500 ||
    /[\u0000-\u001f]/.test(value)
  )
    throw new Error('Metadata requires nonempty bounded text.');
}
function utc(value: unknown): number {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value.replace('Z', '.000Z')
  )
    throw new Error(
      'Metadata timestamps require valid UTC YYYY-MM-DDTHH:mm:ssZ.',
    );
  return Date.parse(value);
}
function manifestValue(
  value: unknown,
  now: number,
  allowTestFixtures: boolean,
): TimetableManifest {
  const m = object(value, [
    'schemaVersion',
    'purpose',
    'timezone',
    'source',
    'timeMeaning',
    'permission',
    'coverage',
    'validity',
    'input',
  ]);
  if (
    m.schemaVersion !== 1 ||
    m.timezone !== 'Europe/Berlin' ||
    !(
      m.purpose === 'authorized-source' ||
      (allowTestFixtures && m.purpose === 'test-fixture')
    )
  )
    throw new Error('Unsupported schema, timezone or fixture purpose.');
  const s = object(m.source, [
    'id',
    'label',
    'url',
    'publisher',
    'mosqueName',
    'address',
    'revision',
    'issuedAt',
    'acquiredAt',
    'identity',
  ]);
  for (const key of [
    'id',
    'label',
    'url',
    'publisher',
    'mosqueName',
    'address',
    'revision',
  ])
    text(s[key]);
  if (
    (s.id as string).length > 200 ||
    (s.label as string).length > 200 ||
    (s.revision as string).length > 200
  )
    throw new Error(
      'Source IDs/labels/revisions must fit public metadata limits.',
    );
  const url = new URL(s.url as string);
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('Source URL must be HTTPS without credentials.');
  const issued = utc(s.issuedAt),
    acquired = utc(s.acquiredAt);
  if (issued > acquired || acquired > now)
    throw new Error(
      'Source issue/acquisition timestamps are inconsistent or in the future.',
    );
  const identity = object(s.identity, [
    'status',
    'evidenceRef',
    'verifiedBy',
    'verifiedAt',
  ]);
  if (identity.status !== 'verified')
    throw new Error('Mosque identity/location require verification evidence.');
  text(identity.evidenceRef);
  text(identity.verifiedBy);
  if (utc(identity.verifiedAt) > now)
    throw new Error('Identity verification cannot be in the future.');
  const meaning = object(m.timeMeaning, ['kind', 'evidenceRef']);
  if (!['prayer-entry', 'adhan'].includes(meaning.kind as string))
    throw new Error(
      'Unknown/iqama/mixed times cannot enter the daily prayer timetable.',
    );
  text(meaning.evidenceRef);
  const permission = object(m.permission, [
    'status',
    'evidenceRef',
    'grantedBy',
    'grantedAt',
    'validUntil',
    'scopes',
    'attribution',
    'restrictions',
  ]);
  if (permission.status !== 'granted')
    throw new Error('Documented permission is required before import.');
  for (const key of ['evidenceRef', 'grantedBy', 'attribution', 'restrictions'])
    text(permission[key]);
  if (
    utc(permission.grantedAt) > now ||
    utc(permission.validUntil) <= now ||
    utc(permission.grantedAt) >= utc(permission.validUntil)
  )
    throw new Error('Permission is not currently valid.');
  if (
    !Array.isArray(permission.scopes) ||
    !permission.scopes.includes('local-review') ||
    new Set(permission.scopes).size !== permission.scopes.length ||
    permission.scopes.some(
      (scope) => !['local-review', 'public-display'].includes(scope),
    )
  )
    throw new Error('Explicit local-review permission scope is required.');
  const coverage = object(m.coverage, ['from', 'through']);
  requireCivilDate(coverage.from as string);
  requireCivilDate(coverage.through as string);
  const count =
    (Date.parse(`${coverage.through}T12:00:00Z`) -
      Date.parse(`${coverage.from}T12:00:00Z`)) /
      86400000 +
    1;
  if (!Number.isInteger(count) || count < 1 || count > 370)
    throw new Error('Coverage must span 1–370 consecutive civil dates.');
  const validity = object(m.validity, ['validFrom', 'expiresAt']);
  const start = utc(validity.validFrom),
    end = utc(validity.expiresAt);
  if (
    start >= end ||
    start < Date.parse(berlinWallTime(coverage.from as string, '00:00')) ||
    end >
      Date.parse(
        berlinWallTime(adjacentDate(coverage.through as string, 1), '00:00'),
      ) ||
    end > utc(permission.validUntil)
  )
    throw new Error(
      'Validity must lie within supplied date coverage and permission expiry.',
    );
  const input = object(m.input, ['format', 'sha256']);
  if (
    !['csv', 'json'].includes(input.format as string) ||
    typeof input.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(input.sha256)
  )
    throw new Error('Specify input format and exact SHA-256.');
  return structuredClone(value) as TimetableManifest;
}

/** Strict comma-separated canonical CSV, including quoted cells and CRLF/BOM. */
function csvRows(input: string): unknown[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let closed = false;
  const finishCell = () => {
    row.push(cell);
    cell = '';
    closed = false;
  };
  const finishRow = () => {
    finishCell();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += ch;
    } else if (ch === ',') finishCell();
    else if (ch === '\r' || ch === '\n') {
      if (ch === '\r') {
        if (input[++i] !== '\n') throw new Error('CSV requires LF or CRLF.');
      }
      finishRow();
    } else if (ch === '"' && !cell && !closed) quoted = true;
    else {
      if (closed || ch === '"') throw new Error('Malformed CSV quoting.');
      cell += ch;
    }
  }
  if (quoted) throw new Error('Unclosed CSV quote.');
  if (cell || row.length || closed) finishRow();
  const header = rows.shift();
  if (JSON.stringify(header) !== JSON.stringify(['date', ...prayers]))
    throw new Error(
      'CSV header must be date,fajr,dhuhr,asr,maghrib,isha; map publisher columns explicitly.',
    );
  return rows.map((values) => {
    if (values.length !== 6)
      throw new Error('Every CSV row must contain exactly six cells.');
    return {
      date: values[0],
      times: Object.fromEntries(prayers.map((id, i) => [id, values[i + 1]])),
    };
  });
}

/** No network, no repairs, no calculated fallback and no public approval. */
export function importTimetable(
  bytes: Uint8Array,
  manifest: unknown,
  options: { now?: number; allowTestFixtures?: boolean } = {},
): TimetableReview {
  const now = options.now ?? Date.now();
  if (!Number.isFinite(new Date(now).getTime()))
    throw new Error('Invalid review clock.');
  const m = manifestValue(manifest, now, options.allowTestFixtures === true);
  if (!bytes.length || bytes.length > MAX_BYTES)
    throw new Error('Input size must be 1 byte–2 MiB.');
  if (sha256(bytes) !== m.input.sha256)
    throw new Error(
      'Input checksum does not match its permission/source manifest.',
    );
  const input = new TextDecoder('utf-8', { fatal: true })
    .decode(bytes)
    .replace(/^\uFEFF/, '');
  const raw: unknown =
    m.input.format === 'csv' ? csvRows(input) : parseStrictJson(input);
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 370)
    throw new Error('Expected 1–370 timetable rows.');
  const dates = new Set<string>();
  const days: PrayerDay[] = raw
    .map((value) => {
      const row = object(value, ['date', 'times']);
      requireCivilDate(row.date as string);
      const date = row.date as string;
      if (dates.has(date)) throw new Error(`Duplicate date: ${date}`);
      dates.add(date);
      const cells = object(row.times, prayers);
      const times = {} as PrayerDay['times'];
      let previous = -Infinity;
      for (const id of prayers) {
        const cell = cells[id];
        if (typeof cell !== 'string')
          throw new Error(`Missing/string-only time: ${date}/${id}`);
        let at: string;
        const local = /^(\d{2}:\d{2})(\+1)?$/.exec(cell);
        if (local) {
          if (local[2] && id !== 'isha')
            throw new Error('Only Isha may use an explicit next-day suffix.');
          at = berlinWallTime(
            local[2] ? adjacentDate(date, 1) : date,
            local[1]!,
          );
        } else {
          const epoch = prayerInstant(cell);
          if (epoch === null)
            throw new Error(`Invalid Berlin timestamp: ${date}/${id}`);
          at = new Date(epoch).toISOString();
        }
        const epoch = Date.parse(at),
          localDate = berlinDate(epoch);
        if (
          epoch <= previous ||
          (localDate !== date &&
            !(id === 'isha' && localDate === adjacentDate(date, 1)))
        )
          throw new Error(
            `Invalid prayer chronology/local date: ${date}/${id}`,
          );
        times[id] = at;
        previous = epoch;
      }
      return { date, times };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  let expected = m.coverage.from;
  days.forEach((day, index) => {
    if (day.date !== expected || day.date > m.coverage.through)
      throw new Error(`Missing/out-of-range coverage at ${expected}`);
    if (
      index > 0 &&
      Date.parse(days[index - 1]!.times.isha) >= Date.parse(day.times.fajr)
    )
      throw new Error('Previous Isha must precede the following Fajr.');
    expected = adjacentDate(expected, 1);
  });
  if (days.at(-1)!.date !== m.coverage.through)
    throw new Error('Incomplete coverage through the requested end date.');
  return {
    warning: LOCAL_REVIEW_MARKER,
    purpose: 'review-only',
    manifest: m,
    importedAt: new Date(now).toISOString(),
    approval: { status: 'pending' },
    freshness:
      now < Date.parse(m.validity.validFrom)
        ? 'not-yet-valid'
        : now >= Date.parse(m.validity.expiresAt)
          ? 'stale'
          : 'current',
    days,
    normalizedSha256: sha256(JSON.stringify(days)),
    hospitalFriday: null,
  };
}
