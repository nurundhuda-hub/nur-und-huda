import { readFileSync, existsSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HookParameters } from 'astro';
import localSermonPreview, {
  isLocalPreviewRequest,
} from '../scripts/local-sermon-preview';
import {
  PREVIEW_NOTICE,
  PREVIEW_PATH,
  renderLocalSermon,
} from '../src/lib/sermons/dev-preview';
import { splitSuppliedSermon } from '../src/lib/sermons/drafts';
import { mountSermonReader } from '../src/scripts/sermon-reader';
import { initPreviewControls } from '../src/dev/preview-controls';
import { READER_PREFERENCES_KEY } from '../src/scripts/reader-preferences';

const raw =
  '# تَجْرِبَةٌ — SYNTHETIC ONLY\n\n**SERMON_TEST_ONLY_NOT_RELIGIOUS_CONTENT**\n\n### الخطبة الأولى\n\n**تَجْرِبَةٌ أُولَى** <img src=x onerror=alert(1)>\n\n---\n\n### الخطبة الثانية\n\nتَجْرِبَةٌ ثَانِيَةٌ\n';
const parse = (html: string) =>
  new DOMParser().parseFromString(html, 'text/html');
const address: AddressInfo = {
  address: '127.0.0.1',
  port: 4340,
  family: 'IPv4',
};
const request = (overrides: Record<string, unknown> = {}) =>
  ({
    method: 'GET',
    headers: { host: '127.0.0.1:4340' },
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  }) as unknown as IncomingMessage;
afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('local sermon rendering', () => {
  it('puts the labelled controls above the title outside the closed dialog and initializes the page reader', async () => {
    localStorage.clear();
    document.body.innerHTML = parse(
      renderLocalSermon(Buffer.from(raw)),
    ).body.innerHTML;
    const toolbar = document.querySelector<HTMLElement>(
      '[data-preview-toolbar]',
    )!;
    const article = document.querySelector<HTMLElement>(
      '[data-preview-article]',
    )!;
    const text = article.textContent;
    expect(toolbar.closest('dialog')).toBeNull();
    expect(
      toolbar.compareDocumentPosition(article) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const cleanup = initPreviewControls(document);
    try {
      expect(toolbar.dataset.initialized).toBe('true');
      const button = (s: string) =>
        toolbar.querySelector<HTMLButtonElement>(s)!;
      const plus = button('[data-preview-step="2"]');
      const minus = button('[data-preview-step="-2"]');
      expect(plus.textContent).toContain('تكبير');
      expect(minus.textContent).toContain('تصغير');
      plus.click();
      expect(article.style.getPropertyValue('--reader-font')).toBe('2.125rem');
      for (let i = 0; i < 20; i++) plus.click();
      expect(plus.disabled).toBe(true);
      expect(article.style.getPropertyValue('--reader-font')).toBe('2.75rem');
      for (let i = 0; i < 20; i++) minus.click();
      expect(minus.disabled).toBe(true);
      expect(article.style.getPropertyValue('--reader-font')).toBe('1.125rem');
      button('[data-preview-reset]').click();
      expect(article.style.getPropertyValue('--reader-font')).toBe('2rem');
      const theme = toolbar.querySelector<HTMLSelectElement>('select')!;
      theme.value = 'dark';
      theme.dispatchEvent(new Event('change'));
      expect(article.dataset.previewTheme).toBe('dark');
      expect(
        JSON.parse(localStorage.getItem(READER_PREFERENCES_KEY)!).theme,
      ).toBe('dark');
      const dialog = document.querySelector<HTMLDialogElement>('dialog')!;
      dialog.querySelector<HTMLButtonElement>('[data-font-step="2"]')!.click();
      await Promise.resolve();
      expect(article.style.getPropertyValue('--reader-font')).toBe('2.125rem');
      expect(article.textContent).toBe(text);
      expect(
        document.querySelector<HTMLButtonElement>('[data-preview-approve]')!
          .disabled,
      ).toBe(true);
      expect(
        document.querySelector('[data-preview-approval]')!.textContent,
      ).toContain('المتطلبات المتبقية');
    } finally {
      cleanup();
    }
  });
  it('reveals a local CLI command only for a ready revision and never posts approval', () => {
    document.body.innerHTML = parse(
      renderLocalSermon(Buffer.from(raw), {
        state: 'ready',
        revision: 'r1',
        missing: [],
        reviewedSha256: 'a'.repeat(64),
      }),
    ).body.innerHTML;
    const cleanup = initPreviewControls(document);
    try {
      const button = document.querySelector<HTMLButtonElement>(
        '[data-preview-approve]',
      )!;
      expect(button.disabled).toBe(false);
      button.click();
      expect(document.getElementById('approval-command')!.hidden).toBe(false);
      expect(
        document.getElementById('approval-command')!.textContent,
      ).toContain('--confirm-sha256 ' + 'a'.repeat(64));
      expect(document.querySelector('form')).toBeNull();
      expect(
        document.querySelector('[data-review-status]')!.textContent,
      ).toContain('بانتظار اعتماد صريح');
    } finally {
      cleanup();
    }
    const approved = parse(
      renderLocalSermon(Buffer.from(raw), {
        state: 'approved',
        revision: 'r1',
        missing: [],
      }),
    );
    expect(
      approved.querySelector<HTMLButtonElement>('[data-preview-approve]')!
        .disabled,
    ).toBe(true);
  });
  it.each([raw, raw.replaceAll('\n', '\r\n')])(
    'renders both exact Arabic parts with only supplied bold markup interpreted (%#)',
    (source) => {
      const before = Buffer.from(source);
      const doc = parse(renderLocalSermon(before));
      expect(doc.documentElement.lang).toBe('ar');
      expect(doc.documentElement.dir).toBe('rtl');
      expect(doc.querySelectorAll('h1')).toHaveLength(1);
      expect(doc.querySelector('h1')!.textContent).toBe(
        'تَجْرِبَةٌ — SYNTHETIC ONLY',
      );
      const spans = splitSuppliedSermon(source);
      for (const parent of ['article', 'dialog']) {
        const parts = doc.querySelectorAll(`${parent} [data-preview-part]`);
        expect(parts).toHaveLength(2);
        parts.forEach((part, index) => {
          const span = spans[index]!;
          expect(part.textContent).toBe(
            source
              .slice(span.start, span.end)
              .replaceAll('**', '')
              .replaceAll('\r\n', '\n'),
          );
        });
        expect(
          doc.querySelector(`${parent} .preview-notice`)!.textContent,
        ).toBe(PREVIEW_NOTICE);
      }
      expect(doc.querySelector('.preview-series')!.textContent).toContain(
        'ما لا يسع المسلم جهله · الدرس 1',
      );
      expect(
        doc.querySelector('time, img, iframe, [download], .study-link'),
      ).toBeNull();
      expect(doc.querySelector('script')!.getAttribute('src')).toBe(
        '/nur-und-huda/src/dev/sermon-preview-client.ts',
      );
      expect(doc.querySelector('script')!.textContent).toBe('');
      expect(
        doc.querySelector('meta[name="robots"]')!.getAttribute('content'),
      ).toContain('noindex');
      const ids = [...doc.querySelectorAll('[id]')].map((node) => node.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(before).toEqual(Buffer.from(source));
    },
  );
  it('uses existing imam controls, bounded font size, close focus and print action', () => {
    document.body.innerHTML = parse(
      renderLocalSermon(Buffer.from(raw)),
    ).body.innerHTML;
    const root = document.querySelector<HTMLElement>('[data-sermon-reader]')!;
    const dialog = root.querySelector('dialog')!;
    dialog.showModal = vi.fn(() => {
      dialog.open = true;
    });
    dialog.close = vi.fn(() => {
      dialog.open = false;
      dialog.dispatchEvent(new Event('close'));
    });
    const print = vi.fn();
    const cleanup = mountSermonReader(root, { print });
    const button = (selector: string) =>
      root.querySelector<HTMLButtonElement>(selector)!;
    try {
      button('[data-reader-open]').click();
      expect(dialog.open).toBe(true);
      button('[data-font-step="2"]').click();
      expect(dialog.style.getPropertyValue('--reader-font')).toBe('2.125rem');
      const range = root.querySelector<HTMLInputElement>('[data-reader-size]')!;
      range.value = '44';
      range.dispatchEvent(new Event('input'));
      expect(button('[data-font-step="2"]').disabled).toBe(true);
      button('dialog [data-sermon-print]').click();
      button('.sermon-actions [data-sermon-print]').click();
      expect(print).toHaveBeenCalledTimes(2);
      button('[data-reader-close]').click();
      expect(dialog.open).toBe(false);
      expect(document.activeElement).toBe(button('[data-reader-open]'));
      expect(readFileSync('src/dev/sermon-preview.css', 'utf8')).toContain(
        '@media print',
      );
      expect(readFileSync('src/styles/sermons.css', 'utf8')).toContain(
        '[data-sermon-reader]',
      );
      expect(
        document.querySelector('article .preview-notice')!.textContent,
      ).toBe(PREVIEW_NOTICE);
    } finally {
      cleanup();
    }
  });
});

describe('local-only access and production exclusion', () => {
  it('allows direct loopback navigation and same-origin requests only', () => {
    expect(isLocalPreviewRequest(request(), address)).toBe(true);
    expect(
      isLocalPreviewRequest(
        request({
          method: 'HEAD',
          headers: {
            host: 'localhost:4340',
            origin: 'http://localhost:4340',
            'sec-fetch-site': 'same-origin',
          },
        }),
        address,
      ),
    ).toBe(true);
    expect(
      isLocalPreviewRequest(
        request({
          headers: { host: '[::1]:4340' },
          socket: { remoteAddress: '::1' },
        }),
        { ...address, address: '::1' },
      ),
    ).toBe(true);
    for (const invalid of [
      request({ method: 'POST' }),
      request({ socket: { remoteAddress: '192.168.1.2' } }),
      request({ headers: { host: 'public.example:4340' } }),
      request({ headers: { host: '127.0.0.1.evil.example:4340' } }),
      request({ headers: { host: '127.0.0.1:4341' } }),
      request({
        headers: { host: '127.0.0.1:4340', origin: 'https://evil.example' },
      }),
      request({
        headers: {
          host: '127.0.0.1:4340',
          referer: 'https://evil.example/page',
        },
      }),
      request({
        headers: { host: '127.0.0.1:4340', 'sec-fetch-site': 'cross-site' },
      }),
      request({
        headers: { host: '127.0.0.1:4340', forwarded: 'host=public.example' },
      }),
      request({
        headers: {
          host: '127.0.0.1:4340',
          'x-forwarded-host': 'public.example',
        },
      }),
    ])
      expect(isLocalPreviewRequest(invalid, address)).toBe(false);
    expect(
      isLocalPreviewRequest(request(), { ...address, address: '0.0.0.0' }),
    ).toBe(false);
    expect(isLocalPreviewRequest(request(), null)).toBe(false);
  });
  it('registers middleware only for dev and denies direct private-file serving', async () => {
    for (const command of ['build', 'preview', 'sync', 'dev'] as const) {
      const integration = localSermonPreview();
      const updateConfig = vi.fn(),
        use = vi.fn();
      await integration.hooks['astro:config:setup']!({
        command,
        updateConfig,
      } as unknown as HookParameters<'astro:config:setup'>);
      await integration.hooks['astro:server:setup']!({
        server: { middlewares: { use } },
      } as unknown as HookParameters<'astro:server:setup'>);
      expect(use).toHaveBeenCalledTimes(command === 'dev' ? 1 : 0);
      if (command === 'dev') {
        expect(updateConfig.mock.calls[0]![0].vite.server.fs.deny).toContain(
          '**/.sermon-review/**',
        );
      } else expect(updateConfig).not.toHaveBeenCalled();
    }
  });
  it('keeps production output and publication manifest free of the dev route', () => {
    const manifest = JSON.parse(
      readFileSync('dist/sermon-publication.json', 'utf8'),
    );
    expect(manifest.pages).toEqual([]);
    expect(manifest.downloads).toEqual([]);
    expect(existsSync('dist/_review/first-sermon.html')).toBe(false);
    for (const page of [
      'index',
      'sermons',
      'together',
      'quran',
      'library',
      'legal',
    ]) {
      const html = readFileSync(`dist/${page}.html`, 'utf8');
      expect(html).not.toContain(PREVIEW_PATH);
      expect(html).not.toContain(PREVIEW_NOTICE);
      expect(html).not.toContain('data-preview-part');
    }
  });
});
