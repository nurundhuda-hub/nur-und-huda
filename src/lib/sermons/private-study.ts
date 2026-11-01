import {
  createPrivateSermonDraft,
  sourceDigest,
  type PrivateSermonBundle,
} from './drafts.ts';
import { educationalSeries } from '../../content/educational-series.ts';
import { utcInstant } from './publication.ts';

export const PRIVATE_STUDY_MARKER = 'STUDY_PRIVATE_EDITORIAL_ONLY';
export const STUDY_PREVIEW_PATH = '/nur-und-huda/_review/first-study';
export const STUDY_SOURCE_FILE = 'study-001-approved.md';
export const STUDY_REVISION_FILE = 'study-001-r2.bundle.json';
export interface StudyBlock {
  kind: 'heading' | 'paragraph' | 'ordered' | 'unordered' | 'rule' | 'blank';
  start: number;
  end: number;
  text: string;
  level?: number;
  number?: number;
}
/** Deliberately limited Markdown: headings, bold, paragraphs, lists, dividers.
 * Source offsets retain every byte after UTF-8 decoding; HTML/URLs never execute. */
export function studyBlocks(raw: string): StudyBlock[] {
  const blocks: StudyBlock[] = [];
  let offset = 0;
  for (const line of raw.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const value = line.replace(/\r?\n$/, '');
    const heading = /^(#{1,6}) (.*)$/.exec(value);
    const ordered = /^(\d+)\. (.*)$/.exec(value);
    const unordered = /^- (.*)$/.exec(value);
    const kind = !value.trim()
      ? 'blank'
      : heading
        ? 'heading'
        : value === '---'
          ? 'rule'
          : ordered
            ? 'ordered'
            : unordered
              ? 'unordered'
              : 'paragraph';
    const previous = blocks.at(-1);
    if (kind === 'paragraph' && previous?.kind === 'paragraph') {
      previous.end = offset + line.length;
      previous.text += line;
    } else
      blocks.push({
        kind,
        start: offset,
        end: offset + line.length,
        text: heading?.[2] ?? ordered?.[2] ?? unordered?.[1] ?? line,
        ...(heading ? { level: heading[1]!.length } : {}),
        ...(ordered ? { number: Number(ordered[1]) } : {}),
      });
    offset += line.length;
  }
  if (
    blocks.filter((block) => block.kind === 'heading' && block.level === 1)
      .length !== 1 ||
    blocks.find((block) => block.kind !== 'blank')?.level !== 1
  )
    throw new Error('Study requires one original leading title.');
  return blocks;
}
export interface PrivateStudyRevision {
  schemaVersion: 1;
  warning: typeof PRIVATE_STUDY_MARKER;
  kind: 'private-study';
  id: string;
  revision: 'r2';
  supersedes: 'r1';
  series: { id: string; topicId: string };
  sermon: { id: string; revision: 'r1'; sourceSha256: string };
  importedAt: string;
  editorial: {
    status: 'owner-approved';
    basis: 'Task 18 explicit editorial instruction';
  };
  approval: { status: 'draft' };
  evidence: { references: 'unverified'; rights: 'pending' };
  publishAt: null;
  source: { sha256: string; byteLength: number; rawMarkdown: string };
  blocks: StudyBlock[];
}
export function createPrivateStudyRevision(
  source: Uint8Array,
  sermonSource: Uint8Array,
  bundle: PrivateSermonBundle,
  importedAt: string,
  editorialAcknowledged: boolean,
): PrivateStudyRevision {
  if (!editorialAcknowledged)
    throw new Error(
      'Explicit owner editorial instruction is required; filename is not approval.',
    );
  utcInstant(importedAt);
  const original = createPrivateSermonDraft(
    sermonSource,
    bundle.review,
    educationalSeries,
    bundle.sermon.editedAt,
  );
  if (
    JSON.stringify(original) !== JSON.stringify(bundle) ||
    bundle.sermon.revision !== 'r1' ||
    bundle.study.revision !== 'r1'
  )
    throw new Error('Exact original sermon r1 and study r1 intake required.');
  const raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
    source,
  );
  if (!Buffer.from(raw).equals(Buffer.from(source)))
    throw new Error('Study UTF-8 round trip failed.');
  return {
    schemaVersion: 1,
    warning: PRIVATE_STUDY_MARKER,
    kind: 'private-study',
    id: bundle.study.id,
    revision: 'r2',
    supersedes: 'r1',
    series: bundle.study.series,
    sermon: {
      id: bundle.sermon.id,
      revision: 'r1',
      sourceSha256: sourceDigest(sermonSource),
    },
    importedAt,
    editorial: {
      status: 'owner-approved',
      basis: 'Task 18 explicit editorial instruction',
    },
    approval: { status: 'draft' },
    evidence: { references: 'unverified', rights: 'pending' },
    publishAt: null,
    source: {
      sha256: sourceDigest(source),
      byteLength: source.byteLength,
      rawMarkdown: raw,
    },
    blocks: studyBlocks(raw),
  };
}
