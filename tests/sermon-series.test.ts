import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { educationalSeries } from '../src/content/educational-series';
import { sermonCatalog } from '../src/content/sermons';
import { seriesRoadmap } from '../src/lib/sermons/series';
import {
  releasePaths,
  selectPublicCatalog,
  validateCatalog,
} from '../src/lib/sermons/publication';
import { sermonArticle, studyArticle } from '../src/lib/sermons/render';
import { renderOfflineSermon } from '../src/lib/sermons/offline';
import {
  sermonFixture,
  sealFixture,
  resealFixtureHistory,
  SERMON_MARKER,
} from './fixtures/sermon-content';

const time = '2030-01-01T00:00:00Z';
const select = (catalog: ReturnType<typeof sermonFixture>, asOf = time) =>
  selectPublicCatalog(catalog, asOf, { allowTestFixtures: true });
const parse = (html: string) =>
  new DOMParser().parseFromString(html, 'text/html');

// Only the metadata is real. Bodies, dates and approvals remain explicitly synthetic.
function seriesFixture() {
  const c = sermonFixture();
  c.series = [structuredClone(educationalSeries)];
  const topic = c.series[0]!.topics[0]!;
  const membership = { id: c.series[0]!.id, topicId: topic.id };
  c.sermons[0]!.id = topic.sermonId;
  c.sermons[0]!.series = { ...membership };
  c.sermons[0]!.study.id = topic.studyId;
  c.studies[0]!.id = topic.studyId;
  c.studies[0]!.series = { ...membership };
  c.sermons.forEach(sealFixture);
  c.studies.forEach(sealFixture);
  resealFixtureHistory(c);
  return c;
}

describe('educational series editorial structure', () => {
  it('preserves the supplied title, subtitle, four phases and eight ordered topics', () => {
    expect(educationalSeries.title).toBe('ما لا يسع المسلم جهله');
    expect(educationalSeries.subtitle).toBe('رحلة في تعلم أصول الدين');
    expect(educationalSeries.phases.map((p) => p.title)).toEqual([
      'العقيدة وأصول الإيمان',
      'الطهارة والصلاة',
      'بقية العبادات',
      'المعاملات والأخلاق',
    ]);
    expect(educationalSeries.topics.map((t) => t.title)).toEqual([
      'لنتعلم ديننا على بصيرة — التعريف بالبرنامج ومعنى الإسلام وأركانه',
      'معنى شهادة أن لا إله إلا الله',
      'شروط لا إله إلا الله والعمل بمقتضاها',
      'معنى شهادة أن محمداً رسول الله',
      'أهمية التوحيد وتحقيق العبادة لله',
      'معنى الإيمان وأركانه',
      'الإيمان بالله وملائكته وكتبه ورسله',
      'الإيمان باليوم الآخر والقدر',
    ]);
    expect(educationalSeries.topics[0]!.sermonTitle).toBe(
      'لنتعلم ديننا على بصيرة',
    );
    expect(educationalSeries.primarySource.verification).toBe(
      'pending-local-copy',
    );
    expect(educationalSeries.primarySource).not.toHaveProperty('url');
    expect(educationalSeries.primarySource).not.toHaveProperty('license');
    expect(() => validateCatalog(sermonCatalog)).not.toThrow();
  });

  it('rejects duplicate or out-of-order phases, topics, cross-phase ordering and reused identities', () => {
    const mutations = [
      (c: ReturnType<typeof seriesFixture>) => {
        c.series![0]!.phases.reverse();
      },
      (c: ReturnType<typeof seriesFixture>) => {
        c.series![0]!.phases[1]!.id = 'faith';
      },
      (c: ReturnType<typeof seriesFixture>) => {
        c.series![0]!.topics[1]!.order = 1;
      },
      (c: ReturnType<typeof seriesFixture>) => {
        c.series![0]!.topics[1]!.id = 'introduction';
      },
      (c: ReturnType<typeof seriesFixture>) => {
        c.series![0]!.topics[0]!.phaseId = 'missing';
      },
      (c: ReturnType<typeof seriesFixture>) => {
        c.series![0]!.topics[0]!.phaseId = 'prayer';
      },
      (c: ReturnType<typeof seriesFixture>) => {
        c.series![0]!.topics[1]!.studyId = c.series![0]!.topics[0]!.studyId;
      },
      (c: ReturnType<typeof seriesFixture>) => {
        c.series![0]!.topics[1]!.sermonId = c.series![0]!.topics[0]!.sermonId;
      },
      (c: ReturnType<typeof seriesFixture>) => {
        c.series![0]!.id = '../escape';
      },
    ];
    for (const mutate of mutations) {
      const c = seriesFixture();
      mutate(c);
      expect(() => select(c)).toThrow();
    }
  });

  it('publishes editorial headings without assigning dates or creating content routes', () => {
    const release = selectPublicCatalog(sermonCatalog, time);
    expect(releasePaths(release)).toEqual({ pages: [], downloads: [] });
    expect(release.schedule).toHaveLength(8);
    expect(
      release.schedule.every(
        (slot) => slot.status === 'unavailable' && !slot.title,
      ),
    ).toBe(true);
    expect(
      seriesRoadmap(educationalSeries, release).every((row) => !row.published),
    ).toBe(true);
    const doc = parse(readFileSync('dist/sermons.html', 'utf8'));
    expect(doc.querySelectorAll('.series-phases li')).toHaveLength(4);
    expect(doc.querySelectorAll('.series-topics > li')).toHaveLength(8);
    expect(doc.querySelectorAll('.series-outline li')).toHaveLength(6);
    const roadmap = doc.querySelector('.series-roadmap')!;
    expect(
      roadmap.querySelector(
        'time, [download], .content-quran, .content-hadith',
      ),
    ).toBeNull();
    expect(
      roadmap.querySelector('a[href*="/sermons/"], a[href*="/studies/"]'),
    ).toBeNull();
    expect(roadmap.textContent).toContain(
      'تُعرض المواعيد المعتمدة في برنامج الخطب',
    );
    expect(roadmap.textContent).toContain('ليست دراسة منشورة');
    for (const link of roadmap.querySelectorAll('a[href^="#"]'))
      expect(
        doc.getElementById(link.getAttribute('href')!.slice(1)),
      ).not.toBeNull();
  });
});

describe('series content relationships and approval gates', () => {
  it('rejects missing or mismatched memberships and companion study identities', () => {
    const mutations = [
      (c: ReturnType<typeof seriesFixture>) => {
        delete c.sermons[0]!.series;
      },
      (c: ReturnType<typeof seriesFixture>) => {
        delete c.studies[0]!.series;
      },
      (c: ReturnType<typeof seriesFixture>) => {
        c.sermons[0]!.series!.topicId = 'testimony';
      },
      (c: ReturnType<typeof seriesFixture>) => {
        c.studies[0]!.series!.id = 'unknown';
      },
      (c: ReturnType<typeof seriesFixture>) => {
        c.sermons[0]!.study.id = 'foreign-study';
      },
      (c: ReturnType<typeof seriesFixture>) => {
        c.sermons[0]!.id = 'unreserved-sermon';
      },
    ];
    for (const mutate of mutations) {
      const c = seriesFixture();
      mutate(c);
      c.sermons.forEach(sealFixture);
      c.studies.forEach(sealFixture);
      resealFixtureHistory(c);
      expect(() => select(c)).toThrow(/series|companion/i);
    }
  });

  it('keeps draft and embargoed bodies, links and offline artifacts private despite public topics', () => {
    for (const mode of ['draft', 'embargo']) {
      const c = seriesFixture();
      if (mode === 'draft') {
        c.sermons[0]!.approval = { status: 'draft' };
        c.studies[0]!.approval = { status: 'draft' };
        c.history = [];
      }
      const release = select(
        c,
        mode === 'embargo' ? '2029-12-27T12:00:00Z' : time,
      );
      expect(JSON.stringify(release)).not.toContain(SERMON_MARKER);
      expect(
        seriesRoadmap(c.series![0]!, release)[0]!.published,
      ).toBeUndefined();
      expect(releasePaths(release)).toEqual({ pages: [], downloads: [] });
      expect(() =>
        renderOfflineSermon(release, 'learn-our-religion', 'r1'),
      ).toThrow();
    }
    expect(() => selectPublicCatalog(seriesFixture(), time)).toThrow(
      /test fixture/,
    );
  });

  it('binds exact released study revisions and keeps old versions accessible without modifying text', () => {
    const c = seriesFixture();
    const original = structuredClone(c.sermons[0]!.parts);
    const newerStudy = structuredClone(c.studies[0]!);
    newerStudy.revision = 'r2';
    newerStudy.publishAt = '2029-12-29T00:00:00Z';
    c.studies.push(sealFixture(newerStudy));
    const newerSermon = structuredClone(c.sermons[0]!);
    newerSermon.revision = 'r2';
    newerSermon.publishAt = '2029-12-29T00:00:00Z';
    newerSermon.study.revision = 'r2';
    c.sermons.push(sealFixture(newerSermon));
    resealFixtureHistory(c);
    const release = select(c);
    const row = seriesRoadmap(c.series![0]!, release)[0]!;
    expect(row.published!.sermon.revision).toBe('r2');
    expect(row.published!.study!.revision).toBe('r2');
    expect(release.published[0]!.study!.revision).toBe('r1');
    expect(release.published[0]!.sermon.parts).toEqual(original);
    expect(releasePaths(release).downloads).toHaveLength(2);
    const html = sermonArticle(
      release,
      'learn-our-religion',
      'r1',
      '/nur-und-huda/',
    );
    const doc = parse(html);
    expect(doc.querySelector('.study-link a')!.getAttribute('href')).toBe(
      '/nur-und-huda/studies/learn-our-religion-study/r1.html',
    );
    const overview = parse(readFileSync('dist/sermons.html', 'utf8'));
    for (const output of [
      html,
      studyArticle(release, 'learn-our-religion-study', 'r1', '/nur-und-huda/'),
      renderOfflineSermon(release, 'learn-our-religion', 'r1'),
    ]) {
      const rendered = parse(output);
      const links = rendered.querySelectorAll('.series-context a');
      expect(links).toHaveLength(3); // series, current topic, next topic; no fabricated previous item.
      for (const link of links) {
        const hash = new URL(
          link.getAttribute('href')!,
          'https://example.invalid',
        ).hash.slice(1);
        expect(overview.getElementById(hash)).not.toBeNull();
      }
    }
    c.sermons[0]!.study.revision = 'r99';
    sealFixture(c.sermons[0]!);
    resealFixtureHistory(c);
    expect(() => select(c)).toThrow(/exact approved study/);
  });

  it('invalidates approvals when a series binding changes', () => {
    const c = seriesFixture();
    // Move the entire identity mapping so relational validation still succeeds.
    c.series![0]!.topics[0]!.id = 'renamed-topic';
    c.sermons[0]!.series!.topicId = 'renamed-topic';
    c.studies[0]!.series!.topicId = 'renamed-topic';
    expect(() => select(c)).toThrow(/Approval/);
  });
});
