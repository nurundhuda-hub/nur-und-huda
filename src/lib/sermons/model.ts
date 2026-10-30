export interface ContentApproval {
  status: 'draft' | 'approved';
  revision?: string;
  reviewer?: string;
  reviewedAt?: string;
  sha256?: string;
}
export interface Citation {
  id: string;
  kind: 'quran' | 'hadith' | 'book' | 'web';
  label: string;
  locator: string;
  url?: string;
  verifiedBy: string;
  verifiedAt: string;
}
export interface ContentBlock {
  kind: 'paragraph' | 'quran' | 'hadith';
  text: string;
  citations: string[];
}
export interface RevisionBase {
  id: string;
  revision: string;
  purpose: 'production' | 'test-fixture';
  title: string;
  editedAt: string;
  publishAt: string;
  approval: ContentApproval;
  rights: {
    status: 'confirmed' | 'pending';
    evidenceRef: string;
    attribution: string;
  };
  references: Citation[];
}
export interface SermonRevision extends RevisionBase {
  kind: 'sermon';
  friday: string;
  parts: [ContentBlock[], ContentBlock[]];
  duration: {
    minutes: number;
    reviewedBy: string;
    reviewedAt: string;
    note: string;
  };
  study: { id: string; revision: string };
}
export interface StudyRevision extends RevisionBase {
  kind: 'study';
  sections: { heading: string; blocks: ContentBlock[] }[];
}
/** Separately approved permission to disclose a planned title/date, never its draft. */
export interface ScheduleAnnouncement {
  kind: 'announcement';
  id: string;
  revision: string;
  purpose: 'production' | 'test-fixture';
  friday: string;
  title: string;
  editedAt: string;
  publishAt: string;
  approval: ContentApproval;
}
export interface SermonCatalog {
  sermons: SermonRevision[];
  studies: StudyRevision[];
  announcements: ScheduleAnnouncement[];
  history: {
    kind: ApproveableContent['kind'];
    id: string;
    revision: string;
    sha256: string;
  }[];
}
export type ApproveableContent =
  SermonRevision | StudyRevision | ScheduleAnnouncement;
export interface PublishedSermon {
  sermon: SermonRevision;
  study: StudyRevision;
}
export interface PublicSermonCatalog {
  asOf: string;
  published: PublishedSermon[];
  schedule: {
    date: string;
    status: 'planned' | 'approved' | 'published' | 'unavailable';
    title?: string;
    path?: string;
  }[];
  archive: PublishedSermon[];
}
