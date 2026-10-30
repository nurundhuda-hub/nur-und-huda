import type {
  ApproveableContent,
  SermonCatalog,
  SermonRevision,
  StudyRevision,
  ScheduleAnnouncement,
} from '../../src/lib/sermons/model';
import { contentDigest, revisionSeal } from '../../src/lib/sermons/publication';
export const SERMON_MARKER = 'SERMON_TEST_ONLY_NOT_RELIGIOUS_CONTENT';
/** Synthetic software review only, never approval of religious content. */
export function sealFixture<T extends ApproveableContent>(value: T): T {
  value.approval = {
    status: 'approved',
    revision: value.revision,
    reviewer: SERMON_MARKER,
    reviewedAt: '2029-12-27T00:00:00Z',
    sha256: contentDigest(value),
  };
  return value;
}
export function resealFixtureHistory(catalog: SermonCatalog): void {
  catalog.history = [
    ...catalog.sermons,
    ...catalog.studies,
    ...catalog.announcements,
  ]
    .filter((item) => item.approval.status === 'approved')
    .map((item) => ({
      kind: item.kind,
      id: item.id,
      revision: item.revision,
      sha256: revisionSeal(item),
    }));
}
export function sermonFixture(): SermonCatalog {
  const common = {
    id: 'synthetic-only',
    revision: 'r1',
    purpose: 'test-fixture' as const,
    title: SERMON_MARKER,
    editedAt: '2029-12-26T00:00:00Z',
    publishAt: '2029-12-28T00:00:00Z',
    approval: { status: 'draft' as const },
    rights: {
      status: 'confirmed' as const,
      evidenceRef: SERMON_MARKER,
      attribution: SERMON_MARKER,
    },
    references: [
      {
        id: 'book-test',
        kind: 'book' as const,
        label: SERMON_MARKER,
        locator: 'TEST LOCATOR — NOT A REAL REFERENCE',
        url: 'https://example.invalid/reference',
        verifiedBy: SERMON_MARKER,
        verifiedAt: '2029-12-26T00:00:00Z',
      },
    ],
  };
  const sermon: SermonRevision = {
    ...structuredClone(common),
    kind: 'sermon',
    friday: '2030-01-04',
    parts: [
      [
        {
          kind: 'paragraph',
          text: `${SERMON_MARKER} FIRST PART <script>not executable</script>`,
          citations: ['book-test'],
        },
      ],
      [
        {
          kind: 'paragraph',
          text: `${SERMON_MARKER} SECOND PART`,
          citations: ['book-test'],
        },
      ],
    ],
    duration: {
      minutes: 10,
      reviewedBy: SERMON_MARKER,
      reviewedAt: '2029-12-27T00:00:00Z',
      note: 'SYNTHETIC duration check only',
    },
    study: { id: 'synthetic-study', revision: 'r1' },
  };
  const study: StudyRevision = {
    ...structuredClone(common),
    id: 'synthetic-study',
    kind: 'study',
    references: [
      ...common.references,
      ...(['quran', 'hadith'] as const).map((kind) => ({
        id: `${kind}-test`,
        kind,
        label: SERMON_MARKER,
        locator: 'SYNTHETIC — NO RELIGIOUS REFERENCE',
        verifiedBy: SERMON_MARKER,
        verifiedAt: '2029-12-26T00:00:00Z',
      })),
    ],
    sections: [
      {
        heading: 'SYNTHETIC EXPLANATION',
        blocks: [
          {
            kind: 'paragraph',
            text: `${SERMON_MARKER} Explanation`,
            citations: ['book-test'],
          },
          {
            kind: 'quran',
            text: `${SERMON_MARKER} Evidence slot test; NOT a Quran quotation.`,
            citations: ['quran-test'],
          },
          {
            kind: 'hadith',
            text: `${SERMON_MARKER} Evidence slot test; NOT a hadith.`,
            citations: ['hadith-test'],
          },
        ],
      },
    ],
  };
  const catalog: SermonCatalog = {
    sermons: [sealFixture(sermon)],
    studies: [sealFixture(study)],
    announcements: [],
    history: [],
  };
  resealFixtureHistory(catalog);
  return catalog;
}
export function announcementFixture(): ScheduleAnnouncement {
  return sealFixture({
    kind: 'announcement',
    id: 'synthetic-only',
    revision: 'r1',
    purpose: 'test-fixture',
    title: `${SERMON_MARKER} PUBLIC ANNOUNCEMENT`,
    friday: '2030-01-04',
    editedAt: '2029-12-26T00:00:00Z',
    publishAt: '2029-12-27T00:00:00Z',
    approval: { status: 'draft' },
  });
}
