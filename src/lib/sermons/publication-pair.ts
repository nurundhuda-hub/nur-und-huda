import type { ContentBlock, SermonRevision, StudyRevision } from './model.ts';
import {
  createPrivateStudyRevision,
  type PrivateStudyRevision,
} from './private-study.ts';
import { sourceDigest, type PrivateSermonBundle } from './drafts.ts';
import { utcInstant } from './publication.ts';

/** Formatting-only interpretation. Never normalize Arabic letters or diacritics. */
const words = (text: string) =>
  text
    .replace(/\*\*([^\n]+?)\*\*/g, '$1')
    .replaceAll('\r\n', '\n')
    .trim();
const quoteKind = (text: string): ContentBlock['kind'] =>
  text.startsWith('﴿')
    ? 'quran'
    : text.startsWith('«')
      ? 'hadith'
      : 'paragraph';
export function validateStudyPair(
  source: Uint8Array,
  sermonSource: Uint8Array,
  bundle: PrivateSermonBundle,
  study: PrivateStudyRevision,
): void {
  const rebuilt = createPrivateStudyRevision(
    source,
    sermonSource,
    bundle,
    study.importedAt,
    study.editorial?.status === 'owner-approved',
  );
  if (JSON.stringify(rebuilt) !== JSON.stringify(study))
    throw new Error('Study r2 or its exact linked source changed.');
}
/** Preserve source ordering and wording, including list prefixes and draft notes.
 * Quote kinds identify supplied delimiters only, never verification or authenticity. */
export function studyPublicationContent(
  study: PrivateStudyRevision,
): Pick<StudyRevision, 'title' | 'sections'> {
  let title = '';
  const sections: StudyRevision['sections'] = [];
  for (const block of study.blocks) {
    if (block.kind === 'blank') continue;
    if (block.kind === 'heading') {
      if (block.level === 1) title = words(block.text);
      else sections.push({ heading: words(block.text), blocks: [] });
      continue;
    }
    if (!sections.length)
      throw new Error(
        'Study publication mapping requires a supplied section heading before body text.',
      );
    const text = words(study.source.rawMarkdown.slice(block.start, block.end));
    const kind = quoteKind(text);
    sections.at(-1)!.blocks.push({ kind, text, citations: [] });
  }
  if (
    !title ||
    !sections.length ||
    sections.some((section) => !section.blocks.length)
  )
    throw new Error('Study sections must retain their supplied nonempty text.');
  return { title, sections };
}

type PendingSermon = Omit<
  SermonRevision,
  'publishAt' | 'friday' | 'duration'
> & { publishAt: null; friday: null; duration: null };
type PendingStudy = Omit<StudyRevision, 'publishAt'> & { publishAt: null };
export interface PairPreparation {
  warning: 'SERMON_PAIR_PREPARATION_ONLY';
  state: 'blocked-preparation';
  recordedAt: string;
  editorial: {
    basis: 'Task 19 explicit owner decision';
    ownerApprovedAt: null;
    formalApproval: false;
  };
  sources: { sermonSha256: string; studySha256: string };
  candidate: { sermon: PendingSermon; study: PendingStudy };
  pending: readonly string[];
}
export function prepareEditorialPair(
  sermonSource: Uint8Array,
  bundle: PrivateSermonBundle,
  studySource: Uint8Array,
  study: PrivateStudyRevision,
  now: string,
  ownerDecision: boolean,
): PairPreparation {
  if (!ownerDecision)
    throw new Error(
      'Explicit owner editorial decision for both exact revisions is required.',
    );
  utcInstant(now);
  validateStudyPair(studySource, sermonSource, bundle, study);
  const content = studyPublicationContent(study);
  const pendingRights = {
    status: 'pending' as const,
    evidenceRef: '',
    attribution: '',
  };
  const mapPart = (part: ContentBlock[]): ContentBlock[] =>
    part.flatMap((block) =>
      block.text
        .split(/\r?\n\s*\r?\n/)
        .filter((text) => text.trim())
        .map((raw) => {
          const text = words(raw);
          return { kind: quoteKind(text), text, citations: [] };
        }),
    );
  return {
    warning: 'SERMON_PAIR_PREPARATION_ONLY',
    state: 'blocked-preparation',
    recordedAt: now,
    editorial: {
      basis: 'Task 19 explicit owner decision',
      ownerApprovedAt: null,
      formalApproval: false,
    },
    sources: {
      sermonSha256: sourceDigest(sermonSource),
      studySha256: sourceDigest(studySource),
    },
    candidate: {
      sermon: {
        kind: 'sermon',
        id: bundle.sermon.id,
        revision: bundle.sermon.revision,
        title: bundle.sermon.title,
        series: bundle.sermon.series,
        purpose: 'production',
        editedAt: bundle.sermon.editedAt,
        publishAt: null,
        approval: { status: 'draft' },
        rights: { ...pendingRights },
        references: [],
        friday: null,
        duration: null,
        parts: [
          mapPart(bundle.sermon.parts[0]),
          mapPart(bundle.sermon.parts[1]),
        ],
        study: { id: study.id, revision: study.revision },
      },
      study: {
        kind: 'study',
        id: study.id,
        revision: study.revision,
        series: study.series,
        purpose: 'production',
        editedAt: study.importedAt,
        publishAt: null,
        approval: { status: 'draft' },
        rights: { ...pendingRights },
        references: [],
        ...content,
      },
    },
    pending: [
      'Human source/reference/orthography review and verified citation mapping',
      'Reuse-rights evidence and final attribution metadata',
      'Explicit resolution of prior intake blockers and final study review',
      'Human reading-duration and local-context review',
      'Owner-selected Friday and publication instants',
      'Exact-hash formal approval, preparation and separate publication authorization',
    ],
  };
}
