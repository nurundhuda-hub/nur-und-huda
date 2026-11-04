import { describe, expect, it } from 'vitest';
import { sermonFixture } from './fixtures/sermon-content';
import { workflowDigest } from '../src/lib/sermons/approval-workflow';
import {
  selectPrivateCatalog,
  type PrivateReleaseGrant,
} from '../src/lib/sermons/private-release';
import { selectPublicCatalog } from '../src/lib/sermons/publication';
import {
  checkScheduledRelease,
  publicReleaseManifest,
} from '../src/lib/sermons/scheduled-release';
import { renderOfflineSermon } from '../src/lib/sermons/offline';

const now = '2029-12-27T12:00:00Z';
function fixture() {
  const catalog = sermonFixture();
  const body = {
    audience: 'private-group' as const,
    origin: 'https://nour-und-huda.web.app' as const,
    authorizedAt: now,
    authorization: 'SYNTHETIC owner instruction for private group only',
    catalogSha256: workflowDigest(catalog),
    contentApprovalSha256: 'a'.repeat(64),
    sources: { sermonSha256: 'b'.repeat(64), studySha256: 'c'.repeat(64) },
    sermon: { id: catalog.sermons[0]!.id, revision: 'r1' },
    study: { id: catalog.studies[0]!.id, revision: 'r1' },
  };
  return { catalog, grant: { ...body, sha256: workflowDigest(body) } };
}
function select(
  catalog: ReturnType<typeof sermonFixture>,
  grant: PrivateReleaseGrant,
  groupBuild = true,
) {
  return selectPrivateCatalog(catalog, grant, now, {
    groupBuild,
    allowTestFixtures: true,
  });
}
describe('separate private-group publication authorization', () => {
  it('makes only the approved pair available without changing its hashes or public embargo', () => {
    const { catalog, grant } = fixture(),
      before = workflowDigest(catalog);
    const release = select(catalog, grant);
    expect(release.published).toHaveLength(1);
    expect(workflowDigest(catalog)).toBe(before);
    expect(
      selectPublicCatalog(catalog, now, { allowTestFixtures: true }).published,
    ).toHaveLength(0);
    expect(publicReleaseManifest(release).audience).toBe('private-group');
    expect(renderOfflineSermon(release, grant.sermon.id, 'r1')).toContain(
      'https://nour-und-huda.web.app/nur-und-huda/',
    );
    expect(renderOfflineSermon(release, grant.sermon.id, 'r1')).not.toContain(
      'https://nurundhuda-hub.github.io',
    );
  });
  it('rejects public builds, changed content, broken grants, later revisions and future authorization', () => {
    const { catalog, grant } = fixture();
    expect(() => select(catalog, grant, false)).toThrow();
    for (const edited of [
      { ...grant, sha256: '0'.repeat(64) },
      { ...grant, authorizedAt: '2031-01-01T00:00:00Z' },
      { ...grant, sermon: { ...grant.sermon, revision: 'r2' } },
    ])
      expect(() => select(catalog, edited)).toThrow();
    catalog.sermons[0]!.parts[0][0]!.text += ' edited';
    expect(() => select(catalog, grant)).toThrow();
  });
  it('rejects drafts even if an authorization digest is regenerated', () => {
    const { catalog, grant } = fixture();
    catalog.sermons[0]!.approval = { status: 'draft' };
    catalog.history = catalog.history.filter((h) => h.kind !== 'sermon');
    const { sha256: _, ...body } = {
      ...grant,
      catalogSha256: workflowDigest(catalog),
    };
    expect(() =>
      select(catalog, { ...body, sha256: workflowDigest(body) }),
    ).toThrow();
  });
  it('never accepts a private artifact in the public release validator, even after the embargo', () => {
    const { catalog, grant } = fixture();
    const release = select(catalog, grant);
    expect(() =>
      checkScheduledRelease(
        catalog,
        publicReleaseManifest(release),
        {
          publishAt: catalog.sermons[0]!.publishAt,
          sermon: grant.sermon,
          study: grant.study,
        },
        Date.parse('2030-01-01T00:00:00Z'),
      ),
    ).toThrow(/private-group/);
  });
});
