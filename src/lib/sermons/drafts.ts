import { createHash } from 'node:crypto';
import type { ContentBlock, RevisionBase } from './model.ts';
import type { EducationalSeries, SeriesMembership } from './series.ts';
import { utcInstant } from './publication.ts';

export const PRIVATE_SERMON_MARKER = 'SERMON_PRIVATE_REVIEW_ONLY';
export interface SourceSpan {
  start: number;
  end: number;
}
/** A research observation, never the human-verified Citation used for publication. */
export interface ReferenceCheck {
  id: string;
  kind: 'quran' | 'hadith' | 'book';
  locator: string;
  url: string;
  finding:
    | 'wording-supported'
    | 'excerpt-supported'
    | 'wording-variant'
    | 'attribution-only';
  note: string;
}
export interface DraftIntakeReview {
  sourceSha256: string;
  checkedAt: string;
  series: SeriesMembership;
  revision: string;
  references: ReferenceCheck[];
  sections: {
    heading: string;
    note: string;
    excerpts: (SourceSpan & { citations: string[] })[];
  }[];
  blockers: string[];
}
type PrivateMetadata = Pick<
  RevisionBase,
  'id' | 'revision' | 'title' | 'editedAt'
> & {
  series: SeriesMembership;
  purpose: 'private-review';
  approval: { status: 'draft' };
  publishAt: null;
  rights: { status: 'pending'; evidenceRef: null; attribution: null };
  references: ReferenceCheck[];
};
export type PrivateSermonDraft = PrivateMetadata & {
  kind: 'sermon';
  friday: null;
  duration: null;
  format: 'supplied-markdown-verbatim';
  parts: [ContentBlock[], ContentBlock[]];
  study: { id: string; revision: string };
};
export type PrivateStudyDraft = PrivateMetadata & {
  kind: 'study';
  completeness: 'partial-source-compilation';
  sections: {
    heading: string;
    note: string;
    blocks: ContentBlock[];
    sourceSpans: SourceSpan[];
  }[];
};
export interface PrivateSermonBundle {
  schemaVersion: 1;
  warning: typeof PRIVATE_SERMON_MARKER;
  source: {
    sha256: string;
    byteLength: number;
    rawText: string;
    partSpans: [SourceSpan, SourceSpan];
  };
  review: DraftIntakeReview;
  sermon: PrivateSermonDraft;
  study: PrivateStudyDraft;
}
const text = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;
const slug = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
export const sourceDigest = (source: Uint8Array): string =>
  createHash('sha256').update(source).digest('hex');

/** Offsets use JS UTF-16 indices, not byte offsets. Nothing is normalized or trimmed. */
export function splitSuppliedSermon(rawText: string): [SourceSpan, SourceSpan] {
  const first = [...rawText.matchAll(/^### الخطبة الأولى\r?$/gm)];
  const second = [...rawText.matchAll(/^### الخطبة الثانية\r?$/gm)];
  if (
    first.length !== 1 ||
    second.length !== 1 ||
    first[0]!.index >= second[0]!.index
  )
    throw new Error(
      'Supply exactly one ordered heading for each khutbah part. No text was changed.',
    );
  const firstStart = first[0]!.index + first[0]![0].length + 1;
  const secondStart = second[0]!.index + second[0]![0].length + 1;
  const separator = /(?:\r?\n)---(?:\r?\n){2}$/.exec(
    rawText.slice(0, second[0]!.index),
  );
  if (!separator)
    throw new Error(
      'Expected the supplied separator before the second khutbah.',
    );
  const spans: [SourceSpan, SourceSpan] = [
    { start: firstStart, end: separator.index },
    { start: secondStart, end: rawText.length },
  ];
  if (
    spans.some(
      ({ start, end }) => end <= start || !rawText.slice(start, end).trim(),
    )
  )
    throw new Error('Both supplied khutbah parts must be nonempty.');
  return spans;
}

export function createPrivateSermonDraft(
  bytes: Uint8Array,
  review: DraftIntakeReview,
  series: EducationalSeries,
  importedAt: string,
): PrivateSermonBundle {
  // Fatal decoding and a byte round trip prevent silent replacement of Arabic text.
  const rawText = new TextDecoder('utf-8', {
    fatal: true,
    ignoreBOM: true,
  }).decode(bytes);
  if (!Buffer.from(rawText, 'utf8').equals(Buffer.from(bytes)))
    throw new Error('UTF-8 round trip failed.');
  const sha256 = sourceDigest(bytes);
  if (!review || review.sourceSha256 !== sha256)
    throw new Error('Review must match the exact source SHA-256.');
  if (
    Object.keys(review).some(
      (key) =>
        ![
          'sourceSha256',
          'checkedAt',
          'series',
          'revision',
          'references',
          'sections',
          'blockers',
        ].includes(key),
    )
  )
    throw new Error(
      'Unexpected review fields; dates and approvals are not intake options.',
    );
  if (utcInstant(review.checkedAt) > utcInstant(importedAt))
    throw new Error('Research check cannot be after import.');
  if (!/^r[1-9]\d{0,5}$/.test(review.revision))
    throw new Error('Invalid draft revision.');
  const topic = series.topics.find((t) => t.id === review.series?.topicId);
  if (review.series?.id !== series.id || !topic)
    throw new Error('Unknown series/topic binding.');
  const partSpans = splitSuppliedSermon(rawText);
  if (!Array.isArray(review.references) || !review.references.length)
    throw new Error('Reference checks are required.');
  const refIds = new Set<string>();
  for (const ref of review.references) {
    if (
      !slug(ref.id) ||
      refIds.has(ref.id) ||
      !['quran', 'hadith', 'book'].includes(ref.kind) ||
      ![
        'wording-supported',
        'excerpt-supported',
        'wording-variant',
        'attribution-only',
      ].includes(ref.finding) ||
      !text(ref.locator) ||
      !text(ref.note)
    )
      throw new Error('Invalid research reference.');
    const url = new URL(ref.url);
    if (url.protocol !== 'https:' || url.username || url.password)
      throw new Error('Research links require credential-free HTTPS.');
    refIds.add(ref.id);
  }
  if (
    !Array.isArray(review.sections) ||
    !review.sections.length ||
    !Array.isArray(review.blockers) ||
    !review.blockers.length ||
    !review.blockers.every(text)
  )
    throw new Error(
      'Study sections and outstanding review blockers are required.',
    );
  const sections = review.sections.map((section) => {
    if (
      !text(section.heading) ||
      !text(section.note) ||
      !Array.isArray(section.excerpts)
    )
      throw new Error(
        'Study sections require headings and explicit review notes.',
      );
    const blocks: ContentBlock[] = section.excerpts.map((span) => {
      if (
        !Number.isInteger(span.start) ||
        !Number.isInteger(span.end) ||
        span.end <= span.start ||
        !partSpans.some(
          (part) => span.start >= part.start && span.end <= part.end,
        ) ||
        !Array.isArray(span.citations) ||
        new Set(span.citations).size !== span.citations.length ||
        !span.citations.every((id) => refIds.has(id)) ||
        !rawText.slice(span.start, span.end).trim()
      )
        throw new Error(
          'Study excerpts must be exact body spans with known research references.',
        );
      // Plain source excerpt: this does not label it human-verified scripture or commentary.
      return {
        kind: 'paragraph',
        text: rawText.slice(span.start, span.end),
        citations: [...span.citations],
      };
    });
    return {
      heading: section.heading,
      note: section.note,
      blocks,
      sourceSpans: section.excerpts.map(({ start, end }) => ({ start, end })),
    };
  });
  const common = {
    revision: review.revision,
    series: { id: series.id, topicId: topic.id },
    purpose: 'private-review' as const,
    editedAt: importedAt,
    approval: { status: 'draft' as const },
    publishAt: null,
    rights: {
      status: 'pending' as const,
      evidenceRef: null,
      attribution: null,
    },
    references: structuredClone(review.references),
  };
  const part = ({ start, end }: SourceSpan): ContentBlock[] => [
    { kind: 'paragraph', text: rawText.slice(start, end), citations: [] },
  ];
  return {
    schemaVersion: 1,
    warning: PRIVATE_SERMON_MARKER,
    source: { sha256, byteLength: bytes.length, rawText, partSpans },
    review: structuredClone(review),
    sermon: {
      ...structuredClone(common),
      kind: 'sermon',
      id: topic.sermonId,
      title: topic.sermonTitle,
      friday: null,
      duration: null,
      format: 'supplied-markdown-verbatim',
      parts: [part(partSpans[0]), part(partSpans[1])],
      study: { id: topic.studyId, revision: review.revision },
    },
    study: {
      ...structuredClone(common),
      kind: 'study',
      id: topic.studyId,
      title: topic.sermonTitle,
      completeness: 'partial-source-compilation',
      sections,
    },
  };
}
