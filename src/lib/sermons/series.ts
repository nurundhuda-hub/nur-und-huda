import type { PublicSermonCatalog, SermonCatalog } from './model.ts';

export interface SeriesMembership {
  id: string;
  topicId: string;
}
export interface SeriesTopic {
  id: string;
  order: number;
  phaseId: string;
  title: string;
  sermonTitle: string;
  sermonId: string;
  studyId: string;
  studyOutline?: string[];
}
/** Public editorial metadata only. No dates, draft bodies or content approvals. */
export interface EducationalSeries {
  id: string;
  title: string;
  subtitle: string;
  status: 'editorial-plan';
  primarySource: {
    title: string;
    suppliedAttribution: string;
    verification: 'pending-local-copy';
  };
  phases: { id: string; order: number; title: string }[];
  topics: SeriesTopic[];
}
const slug = (s: string) =>
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 80;
const text = (s: string) => typeof s === 'string' && s.trim().length > 0;

export function validateSeries(catalog: SermonCatalog): void {
  const series = catalog.series ?? [];
  if (!Array.isArray(series)) throw new Error('Invalid series collection.');
  const seriesIds = new Set<string>();
  const reserved = new Map<string, SeriesMembership>();
  for (const entry of series) {
    if (
      !slug(entry.id) ||
      seriesIds.has(entry.id) ||
      !text(entry.title) ||
      !text(entry.subtitle) ||
      entry.status !== 'editorial-plan' ||
      !text(entry.primarySource?.title) ||
      !text(entry.primarySource?.suppliedAttribution) ||
      entry.primarySource?.verification !== 'pending-local-copy' ||
      !Array.isArray(entry.phases) ||
      !entry.phases.length ||
      !Array.isArray(entry.topics) ||
      !entry.topics.length
    )
      throw new Error('Invalid editorial series metadata.');
    seriesIds.add(entry.id);
    const phases = new Set<string>();
    entry.phases.forEach((phase, index) => {
      if (
        !slug(phase.id) ||
        phases.has(phase.id) ||
        !text(phase.title) ||
        phase.order !== index + 1
      )
        throw new Error(
          'Series phases require unique IDs and contiguous order.',
        );
      phases.add(phase.id);
    });
    const topics = new Set<string>();
    let previousPhase = 0;
    entry.topics.forEach((topic, index) => {
      const phaseOrder = entry.phases.find(
        (phase) => phase.id === topic.phaseId,
      )?.order;
      if (
        !slug(topic.id) ||
        topics.has(topic.id) ||
        topic.order !== index + 1 ||
        !text(topic.title) ||
        !text(topic.sermonTitle) ||
        !phaseOrder ||
        phaseOrder < previousPhase ||
        !slug(topic.sermonId) ||
        !slug(topic.studyId) ||
        (topic.studyOutline !== undefined &&
          (!Array.isArray(topic.studyOutline) ||
            !topic.studyOutline.length ||
            !topic.studyOutline.every(text)))
      )
        throw new Error(
          'Series topics require unique IDs, ordered phases and contiguous order.',
        );
      topics.add(topic.id);
      previousPhase = phaseOrder;
      for (const key of [
        `sermon/${topic.sermonId}`,
        `study/${topic.studyId}`,
      ]) {
        if (reserved.has(key))
          throw new Error('Series content identities must be unique.');
        reserved.set(key, { id: entry.id, topicId: topic.id });
      }
    });
  }
  for (const record of [...catalog.sermons, ...catalog.studies]) {
    const expected = reserved.get(`${record.kind}/${record.id}`);
    if (!expected && !record.series) continue;
    if (
      !expected ||
      record.series?.id !== expected.id ||
      record.series?.topicId !== expected.topicId
    )
      throw new Error('Content must match its reserved series/topic identity.');
    const topic = series
      .find((s) => s.id === expected.id)!
      .topics.find((t) => t.id === expected.topicId)!;
    if (record.kind === 'sermon' && record.study?.id !== topic.studyId)
      throw new Error('Series sermon must bind the companion study identity.');
    // Exact study revision, human approval and dates are checked by validateCatalog.
  }
}

export const seriesAnchor = (id: string) => `series-${id}`;
export const topicAnchor = (id: string, topicId: string) =>
  `${seriesAnchor(id)}-${topicId}`;

/** Only already released pairs can contribute content links; never inspect drafts. */
export function seriesRoadmap(
  series: EducationalSeries,
  release: PublicSermonCatalog,
) {
  return series.topics.map((topic) => {
    const published = release.published
      .filter(
        ({ sermon, study }) =>
          sermon.id === topic.sermonId &&
          study.id === topic.studyId &&
          sermon.series?.id === series.id &&
          sermon.series.topicId === topic.id &&
          study.series?.id === series.id &&
          study.series.topicId === topic.id,
      )
      .sort(
        (a, b) =>
          Number(b.sermon.revision.slice(1)) -
          Number(a.sermon.revision.slice(1)),
      )[0];
    return { topic, published };
  });
}
