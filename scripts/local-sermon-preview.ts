import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { AstroIntegration } from 'astro';
import { localReviewStatus } from './local-sermon-review-status.ts';
import { loadLocalStudy } from './local-study.ts';
import { STUDY_PREVIEW_PATH } from '../src/lib/sermons/private-study.ts';
import { renderLocalStudy } from '../src/lib/sermons/dev-study-preview.ts';
import {
  PREVIEW_PATH,
  renderLocalSermon,
} from '../src/lib/sermons/dev-preview.ts';

const loopback = (address: string | undefined) =>
  ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address ?? '');
export function isLocalPreviewRequest(
  req: Pick<IncomingMessage, 'method' | 'headers' | 'socket'>,
  listener: AddressInfo | string | null,
): boolean {
  if (
    !listener ||
    typeof listener === 'string' ||
    !loopback(listener.address) ||
    !loopback(req.socket.remoteAddress)
  )
    return false;
  if (!['GET', 'HEAD'].includes(req.method ?? '')) return false;
  const host = req.headers.host;
  if (!host || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host))
    return false;
  const origin = `http://${host}`;
  if (Number(new URL(origin).port || 80) !== listener.port) return false;
  if (
    Object.keys(req.headers).some(
      (key) => key === 'forwarded' || key.startsWith('x-forwarded-'),
    )
  )
    return false;
  if (req.headers.origin && req.headers.origin !== origin) return false;
  if (
    req.headers['sec-fetch-site'] &&
    !['same-origin', 'none'].includes(String(req.headers['sec-fetch-site']))
  )
    return false;
  if (req.headers.referer) {
    try {
      if (new URL(req.headers.referer).origin !== origin) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export default function localSermonPreview(): AstroIntegration {
  let development = false;
  return {
    name: 'nur-und-huda-local-sermon-review',
    hooks: {
      'astro:config:setup': ({ command, updateConfig }) => {
        development = command === 'dev';
        if (!development) return;
        updateConfig({
          vite: {
            server: {
              fs: {
                deny: [
                  '.env',
                  '.env.*',
                  '*.{crt,pem,key,p12,pfx,cer,der}',
                  '.npmrc',
                  '.yarnrc.yml',
                  '**/.git/**',
                  '**/.sermon-review/**',
                ],
              },
              watch: { ignored: ['**/.sermon-review/**'] },
            },
          },
        });
      },
      'astro:server:setup': ({ server }) => {
        if (!development) return;
        server.middlewares.use(async (req, res, next) => {
          let pathname: string;
          try {
            pathname = new URL(req.url ?? '', 'http://localhost').pathname;
          } catch {
            return next();
          }
          // Vite may remove the project base before integration middleware runs.
          if (
            ![
              PREVIEW_PATH,
              '/_review/first-sermon',
              STUDY_PREVIEW_PATH,
              '/_review/first-study',
            ].includes(pathname)
          )
            return next();
          res.setHeader('Cache-Control', 'no-store, private, max-age=0');
          res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
          res.setHeader('Referrer-Policy', 'no-referrer');
          res.setHeader('X-Frame-Options', 'DENY');
          res.setHeader(
            'Content-Security-Policy',
            "frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
          );
          res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          if (
            !isLocalPreviewRequest(req, server.httpServer?.address() ?? null)
          ) {
            res.statusCode = 403;
            res.end('Local development access only.');
            return;
          }
          try {
            const root = path.resolve('.sermon-review');
            const source = path.join(root, 'first-sermon-approved.txt');
            if (
              (await lstat(root)).isSymbolicLink() ||
              !(await lstat(source)).isFile() ||
              (await realpath(root)) !==
                path.join(await realpath('.'), '.sermon-review')
            )
              throw new Error('Invalid source location.');
            const bytes = await readFile(source);
            const study = await loadLocalStudy(root, bytes);
            const isStudy = [
              STUDY_PREVIEW_PATH,
              '/_review/first-study',
            ].includes(pathname);
            if (isStudy && study.state !== 'present')
              throw new Error('Study unavailable.');
            const review = await localReviewStatus(bytes, root);
            review.study = {
              state: study.state,
              ...(study.state === 'present'
                ? { revision: study.revision.revision }
                : {}),
            };
            const html =
              isStudy && study.state === 'present'
                ? renderLocalStudy(study.revision)
                : renderLocalSermon(bytes, review);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(req.method === 'HEAD' ? undefined : html);
          } catch {
            // Never send a source excerpt or a filesystem stack trace in an error page.
            res.statusCode = 503;
            res.end(
              'Private source unavailable or invalid. Check the local review file.',
            );
          }
        });
      },
    },
  };
}
