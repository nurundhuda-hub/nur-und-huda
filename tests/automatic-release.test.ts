import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { automaticGate, retryUntil } from '../src/lib/sermons/automatic-policy';
import { firstRelease } from '../src/lib/sermons/first-release';
import {
  canonical,
  decryptCatalog,
  encryptCatalog,
  newReleaseKey,
  signReceipt,
  verifyReceiptSeal,
} from '../scripts/automatic-release-crypto';
import {
  probeLiveRelease,
  receiptName,
  verifyLiveReceipt,
  type PublicReceipt,
} from '../scripts/automatic-release-support';
import {
  repository,
  bytesDigest,
  retryVerification,
} from '../scripts/pages-release-support';
import { publicReleaseManifest } from '../src/lib/sermons/scheduled-release';
import { selectPublicCatalog } from '../src/lib/sermons/publication';
import { workflowDigest } from '../src/lib/sermons/approval-workflow';
import {
  sermonFixture,
  sealFixture,
  resealFixtureHistory,
} from './fixtures/sermon-content';

const binding = {
  repository,
  catalogSha256: 'a'.repeat(64),
  publishAt: firstRelease.publishAt,
};
describe('automatic publishing security', () => {
  it('round-trips authenticated encrypted content, uses fresh nonces and rejects wrong keys, tampering and context', () => {
    const value = {
        text: 'SYNTHETIC PRIVATE TEXT ONLY — لَا مَحْتَوَى دِينِيّ',
        revision: 'test-only',
      },
      key = newReleaseKey();
    const a = encryptCatalog(value, key, binding),
      b = encryptCatalog(value, key, binding);
    expect(a).not.toBe(b);
    expect(a).not.toContain(value.text);
    expect(Buffer.byteLength(a)).toBeLessThan(48 * 1024);
    expect(decryptCatalog(a, key, binding)).toEqual(value);
    for (const [payload, k, ctx] of [
      [a, newReleaseKey(), binding],
      [a, key, { ...binding, publishAt: '2026-11-06T06:00:00Z' }],
      ['{invalid ' + value.text, key, binding],
    ] as const)
      expect(() => decryptCatalog(payload, k, ctx)).toThrow(
        'Encrypted release payload could not be authenticated.',
      );
    const changed = JSON.parse(a);
    changed.ciphertext =
      (changed.ciphertext[0] === 'A' ? 'B' : 'A') + changed.ciphertext.slice(1);
    expect(() => decryptCatalog(JSON.stringify(changed), key, binding)).toThrow(
      /authenticated/,
    );
    const receipt = signReceipt(
      { catalog: 'public hash only', files: { a: 'b' } },
      key,
      binding,
    );
    expect(verifyReceiptSeal(receipt, key, binding)).toBe(true);
    expect(
      verifyReceiptSeal({ ...receipt, catalog: 'changed' }, key, binding),
    ).toBe(false);
    expect(verifyReceiptSeal(receipt, newReleaseKey(), binding)).toBe(false);
    expect(canonical({ b: 1, a: 2 })).toBe(canonical({ a: 2, b: 1 }));
  });
  it('requires the authorized repository/main, explicit activation and real UTC deadline; allows delayed/manual retries', () => {
    const base = {
      repository,
      ref: 'refs/heads/main',
      enabled: 'true',
      mode: 'release',
      scheduled: true,
      now: Date.parse(firstRelease.publishAt),
    };
    expect(automaticGate(base, firstRelease.publishAt)).toBe('due');
    expect(
      automaticGate({ ...base, now: base.now - 1 }, firstRelease.publishAt),
    ).toBe('embargo');
    expect(
      automaticGate(
        { ...base, now: base.now + 3600000 },
        firstRelease.publishAt,
      ),
    ).toBe('due');
    expect(
      automaticGate(
        { ...base, ref: 'refs/heads/codex/audit-and-rebuild' },
        firstRelease.publishAt,
      ),
    ).toBe('wrong-source');
    expect(
      automaticGate(
        { ...base, repository: 'untrusted/fork' },
        firstRelease.publishAt,
      ),
    ).toBe('wrong-source');
    expect(
      automaticGate({ ...base, enabled: '' }, firstRelease.publishAt),
    ).toBe('disabled');
    expect(
      automaticGate({ ...base, mode: 'preflight' }, firstRelease.publishAt),
    ).toBe('preflight-only');
    expect(
      automaticGate(
        { ...base, now: Date.parse(retryUntil) },
        firstRelease.publishAt,
      ),
    ).toBe('retry-window-ended');
    expect(
      automaticGate(
        { ...base, now: Date.parse(retryUntil), scheduled: false },
        firstRelease.publishAt,
      ),
    ).toBe('due');
    expect(automaticGate({ ...base, now: NaN }, firstRelease.publishAt)).toBe(
      'embargo',
    );
    expect(automaticGate(base, 'invalid')).toBe('embargo');
    expect(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Berlin',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(base.now)),
    ).toBe('08:00');
  });
  it('skips verified duplicate releases, detects tampering/stale bytes and retries failures without treating network errors as absence', async () => {
    const c = sermonFixture();
    for (const v of [...c.sermons, ...c.studies]) {
      v.purpose = 'production';
      sealFixture(v);
    }
    resealFixtureHistory(c);
    const expected = {
      publishAt: c.sermons[0]!.publishAt,
      sermon: { id: c.sermons[0]!.id, revision: 'r1' },
      study: { id: c.studies[0]!.id, revision: 'r1' },
    };
    const now = Date.parse(expected.publishAt),
      key = newReleaseKey(),
      ctx = {
        repository,
        publishAt: expected.publishAt,
        catalogSha256: workflowDigest(c),
      };
    const manifest = publicReleaseManifest(
      selectPublicCatalog(c, expected.publishAt),
    );
    const bodies: Record<string, string> = {
      'sermon-publication.json': JSON.stringify(manifest),
      'sermons.html': 'SYNTHETIC OVERVIEW',
      ...Object.fromEntries(
        [...manifest.pages, ...manifest.downloads].map((file) => [
          file,
          'SYNTHETIC PUBLIC FIXTURE ' + file,
        ]),
      ),
    };
    const files = Object.fromEntries(
      Object.entries(bodies).map(([file, body]) => [
        file,
        bytesDigest(Buffer.from(body)),
      ]),
    );
    const receipt = signReceipt(
      {
        version: 1 as const,
        catalogSha256: ctx.catalogSha256,
        publishAt: ctx.publishAt,
        sourceCommit: 'b'.repeat(40),
        manifest,
        files,
      },
      key,
      ctx,
    ) as PublicReceipt;
    let mode = 'valid',
      calls = 0;
    const fetcher = (async (input: URL | RequestInfo) => {
      calls++;
      const file = new URL(String(input)).pathname.replace(
        '/nur-und-huda/',
        '',
      );
      if (file === receiptName) {
        if (mode === 'absent') return new Response('', { status: 404 });
        if (mode === 'network') return new Response('', { status: 503 });
        return new Response(
          JSON.stringify(
            mode === 'tampered'
              ? { ...receipt, sourceCommit: 'c'.repeat(40) }
              : receipt,
          ),
        );
      }
      return new Response(mode === 'stale' ? 'wrong bytes' : bodies[file]);
    }) as typeof fetch;
    await expect(
      probeLiveRelease(key, ctx, c, expected, fetcher, now - 1),
    ).rejects.toThrow(/Embargo/);
    expect(calls).toBe(0);
    await expect(
      probeLiveRelease(key, ctx, c, expected, fetcher, now),
    ).resolves.toBe('already-live');
    await expect(
      probeLiveRelease(key, ctx, c, expected, fetcher, now),
    ).resolves.toBe('already-live');
    mode = 'stale';
    await expect(
      probeLiveRelease(key, ctx, c, expected, fetcher, now),
    ).resolves.toBe('repair-needed');
    mode = 'absent';
    await expect(
      probeLiveRelease(key, ctx, c, expected, fetcher, now),
    ).resolves.toBe('absent');
    mode = 'network';
    await expect(
      probeLiveRelease(key, ctx, c, expected, fetcher, now),
    ).rejects.toThrow(/unavailable/);
    mode = 'tampered';
    await expect(
      probeLiveRelease(key, ctx, c, expected, fetcher, now),
    ).rejects.toThrow(/refusing to overwrite/);
    await expect(
      verifyLiveReceipt(
        { ...receipt, files: {} } as PublicReceipt,
        key,
        ctx,
        c,
        expected,
        fetcher,
        now,
      ),
    ).rejects.toThrow(/invalid/);
    let attempts = 0;
    await retryVerification(
      async () => {
        mode = ++attempts === 1 ? 'network' : 'valid';
        await probeLiveRelease(key, ctx, c, expected, fetcher, now);
      },
      async () => {},
      3,
    );
    expect(attempts).toBe(2);
  });
  it('keeps workflow secret access, deployment authority and artifact upload behind independent gates', () => {
    const workflow = parse(
      readFileSync('.github/workflows/automatic-sermon-release.yml', 'utf8'),
    );
    expect(Object.keys(workflow.on).sort()).toEqual([
      'schedule',
      'workflow_dispatch',
    ]);
    expect(workflow.on.schedule[0].cron).toBe('7,22,37,52 * 6-8 11 *');
    expect(workflow.on.workflow_dispatch.inputs.mode.default).toBe('preflight');
    expect(workflow.permissions).toEqual({});
    expect(workflow.concurrency['cancel-in-progress']).toBe(false);
    expect(workflow.jobs.gate.if).toContain("github.ref == 'refs/heads/main'");
    expect(workflow.jobs.build.if).toContain(
      "needs.gate.outputs.due == 'true'",
    );
    expect(workflow.jobs.build.environment).toBe('sermon-release');
    expect(workflow.jobs.build.permissions).toEqual({ contents: 'read' });
    expect(workflow.jobs.deploy.permissions).toEqual({
      contents: 'read',
      pages: 'write',
      'id-token': 'write',
    });
    expect(workflow.jobs.deploy.environment.name).toBe('github-pages');
    const steps = workflow.jobs.build.steps;
    const upload = steps.find((s: { uses?: string }) =>
      s.uses?.startsWith('actions/upload-pages-artifact@'),
    );
    expect(upload.with.path).toBe('dist');
    expect(upload.with['retention-days']).toBe(1);
    expect(upload.if).toContain("steps.prepare.outputs.publish == 'true'");
    expect(steps[steps.indexOf(upload) - 1].run).toContain(
      'automatic-release-clock.ts',
    );
    expect(workflow.jobs.deploy.steps.at(-2).run).toContain(
      'automatic-release-clock.ts',
    );
    expect(workflow.jobs.verify.steps.at(-1).run).toContain(
      'automatic-release.ts verify',
    );
    const gateText = JSON.stringify(workflow.jobs.gate);
    expect(gateText).not.toContain('secrets.');
    const safe = parse(
      readFileSync('.github/workflows/sermon-release-security.yml', 'utf8'),
    );
    expect(JSON.stringify(safe)).not.toContain('secrets.');
    for (const step of safe.jobs.verify.steps)
      if (step.uses?.includes('pages')) expect(step.if).toBe(false);
    for (const job of Object.values(workflow.jobs) as {
      steps: { uses?: string; with?: Record<string, unknown> }[];
    }[])
      for (const step of job.steps)
        if (step.uses === 'actions/checkout@v6')
          expect(step.with?.['persist-credentials']).toBe(false);
  });
});
