import {
  applyEditorRevision,
  escapeEditor,
  type createSermonEditor,
} from './sermon-editor.js';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { ApiError, type createService } from './core.js';
import { deviceHash, type createPushService } from './push.js';
import {
  createGroupAccess,
  cookieToken,
  readGroupSecret,
  sessionCookie,
  tokenHash,
  type AccessStore,
} from './group-access.js';
const BASE = '/nur-und-huda/';
const API = BASE + 'api';
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
};
function safeNext(value: unknown): string {
  if (
    typeof value === 'string' &&
    /^\/nur-und-huda\/sermon-editor\.html\?id=[a-z0-9-]{1,80}$/.test(value)
  )
    return value;
  return typeof value === 'string' &&
    /^\/nur-und-huda\/[a-zA-Z0-9/_-]+\.html(?:#gathering-[a-f0-9]{64})?$/.test(
      value,
    ) &&
    !value.includes('//')
    ? value
    : BASE + 'index.html';
}
function loginPage(next: string, error = '') {
  return `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="same-origin"><title>دخول المجموعة | نور وهدى</title><style>body{margin:0;background:#073D30;color:#F8F3E6;font:20px/1.8 system-ui,sans-serif;min-height:100dvh;display:grid;place-items:center}main{width:min(28rem,calc(100% - 3rem));padding:1.5rem 0}h1{color:#E4C783}label,input,button{display:block}input,button{box-sizing:border-box;width:100%;min-height:52px;font:inherit;border:1px solid #C9A45C;border-radius:12px;padding:.6rem;margin:.5rem 0 1rem}button{background:#C9A45C;color:#073D30;font-weight:bold;cursor:pointer}input{direction:ltr;background:#F8F3E6;color:#073D30}a{color:#E4C783}:focus-visible{outline:3px solid #E4C783;outline-offset:4px}.small{font-size:16px}</style><main><h1>نور وهدى</h1><p>أدخل رمز المجموعة مرة واحدة، ثم استخدم الموقع كالمعتاد.</p><p role="alert">${escape(error)}</p><form action="/access" method="post"><input type="hidden" name="next" value="${escape(next)}"><label for="code">رمز الدخول المشترك</label><input id="code" name="code" type="password" required maxlength="64" autocomplete="current-password" autocapitalize="characters" spellcheck="false"><button type="submit">دخول</button></form><p class="small">نحفظ إذن الدخول في ملف ارتباط آمن لمدة ٣٦٥ يوماً. تسجيل الخروج أو حذف بيانات المتصفح أو تغيير رمز المجموعة يتطلب إدخاله مجدداً. لا نطلب حساباً أو كلمة مرور شخصية.</p><p class="small">موقع مستقل لمجموعة زملاء، وليس موقعاً تابعاً للمستشفى. لا تشارك الرمز خارج المجموعة.</p><a href="mailto:nurundhuda@gmail.com">التواصل مع المسؤول</a></main></html>`;
}
interface Options {
  enabled(): boolean;
  secret(): string;
  origin(): string;
  emulator: boolean;
  store: AccessStore;
  service: ReturnType<typeof createService>;
  bundle: string;
  push?: ReturnType<typeof createPushService>;
  pushPublicKey?: () => string;
  dispatchPush?: () => Promise<unknown>;
  editor?: ReturnType<typeof createSermonEditor>;
}
export function privateGateway(options: Options) {
  const access = createGroupAccess(options.store);
  let manifest: Record<string, string> | undefined;
  return async (req: Request, res: Response) => {
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.set('Vary', 'Cookie');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.set('X-Frame-Options', 'DENY');
    res.set(
      'Content-Security-Policy',
      "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
    );
    try {
      if (!options.enabled()) throw new ApiError(503, 'GROUP_CLOSED');
      const origin = options.origin();
      if (
        origin !== 'https://nour-und-huda.web.app' &&
        !(options.emulator && origin === 'https://localhost:4443')
      )
        throw new ApiError(503, 'GROUP_CLOSED');
      const secret = readGroupSecret(options.secret(), options.emulator);
      const route = req.path;
      if (
        route.includes('%') ||
        route.includes('\\') ||
        route.split('/').some((p) => p === '..' || p === '.')
      )
        throw new ApiError(400, 'INVALID_INPUT');
      // Strict same-origin POST/PUT/DELETE, including login/logout. No CORS bypass.
      if (!['GET', 'HEAD'].includes(req.method) && req.get('origin') !== origin)
        throw new ApiError(403, 'ORIGIN_DENIED');
      if (
        (req.rawBody?.length ?? 0) >
        (route.startsWith(API + '/sermons/') ? 240000 : 2048)
      )
        throw new ApiError(413, 'INVALID_INPUT');
      const token = cookieToken(req.get('cookie'));
      if (route === '/access') {
        const next = safeNext(
          req.method === 'POST' ? req.body?.next : req.query.next,
        );
        if (req.method === 'POST') {
          if (
            !req.is('application/x-www-form-urlencoded') ||
            Object.keys(req.body ?? {}).some(
              (k) => !['code', 'next'].includes(k),
            )
          )
            throw new ApiError(400, 'INVALID_INPUT');
          const session = await access.login(req.body?.code, secret);
          res.set('Set-Cookie', sessionCookie(session));
          res.redirect(303, next);
          return;
        }
        if (!['GET', 'HEAD'].includes(req.method))
          throw new ApiError(405, 'INVALID_INPUT');
        if (await access.valid(token, secret)) {
          res.redirect(303, next);
          return;
        }
        res.status(200).type('html').send(loginPage(next));
        return;
      }
      if (route === '/access/logout' && req.method === 'POST') {
        await access.logout(token);
        if (token) await options.push?.revokeSession(tokenHash(token));
        res.set('Set-Cookie', sessionCookie('', true));
        res.redirect(303, '/access');
        return;
      }
      if (!(await access.valid(token, secret))) {
        if (route.startsWith(API) || route === '/access/status')
          throw new ApiError(401, 'GROUP_ACCESS_REQUIRED');
        res.redirect(
          303,
          '/access?next=' +
            encodeURIComponent(
              safeNext(
                route === BASE + 'sermon-editor.html' &&
                  typeof req.query.id === 'string'
                  ? route + '?id=' + req.query.id
                  : route,
              ),
            ),
        );
        return;
      }
      if (route === '/access/status' && req.method === 'GET') {
        res.status(200).json({ authorized: true });
        return;
      }
      if (route === '/' || route === '/nur-und-huda' || route === BASE) {
        res.redirect(302, BASE + 'index.html');
        return;
      }
      if (route.startsWith(API + '/')) {
        if (Object.keys(req.query).length)
          throw new ApiError(400, 'INVALID_INPUT');
        if (['POST', 'PUT'].includes(req.method) && !req.is('application/json'))
          throw new ApiError(415, 'INVALID_INPUT');
        if (route.startsWith(API + '/sermons/')) {
          if (!options.editor) throw new ApiError(503, 'UNAVAILABLE');
          const match =
            /^\/([a-z0-9-]{1,80})(?:\/(draft|publish|restore|preview))?$/.exec(
              route.slice((API + '/sermons').length),
            );
          if (!match) throw new ApiError(404, 'NOT_FOUND');
          res
            .status(200)
            .json(
              await options.editor.handle(
                req.method,
                match[1]!,
                match[2] ?? '',
                req.body,
              ),
            );
          return;
        }
        const authorization = req.get('authorization');
        if (authorization && !/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization))
          throw new ApiError(401, 'OWNERSHIP_REQUIRED');
        const pushDevice = req.get('X-Push-Device');
        if (pushDevice) deviceHash(pushDevice);
        if (route.startsWith(API + '/push/')) {
          if (!options.push || !options.pushPublicKey)
            throw new ApiError(503, 'UNAVAILABLE');
          let result;
          if (route === API + '/push/config' && req.method === 'GET')
            result = { publicKey: options.pushPublicKey() };
          else if (route === API + '/push/subscription')
            result = await options.push.subscription(
              req.method,
              pushDevice,
              tokenHash(token!),
              req.body,
            );
          else if (
            route.startsWith(API + '/push/check/') &&
            req.method === 'GET'
          )
            result = await options.push.active(
              route.slice((API + '/push/check/').length),
            );
          else throw new ApiError(404, 'NOT_FOUND');
          res.status(200).json(result);
          return;
        }
        const result = await options.service(
          req.method,
          route.slice(API.length),
          authorization?.slice(7),
          req.body,
          pushDevice ? deviceHash(pushDevice) : undefined,
        );
        if ('error' in result && result.error)
          throw new ApiError(result.error.status, result.error.code);
        if (
          req.method === 'POST' &&
          route === API + '/gatherings' &&
          options.dispatchPush
        ) {
          // Creation is already committed. Delivery failure must not turn a
          // successful gathering into a failed UI action. Minute worker recovers.
          try {
            await options.dispatchPush();
          } catch {
            console.warn('group_push_dispatch_unavailable');
          }
        }
        res.status(200).json(result);
        return;
      }
      if (!['GET', 'HEAD'].includes(req.method))
        throw new ApiError(405, 'INVALID_INPUT');
      if (!route.startsWith(BASE)) throw new ApiError(404, 'NOT_FOUND');
      let relative = route.slice(BASE.length);
      const requested = relative;
      // Exact known seed routes only; neither arbitrary documents nor private source files.
      const seeds = options.editor ? await options.editor.seeds() : [];
      const seed = seeds.find((s) =>
        [s.path, s.studyPath, s.downloadPath].includes(requested),
      );
      const kind =
        seed?.studyPath === requested
          ? 'study'
          : seed?.downloadPath === requested
            ? 'download'
            : 'sermon';
      if (seed?.testOnly) {
        const original = seeds.find(
          (s) => !s.testOnly && (kind !== 'study' || s.studyPath),
        );
        if (!original) throw new ApiError(404, 'NOT_FOUND');
        relative =
          kind === 'study'
            ? original.studyPath!
            : kind === 'download'
              ? original.downloadPath
              : original.path;
      }
      // Generated exact allowlist: never serve arbitrary Function source/config files.
      manifest ??= JSON.parse(
        await readFile(path.join(options.bundle, 'manifest.json'), 'utf8'),
      ).files;
      if (
        !manifest ||
        !Object.hasOwn(manifest, relative) ||
        !/^[A-Za-z0-9_./-]+$/.test(relative) ||
        relative.startsWith('.')
      )
        throw new ApiError(404, 'NOT_FOUND');
      const mime = types[path.extname(relative)];
      if (!mime) throw new ApiError(404, 'NOT_FOUND');
      const data = await readFile(path.join(options.bundle, 'site', relative));
      if (
        createHash('sha256').update(data).digest('hex') !== manifest[relative]
      )
        throw new ApiError(503, 'GROUP_CLOSED');
      let output: Buffer | string = data;
      if (seed && options.editor) {
        const { revision } = await options.editor.published(seed.id);
        // The untouched baseline continues to serve byte-for-byte until an explicit publish.
        output = applyEditorRevision(
          data.toString('utf8'),
          seed,
          seed.testOnly && revision.number === 0
            ? { ...revision, number: -1 }
            : revision,
          kind,
        );
        if (seed.testOnly)
          output = output.replace(
            /sermon-editor.html\?id=[a-z0-9-]+/g,
            'sermon-editor.html?id=editor-check',
          );
      }
      if (
        options.editor &&
        ['index.html', 'sermons.html'].includes(requested)
      ) {
        let html = data.toString('utf8');
        for (const item of seeds.filter((s) => !s.testOnly)) {
          const { revision } = await options.editor.published(item.id);
          if (revision.number > 0)
            html = html
              .split(escapeEditor(item.title))
              .join(escapeEditor(revision.content.title));
        }
        output = html;
      }
      res.status(200).type(mime).send(output);
    } catch (error) {
      const safe =
        error instanceof ApiError ? error : new ApiError(503, 'GROUP_CLOSED');
      if (safe.status === 429) res.set('Retry-After', '3600');
      if (req.path === '/access') {
        const message =
          safe.code === 'INVALID_ACCESS_CODE'
            ? 'الرمز غير صحيح. حاول مرة أخرى.'
            : safe.status === 429
              ? 'محاولات كثيرة. انتظر قبل المحاولة مجدداً.'
              : 'الدخول غير متاح حالياً. تواصل مع المسؤول.';
        res
          .status(safe.status)
          .type('html')
          .send(loginPage(safeNext(req.body?.next), message));
      } else res.status(safe.status).json({ error: { code: safe.code } });
    }
  };
}
