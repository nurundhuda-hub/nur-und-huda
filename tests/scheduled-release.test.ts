import { describe, expect, it } from 'vitest';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { sermonFixture, SERMON_MARKER } from './fixtures/sermon-content';
import { educationalSeries } from '../src/content/educational-series';
import {
  contentDigest,
  revisionSeal,
  selectPublicCatalog,
  publicBuildInstant,
} from '../src/lib/sermons/publication';
import {
  publicationSchedule,
  publicReleaseManifest,
  checkScheduledRelease,
} from '../src/lib/sermons/scheduled-release';
import { berlinWallTime } from '../src/lib/prayer-calculation/calendar';

function fixture(date = '2026-11-06') {
  const catalog = sermonFixture(),
    schedule = publicationSchedule(date, '08:00');
  const sermon = catalog.sermons[0]!,
    study = catalog.studies[0]!,
    topic = educationalSeries.topics[0]!;
  catalog.series = [educationalSeries];
  sermon.id = topic.sermonId;
  study.id = topic.studyId;
  study.revision = 'r2';
  sermon.study = { id: study.id, revision: 'r2' };
  sermon.friday = date;
  for (const item of [sermon, study]) {
    item.purpose = 'production'; // Isolated synthetic fixture only, never copied into the repository catalog.
    item.series = { id: educationalSeries.id, topicId: topic.id };
    item.editedAt = '2019-01-01T00:00:00Z';
    item.publishAt = schedule.publishAt;
    item.references.forEach((ref) => (ref.verifiedAt = '2019-01-01T00:00:00Z'));
  }
  sermon.duration.reviewedAt = '2019-01-02T00:00:00Z';
  for (const item of [sermon, study])
    item.approval = {
      status: 'approved',
      revision: item.revision,
      reviewer: SERMON_MARKER,
      reviewedAt: '2019-01-03T00:00:00Z',
      sha256: contentDigest(item),
    };
  catalog.history = [sermon, study].map((item) => ({
    kind: item.kind,
    id: item.id,
    revision: item.revision,
    sha256: revisionSeal(item),
  }));
  return {
    catalog,
    schedule,
    expected: {
      publishAt: schedule.publishAt,
      sermon: { id: sermon.id, revision: 'r1' },
      study: { id: study.id, revision: 'r2' },
    },
  };
}
describe('scheduled pair release and static embargo', () => {
  it('converts the actual Friday to UTC independently of host timezone and rejects invalid local dates', () => {
    expect(publicationSchedule('2026-11-06', '08:00').publishAt).toBe(
      '2026-11-06T07:00:00Z',
    );
    expect(publicationSchedule('2026-07-03', '08:00').publishAt).toBe(
      '2026-07-03T06:00:00Z',
    );
    expect(publicationSchedule('2026-10-23', '08:00').publishAt).toBe(
      '2026-10-23T06:00:00Z',
    );
    expect(publicationSchedule('2026-10-30', '08:00').publishAt).toBe(
      '2026-10-30T07:00:00Z',
    );
    expect(() => publicationSchedule('2026-11-05', '08:00')).toThrow(/Friday/);
    expect(() => publicationSchedule('2026-02-30', '08:00')).toThrow();
    expect(() => berlinWallTime('2026-03-29', '02:30')).toThrow(
      /missing or ambiguous/,
    );
    expect(() => berlinWallTime('2026-10-25', '02:30')).toThrow(
      /missing or ambiguous/,
    );
    const script = path.resolve('src/lib/sermons/scheduled-release.ts');
    for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
      const result = execFileSync(
        process.execPath,
        [
          '--experimental-strip-types',
          '--input-type=module',
          '-e',
          `import {publicationSchedule} from ${JSON.stringify(script)}; console.log(publicationSchedule('2026-11-06','08:00').publishAt)`,
        ],
        { env: { ...process.env, TZ: tz }, encoding: 'utf8' },
      );
      expect(result.trim()).toBe('2026-11-06T07:00:00Z');
    }
  });
  it('excludes both revisions and their metadata until the exact instant; rejects stale/future/partial release manifests', () => {
    const f = fixture(),
      before = '2026-11-06T06:59:59Z',
      at = f.schedule.publishAt;
    const pre = publicReleaseManifest(selectPublicCatalog(f.catalog, before));
    expect(pre).toEqual({
      asOf: before,
      pages: [],
      downloads: [],
      releases: [],
    });
    expect(JSON.stringify(pre)).not.toContain(SERMON_MARKER);
    const manifest = publicReleaseManifest(selectPublicCatalog(f.catalog, at));
    expect(manifest.pages).toHaveLength(2);
    expect(manifest.downloads).toHaveLength(1);
    expect(() =>
      checkScheduledRelease(
        f.catalog,
        manifest,
        f.expected,
        Date.parse(before),
      ),
    ).toThrow(/embargo/);
    expect(
      checkScheduledRelease(f.catalog, manifest, f.expected, Date.parse(at)),
    ).toEqual(manifest);
    expect(() =>
      checkScheduledRelease(f.catalog, pre, f.expected, Date.parse(at)),
    ).toThrow(/Rebuild/);
    expect(() =>
      checkScheduledRelease(
        f.catalog,
        { ...manifest, downloads: [] },
        f.expected,
        Date.parse(at),
      ),
    ).toThrow(/differs/);
    expect(() =>
      checkScheduledRelease(
        f.catalog,
        { ...manifest, asOf: '2026-11-06T07:01:00Z' },
        f.expected,
        Date.parse(at),
      ),
    ).toThrow(/future/);
    expect(() =>
      checkScheduledRelease(
        f.catalog,
        manifest,
        { ...f.expected, study: { ...f.expected.study, revision: 'r1' } },
        Date.parse(at),
      ),
    ).toThrow(/Both/);
    expect(() => publicBuildInstant(at, Date.parse(before))).toThrow(/Future/);
  });
  it('builds real Astro output before, at and again before a past synthetic release without retaining future pages', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'nur-embargo-build-'));
    const f = fixture('2020-01-03'),
      before = '2020-01-03T06:59:59Z',
      at = f.schedule.publishAt;
    const original = readFileSync('src/content/sermons.ts');
    try {
      for (const dir of ['src', 'scripts', 'public'])
        cpSync(dir, path.join(root, dir), { recursive: true });
      for (const file of ['astro.config.mjs', 'package.json', 'tsconfig.json'])
        cpSync(file, path.join(root, file));
      symlinkSync(
        path.resolve('node_modules'),
        path.join(root, 'node_modules'),
        'dir',
      );
      writeFileSync(
        path.join(root, 'src/content/sermons.ts'),
        `export const sermonCatalog = ${JSON.stringify(f.catalog)} as import('../lib/sermons/model').SermonCatalog;`,
      );
      const build = (asOf: string) =>
        execFileSync(
          process.execPath,
          [path.resolve('scripts/astro.mjs'), 'build'],
          {
            cwd: root,
            env: {
              ...process.env,
              SERMON_BUILD_AT: asOf,
              ASTRO_TELEMETRY_DISABLED: '1',
            },
            encoding: 'utf8',
            timeout: 60000,
            stdio: 'pipe',
          },
        );
      const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory()
            ? walk(path.join(dir, e.name))
            : [path.join(dir, e.name)],
        );
      const assertEmbargo = () => {
        const files = walk(path.join(root, 'dist'));
        expect(files.filter((file) => file.endsWith('.html'))).toHaveLength(6);
        for (const file of files.filter((file) =>
          /\.(html|json|js|xml|map|txt)$/.test(file),
        ))
          expect(readFileSync(file, 'utf8')).not.toContain(SERMON_MARKER);
        const manifest = JSON.parse(
          readFileSync(path.join(root, 'dist/sermon-publication.json'), 'utf8'),
        );
        expect(manifest.releases).toEqual([]);
        expect(manifest.pages).toEqual([]);
        expect(manifest.downloads).toEqual([]);
        expect(
          existsSync(
            path.join(root, 'dist/sermons/learn-our-religion/r1.html'),
          ),
        ).toBe(false);
      };
      build(before);
      assertEmbargo();
      build(at);
      const manifest = JSON.parse(
        readFileSync(path.join(root, 'dist/sermon-publication.json'), 'utf8'),
      );
      expect(
        checkScheduledRelease(f.catalog, manifest, f.expected, Date.parse(at)),
      ).toEqual(manifest);
      const sermon = readFileSync(
        path.join(root, 'dist', manifest.pages[0]),
        'utf8',
      );
      const study = readFileSync(
        path.join(root, 'dist', manifest.pages[1]),
        'utf8',
      );
      const offline = readFileSync(
        path.join(root, 'dist', manifest.downloads[0]),
        'utf8',
      );
      expect(sermon).toContain('اقرأ الموضوع كاملاً');
      expect(sermon).toContain('data-reader-size');
      expect(sermon).toContain(educationalSeries.title);
      expect(study).toContain('/sermons/learn-our-religion/r1.html');
      expect(study).toContain(SERMON_MARKER);
      expect(offline).toContain('@media print');
      expect(offline).toContain('data:font/woff2');
      build(before);
      assertEmbargo(); // Fresh builds must remove any prior released files.
      expect(readFileSync('src/content/sermons.ts')).toEqual(original);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60000);
});
