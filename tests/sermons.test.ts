import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sermonCatalog } from '../src/content/sermons';
import {
  publicBuildInstant,
  releasePaths,
  selectPublicCatalog,
  upcomingFridays,
} from '../src/lib/sermons/publication';
import { sermonArticle, studyArticle } from '../src/lib/sermons/render';
import { renderOfflineSermon } from '../src/lib/sermons/offline';
import { readerMarkup } from '../src/lib/sermons/reader-markup';
import {
  sermonFixture,
  sealFixture,
  resealFixtureHistory,
  announcementFixture,
  SERMON_MARKER,
} from './fixtures/sermon-content';

const asOf = '2030-01-01T00:00:00Z';
const select = (catalog = sermonFixture(), time = asOf) =>
  selectPublicCatalog(catalog, time, { allowTestFixtures: true });
const parse = (html: string) =>
  new DOMParser().parseFromString(html, 'text/html');
describe('content approval and publication', () => {
  it('keeps the real catalog empty and the public output free of synthetic/draft bodies', () => {
    expect(sermonCatalog).toEqual({
      sermons: [],
      studies: [],
      announcements: [],
      history: [],
    });
    const manifest = JSON.parse(
      readFileSync('dist/sermon-publication.json', 'utf8'),
    );
    expect(manifest.pages).toEqual([]);
    expect(manifest.downloads).toEqual([]);
    const doc = parse(readFileSync('dist/sermons.html', 'utf8'));
    expect(doc.querySelectorAll('.sermon-schedule li')).toHaveLength(8);
    expect(
      [...doc.querySelectorAll('.sermon-schedule .status')].every(
        (node) => node.textContent === 'لم يُعلن عن خطبة',
      ),
    ).toBe(true);
    expect(doc.querySelector('#archive')).not.toBeNull();
    expect(doc.body.textContent).not.toContain(SERMON_MARKER);
    expect(doc.querySelector('[download]')).toBeNull();
  });
  it('rejects synthetic catalogs in public selection', () => {
    expect(() => selectPublicCatalog(sermonFixture(), asOf)).toThrow(
      /test fixture/,
    );
  });
  it('publishes the exact pair only at the release instant', () => {
    const catalog = sermonFixture();
    expect(select(catalog, '2029-12-27T23:59:59Z').published).toHaveLength(0);
    expect(select(catalog, '2029-12-28T00:00:00Z').published).toHaveLength(1);
    expect(select(catalog).schedule[0]?.status).toBe('published');
  });
  it('rejects future public build clocks while allowing an earlier reproducible snapshot', () => {
    const now = Date.parse(asOf);
    expect(() => publicBuildInstant('2030-01-01T00:00:01Z', now)).toThrow(
      /Future publication/,
    );
    expect(publicBuildInstant(undefined, now)).toBe(asOf);
    expect(publicBuildInstant('2029-12-27T00:00:00Z', now)).toBe(
      '2029-12-27T00:00:00Z',
    );
  });
  it('does not leak unapproved titles, parts or references into projection/routes/downloads', () => {
    const catalog = sermonFixture();
    catalog.sermons[0]!.approval = { status: 'draft' };
    catalog.studies[0]!.approval = { status: 'draft' };
    catalog.history = [];
    const release = select(catalog);
    expect(JSON.stringify(release)).not.toContain(SERMON_MARKER);
    expect(releasePaths(release)).toEqual({ pages: [], downloads: [] });
    expect(() =>
      sermonArticle(release, 'synthetic-only', 'r1', '/nur-und-huda/'),
    ).toThrow();
    expect(() =>
      renderOfflineSermon(release, 'synthetic-only', 'r1'),
    ).toThrow();
  });
  it('requires a separate approved announcement to disclose an embargoed title', () => {
    const catalog = sermonFixture();
    const time = '2029-12-27T12:00:00Z';
    expect(JSON.stringify(select(catalog, time))).not.toContain(SERMON_MARKER);
    catalog.announcements.push(announcementFixture());
    resealFixtureHistory(catalog);
    const result = select(catalog, time);
    expect(
      result.schedule.find((item) => item.date === '2030-01-04'),
    ).toMatchObject({
      status: 'approved',
      title: `${SERMON_MARKER} PUBLIC ANNOUNCEMENT`,
    });
    expect(result.published).toHaveLength(0);
    catalog.sermons[0]!.approval = { status: 'draft' };
    resealFixtureHistory(catalog);
    expect(
      select(catalog, time).schedule.find((item) => item.date === '2030-01-04')
        ?.status,
    ).toBe('planned');
    catalog.announcements[0]!.approval = { status: 'draft' };
    resealFixtureHistory(catalog);
    expect(JSON.stringify(select(catalog, time))).not.toContain(SERMON_MARKER);
  });
  it.each(['title', 'publishAt', 'friday'] as const)(
    'invalidates approval when %s changes',
    (field) => {
      const catalog = sermonFixture();
      catalog.sermons[0]![field] =
        field === 'title'
          ? 'changed'
          : field === 'friday'
            ? '2030-01-11'
            : '2029-12-29T00:00:00Z';
      expect(() => select(catalog)).toThrow(/Approval/);
    },
  );
  it('checks references, rights, duration and both khutbah parts even after a fresh hash', () => {
    const mutations = [
      (c: ReturnType<typeof sermonFixture>) => {
        c.sermons[0]!.references[0]!.url = 'javascript:alert(1)';
      },
      (c: ReturnType<typeof sermonFixture>) => {
        c.sermons[0]!.rights.status = 'pending';
      },
      (c: ReturnType<typeof sermonFixture>) => {
        c.sermons[0]!.parts[1] = [];
      },
      (c: ReturnType<typeof sermonFixture>) => {
        c.sermons[0]!.duration.reviewedBy = '';
      },
      (c: ReturnType<typeof sermonFixture>) => {
        c.sermons[0]!.parts[0][0]!.citations = ['missing'];
      },
      (c: ReturnType<typeof sermonFixture>) => {
        c.studies[0]!.sections[0]!.blocks[1]!.citations = ['book-test'];
      },
    ];
    for (const mutate of mutations) {
      const c = sermonFixture();
      mutate(c);
      c.sermons.forEach(sealFixture);
      c.studies.forEach(sealFixture);
      resealFixtureHistory(c);
      expect(() => select(c)).toThrow();
    }
  });
  it('rejects a missing, unapproved or later-publishing study', () => {
    for (const mode of ['missing', 'draft', 'late']) {
      const c = sermonFixture();
      if (mode === 'missing') c.studies = [];
      if (mode === 'draft') c.studies[0]!.approval = { status: 'draft' };
      if (mode === 'late') {
        c.studies[0]!.publishAt = '2029-12-29T00:00:00Z';
        sealFixture(c.studies[0]!);
      }
      resealFixtureHistory(c);
      expect(() => select(c)).toThrow(/study/);
    }
  });
  it('rejects approval chronology, non-Friday dates and path traversal IDs', () => {
    for (const mutate of [
      (c: ReturnType<typeof sermonFixture>) => {
        c.sermons[0]!.approval.reviewedAt = '2029-12-25T00:00:00Z';
      },
      (c: ReturnType<typeof sermonFixture>) => {
        c.sermons[0]!.approval.reviewedAt = '2029-12-29T00:00:00Z';
      },
      (c: ReturnType<typeof sermonFixture>) => {
        c.sermons[0]!.friday = '2030-01-05';
      },
      (c: ReturnType<typeof sermonFixture>) => {
        c.sermons[0]!.id = '../private';
      },
    ]) {
      const c = sermonFixture();
      mutate(c);
      expect(() => select(c)).toThrow();
    }
    expect(() => select(sermonFixture(), '2030-02-30T00:00:00Z')).toThrow();
  });
  it('retains old approved revisions and rejects deletion or replacement of their seals', () => {
    const c = sermonFixture();
    const second = structuredClone(c.sermons[0]!);
    second.revision = 'r2';
    second.publishAt = '2029-12-29T00:00:00Z';
    second.title = `${SERMON_MARKER} SECOND REVISION`;
    c.sermons.push(sealFixture(second));
    resealFixtureHistory(c);
    const result = select(c, '2030-01-05T00:00:00Z');
    expect(result.published).toHaveLength(2);
    expect(result.archive[0]?.sermon.revision).toBe('r2');
    expect(releasePaths(result).downloads).toHaveLength(2);
    c.sermons[0]!.title = 'edited historical title';
    sealFixture(c.sermons[0]!);
    expect(() => select(c)).toThrow(/history seal/);
    c.sermons.shift();
    expect(() => select(c)).toThrow(/Historical revision/);
  });
  it('computes eight real Fridays in Berlin across DST, leap and year boundaries', () => {
    for (const time of [
      '2027-03-28T00:00:00Z',
      '2027-10-31T00:00:00Z',
      '2028-02-29T12:00:00Z',
      '2029-12-31T23:30:00Z',
    ]) {
      const dates = upcomingFridays(time);
      expect(new Set(dates).size).toBe(8);
      dates.forEach((date) =>
        expect(new Date(`${date}T12:00:00Z`).getUTCDay()).toBe(5),
      );
    }
    expect(upcomingFridays('2030-01-03T23:30:00Z')[0]).toBe('2030-01-04');
    expect(upcomingFridays('2030-01-04T23:30:00Z')[0]).toBe('2030-01-11');
  });
});

describe('published article, study, print and offline output', () => {
  it('renders both parts, exact revision/dates and a real versioned study link safely', () => {
    const release = select();
    const doc = parse(
      sermonArticle(release, 'synthetic-only', 'r1', '/nur-und-huda/'),
    );
    expect(doc.querySelectorAll('.khutbah-part')).toHaveLength(2);
    expect(doc.querySelector('script')).toBeNull();
    expect(doc.body.textContent).toContain('<script>not executable</script>');
    const link = doc.querySelector<HTMLAnchorElement>('.study-link a')!;
    expect(link.textContent).toBe('اقرأ الموضوع كاملاً');
    expect(link.getAttribute('href')).toBe(
      '/nur-und-huda/studies/synthetic-study/r1.html',
    );
    expect(releasePaths(release).pages).toContain(
      link.getAttribute('href')!.slice('/nur-und-huda/'.length),
    );
    expect(
      doc.querySelector('time[datetime="2029-12-28T00:00:00Z"]')?.textContent,
    ).toBe('2029-12-28T00:00:00Z');
    const study = parse(
      studyArticle(release, 'synthetic-study', 'r1', '/nur-und-huda/'),
    );
    expect(
      study.querySelectorAll('.content-quran, .content-hadith'),
    ).toHaveLength(2);
    expect(
      study.querySelector(
        'a[href="/nur-und-huda/sermons/synthetic-only/r1.html"]',
      ),
    ).not.toBeNull();
    for (const document of [doc, study])
      for (const anchor of document.querySelectorAll('a[href^="#"]'))
        expect(
          document.getElementById(anchor.getAttribute('href')!.slice(1)),
        ).not.toBeNull();
  });
  it('creates a self-contained versioned offline artifact with embedded licensed fonts and print rules', () => {
    const release = select();
    const html = renderOfflineSermon(release, 'synthetic-only', 'r1');
    const doc = parse(html);
    expect(doc.documentElement.lang).toBe('ar');
    expect(doc.documentElement.dir).toBe('rtl');
    expect(doc.querySelectorAll('.khutbah-part')).toHaveLength(2);
    expect(doc.querySelectorAll('script,iframe,link,img')).toHaveLength(0);
    expect(doc.querySelector('style')?.textContent).toContain(
      'data:font/woff2;base64,',
    );
    expect(doc.querySelector('style')?.textContent).toContain('@media print');
    expect(doc.body.textContent).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(doc.querySelector('.study-link a')?.getAttribute('href')).toBe(
      'https://nurundhuda-hub.github.io/nur-und-huda/studies/synthetic-study/r1.html',
    );
    expect(html).toBe(renderOfflineSermon(release, 'synthetic-only', 'r1'));
    const ids = [...doc.querySelectorAll('[id]')].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    const css = readFileSync('src/styles/sermons.css', 'utf8');
    expect(css).toContain('@media print');
    expect(css).toContain('[data-sermon-reader]');
  });
  it('keeps reader reference IDs separate from page IDs', () => {
    const release = select();
    const html =
      sermonArticle(release, 'synthetic-only', 'r1', '/nur-und-huda/') +
      readerMarkup(release.published[0]!);
    const doc = parse(html);
    const ids = [...doc.querySelectorAll('[id]')].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of doc.querySelectorAll('a[href^="#"]'))
      expect(
        doc.getElementById(a.getAttribute('href')!.slice(1)),
      ).not.toBeNull();
  });
});
