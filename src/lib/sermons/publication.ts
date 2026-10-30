import { createHash } from 'node:crypto';
import { adjacentDate, berlinDate, validDate } from '../prayer-times.ts';
import type {
  ApproveableContent,
  ContentBlock,
  RevisionBase,
  SermonCatalog,
  PublicSermonCatalog,
  PublishedSermon,
} from './model.ts';

const text = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;
const slug = (v: unknown) =>
  typeof v === 'string' &&
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) &&
  v.length <= 80;
const rev = (v: unknown) => typeof v === 'string' && /^r[1-9]\d{0,5}$/.test(v);
export function utcInstant(value: string): number {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value.replace('Z', '.000Z')
  )
    throw new Error('Content dates require valid UTC ISO seconds.');
  return Date.parse(value);
}
export function publicBuildInstant(
  value: string | undefined,
  now = Date.now(),
): string {
  const asOf = value ?? new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z');
  if (utcInstant(asOf) > now)
    throw new Error(
      'Future publication clocks are not permitted in a public build.',
    );
  return asOf;
}
const friday = (date: string) =>
  validDate(date) && new Date(`${date}T12:00:00Z`).getUTCDay() === 5;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
/** This identifies reviewed bytes; it neither approves nor authenticates a reviewer. */
export function contentDigest(value: ApproveableContent): string {
  const { approval: _approval, ...body } = value;
  return createHash('sha256').update(canonical(body)).digest('hex');
}
export function revisionSeal(value: ApproveableContent): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
function approved(value: ApproveableContent): boolean {
  return value.approval.status === 'approved';
}
function blocksValid(blocks: ContentBlock[], base: RevisionBase): void {
  if (!Array.isArray(blocks) || !blocks.length)
    throw new Error('Approved content needs nonempty text blocks.');
  for (const block of blocks) {
    if (
      !block ||
      !['paragraph', 'quran', 'hadith'].includes(block.kind) ||
      !text(block.text) ||
      !Array.isArray(block.citations) ||
      new Set(block.citations).size !== block.citations.length
    )
      throw new Error('Invalid text block.');
    for (const id of block.citations)
      if (!base.references.some((ref) => ref.id === id))
        throw new Error('Missing citation.');
    if (
      block.kind !== 'paragraph' &&
      !block.citations.some((id) =>
        base.references.some((ref) => ref.id === id && ref.kind === block.kind),
      )
    )
      throw new Error(
        'Religious evidence requires a matching verified reference.',
      );
  }
}
export function validateCatalog(
  catalog: SermonCatalog,
  allowTestFixtures = false,
): void {
  if (
    !catalog ||
    !['sermons', 'studies', 'announcements', 'history'].every((key) =>
      Array.isArray(catalog[key as keyof SermonCatalog]),
    )
  )
    throw new Error('Invalid content catalog.');
  const all: ApproveableContent[] = [
    ...catalog.sermons,
    ...catalog.studies,
    ...catalog.announcements,
  ];
  const seen = new Set<string>();
  for (const value of all) {
    if (
      !value ||
      !['sermon', 'study', 'announcement'].includes(value.kind) ||
      !slug(value.id) ||
      !rev(value.revision) ||
      !text(value.title) ||
      !(
        value.purpose === 'production' ||
        (allowTestFixtures && value.purpose === 'test-fixture')
      )
    )
      throw new Error(
        'Invalid content identity or test fixture in public catalog.',
      );
    const key = `${value.kind}/${value.id}/${value.revision}`;
    if (seen.has(key)) throw new Error('Duplicate immutable content revision.');
    seen.add(key);
    if (
      utcInstant(value.editedAt) > utcInstant(value.publishAt) ||
      !value.approval ||
      !['draft', 'approved'].includes(value.approval.status)
    )
      throw new Error('Invalid edit/publication state.');
    if (value.kind !== 'study' && !friday(value.friday))
      throw new Error('Sermon/schedule date must be a real Friday.');
    if (!approved(value)) continue; // Draft bodies are never rendered or serialized.
    const a = value.approval;
    if (
      a.revision !== value.revision ||
      !text(a.reviewer) ||
      !a.reviewedAt ||
      utcInstant(a.reviewedAt) < utcInstant(value.editedAt) ||
      utcInstant(a.reviewedAt) > utcInstant(value.publishAt) ||
      a.sha256 !== contentDigest(value)
    )
      throw new Error(
        'Approval is missing, stale, changed or not bound to this revision.',
      );
    if (
      !catalog.history.some(
        (h) =>
          h.kind === value.kind &&
          h.id === value.id &&
          h.revision === value.revision &&
          h.sha256 === revisionSeal(value),
      )
    )
      throw new Error('Approved revision needs its immutable history seal.');
    if (value.kind === 'announcement') continue;
    if (
      !value.rights ||
      value.rights.status !== 'confirmed' ||
      !text(value.rights.evidenceRef) ||
      !text(value.rights.attribution) ||
      !Array.isArray(value.references) ||
      !value.references.length
    )
      throw new Error(
        'Approved publication requires rights evidence and references.',
      );
    const ids = new Set<string>();
    for (const ref of value.references) {
      if (
        !slug(ref.id) ||
        ids.has(ref.id) ||
        !['quran', 'hadith', 'book', 'web'].includes(ref.kind) ||
        !text(ref.label) ||
        !text(ref.locator) ||
        !text(ref.verifiedBy) ||
        utcInstant(ref.verifiedAt) > utcInstant(a.reviewedAt)
      )
        throw new Error('Invalid or unverified reference.');
      ids.add(ref.id);
      if (ref.url) {
        const url = new URL(ref.url);
        if (url.protocol !== 'https:' || url.username || url.password)
          throw new Error('Citation URLs must be credential-free HTTPS.');
      }
    }
    if (value.kind === 'sermon') {
      if (!Array.isArray(value.parts) || value.parts.length !== 2)
        throw new Error('Exactly two khutbah parts are required.');
      value.parts.forEach((part) => blocksValid(part, value));
      const d = value.duration;
      if (
        !d ||
        !Number.isFinite(d.minutes) ||
        d.minutes <= 0 ||
        !text(d.reviewedBy) ||
        !text(d.note) ||
        utcInstant(d.reviewedAt) < utcInstant(value.editedAt) ||
        utcInstant(d.reviewedAt) > utcInstant(a.reviewedAt)
      )
        throw new Error(
          'Duration needs a human reading review, not an inferred word-count approval.',
        );
      const study = catalog.studies.find(
        (s) => s.id === value.study?.id && s.revision === value.study?.revision,
      );
      if (
        !study ||
        !approved(study) ||
        utcInstant(study.publishAt) > utcInstant(value.publishAt)
      )
        throw new Error(
          'Approved sermon needs its exact approved study available no later than publication.',
        );
    } else {
      if (!Array.isArray(value.sections) || !value.sections.length)
        throw new Error('Approved study needs sections.');
      for (const section of value.sections) {
        if (!text(section.heading)) throw new Error('Missing study heading.');
        blocksValid(section.blocks, value);
      }
      for (const kind of ['quran', 'hadith'])
        if (
          !value.sections.some((section) =>
            section.blocks.some((block) => block.kind === kind),
          )
        )
          throw new Error(
            'Approved study requires separately referenced Quran and hadith evidence.',
          );
    }
  }
  const historyIds = new Set<string>();
  for (const h of catalog.history) {
    const key = `${h.kind}/${h.id}/${h.revision}`;
    const item = all.find(
      (value) =>
        value.kind === h.kind &&
        value.id === h.id &&
        value.revision === h.revision,
    );
    if (
      historyIds.has(key) ||
      !item ||
      !approved(item) ||
      revisionSeal(item) !== h.sha256
    )
      throw new Error(
        'Historical revision was deleted, replaced or unapproved. Append a new revision instead.',
      );
    historyIds.add(key);
  }
  for (const [kind, items] of [
    ['sermon', catalog.sermons],
    ['study', catalog.studies],
    ['announcement', catalog.announcements],
  ] as const) {
    if (items.some((item) => item.kind !== kind))
      throw new Error('Content stored in the wrong collection.');
    if (kind !== 'study') {
      const assignments = new Map<string, string>();
      for (const item of items)
        if (approved(item) && 'friday' in item) {
          if (
            assignments.has(item.friday) &&
            assignments.get(item.friday) !== item.id
          )
            throw new Error(
              'Conflicting approved assignments for the same Friday.',
            );
          assignments.set(item.friday, item.id);
        }
    }
    const ordered = [...items].sort(
      (a, b) =>
        a.id.localeCompare(b.id) ||
        Number(a.revision.slice(1)) - Number(b.revision.slice(1)),
    );
    ordered.forEach((item, index) => {
      const previous = ordered[index - 1];
      if (
        previous?.id === item.id &&
        utcInstant(item.publishAt) < utcInstant(previous.publishAt)
      )
        throw new Error(
          'Revision publication chronology must not run backwards.',
        );
      if (
        kind === 'sermon' &&
        previous?.id === item.id &&
        'friday' in item &&
        'friday' in previous &&
        item.friday !== previous.friday
      )
        throw new Error('Sermon identity must retain its original Friday.');
    });
  }
}
export const sermonPath = (id: string, revision: string) =>
  `sermons/${id}/${revision}.html`;
export const studyPath = (id: string, revision: string) =>
  `studies/${id}/${revision}.html`;
export const downloadPath = (id: string, revision: string) =>
  `downloads/sermons/${id}/${revision}.html`;
export function upcomingFridays(asOf: string): string[] {
  const today = berlinDate(utcInstant(asOf));
  const day = new Date(`${today}T12:00:00Z`).getUTCDay();
  const first = adjacentDate(today, (5 - day + 7) % 7);
  return Array.from({ length: 8 }, (_, i) => adjacentDate(first, i * 7));
}
export function selectPublicCatalog(
  catalog: SermonCatalog,
  asOf: string,
  options: { allowTestFixtures?: boolean } = {},
): PublicSermonCatalog {
  validateCatalog(catalog, options.allowTestFixtures);
  const now = utcInstant(asOf),
    today = berlinDate(now);
  const eligible = (value: ApproveableContent) =>
    approved(value) && utcInstant(value.publishAt) <= now;
  const published: PublishedSermon[] = catalog.sermons
    .filter(eligible)
    .map((sermon) => ({
      sermon: structuredClone(sermon),
      study: structuredClone(
        catalog.studies.find(
          (s) =>
            s.id === sermon.study.id && s.revision === sermon.study.revision,
        )!,
      ),
    }));
  const latest = (items: PublishedSermon[]) =>
    items.sort(
      (a, b) =>
        Number(b.sermon.revision.slice(1)) - Number(a.sermon.revision.slice(1)),
    )[0];
  const schedule = upcomingFridays(asOf).map((date) => {
    const item = latest(
      published.filter((item) => item.sermon.friday === date),
    );
    if (item)
      return {
        date,
        status: 'published' as const,
        title: item.sermon.title,
        path: sermonPath(item.sermon.id, item.sermon.revision),
      };
    const announcement = catalog.announcements
      .filter((a) => a.friday === date && eligible(a))
      .sort((a, b) => utcInstant(b.publishAt) - utcInstant(a.publishAt))[0];
    if (!announcement) return { date, status: 'unavailable' as const };
    const ready = catalog.sermons.some(
      (s) => s.id === announcement.id && s.friday === date && approved(s),
    );
    return {
      date,
      status: ready ? ('approved' as const) : ('planned' as const),
      title: announcement.title,
    };
  });
  const archive = [
    ...new Set(
      published
        .filter((item) => item.sermon.friday < today)
        .map((item) => item.sermon.id),
    ),
  ]
    .map((id) => latest(published.filter((item) => item.sermon.id === id))!)
    .sort((a, b) => b.sermon.friday.localeCompare(a.sermon.friday));
  return { asOf, published, schedule, archive };
}
export function releasePaths(release: PublicSermonCatalog) {
  return {
    pages: [
      ...new Set(
        release.published.flatMap(({ sermon, study }) => [
          sermonPath(sermon.id, sermon.revision),
          studyPath(study.id, study.revision),
        ]),
      ),
    ],
    downloads: release.published.map(({ sermon }) =>
      downloadPath(sermon.id, sermon.revision),
    ),
  };
}
