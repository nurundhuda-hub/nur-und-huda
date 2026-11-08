import { ECDH } from 'node:crypto';
import { ApiError, DAY, GROUP_GRACE, hash, type State } from './core.js';
import type { AccessState } from './group-access.js';

export type Subscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};
type Device = {
  subscription: Subscription;
  session: string;
  epoch: string;
  createdAt: number;
  refreshedAt: number;
  expiresAt: number;
};
type Delivery = {
  state: 'claimed' | 'sent' | 'retry' | 'failed';
  attempts: number;
  readyAt: number;
  expiresAt: number;
};
export type PushState = {
  devices: Record<string, Device>;
  deliveries: Record<string, Delivery>;
  minute: number;
  requests: number;
  day: number;
  daily: number;
};
export const emptyPush = (): PushState => ({
  devices: {},
  deliveries: {},
  minute: 0,
  requests: 0,
  day: 0,
  daily: 0,
});
export interface PushStore {
  transact<T>(
    work: (push: PushState, group: State, access: AccessState) => T,
  ): Promise<T>;
}
export function deviceHash(value: string | undefined) {
  if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value))
    throw new ApiError(400, 'INVALID_DEVICE');
  return hash(value);
}
export function validateSubscription(value: unknown): Subscription {
  try {
    const s = value as Subscription & { expirationTime?: unknown };
    if (
      !s ||
      Object.keys(s).some(
        (k) => !['endpoint', 'keys', 'expirationTime'].includes(k),
      ) ||
      typeof s.endpoint !== 'string' ||
      s.endpoint.length > 1024 ||
      !s.keys ||
      Object.keys(s.keys).sort().join(',') !== 'auth,p256dh'
    )
      throw Error();
    const u = new URL(s.endpoint);
    // Exact known browser push services only: never fetch a user-controlled host,
    // localhost, a Google metadata endpoint, or a redirect destination.
    const paths: Record<string, RegExp> = {
      'fcm.googleapis.com': /^\/(?:fcm\/send|wp)\/[A-Za-z0-9_:.-]+$/,
      'web.push.apple.com': /^\/[A-Za-z0-9/_:.-]+$/,
      'updates.push.services.mozilla.com': /^\/wpush\/v2\/[A-Za-z0-9_-]+$/,
    };
    if (
      u.protocol !== 'https:' ||
      u.port ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      !paths[u.hostname]?.test(u.pathname)
    )
      throw Error();
    for (const [key, length] of [
      ['auth', 16],
      ['p256dh', 65],
    ] as const) {
      const text = s.keys[key];
      if (
        typeof text !== 'string' ||
        !/^[A-Za-z0-9_-]+$/.test(text) ||
        Buffer.from(text, 'base64url').length !== length ||
        Buffer.from(text, 'base64url').toString('base64url') !== text
      )
        throw Error();
    }
    ECDH.convertKey(Buffer.from(s.keys.p256dh, 'base64url'), 'prime256v1');
    return {
      endpoint: u.href,
      keys: { auth: s.keys.auth, p256dh: s.keys.p256dh },
    };
  } catch {
    throw new ApiError(400, 'INVALID_SUBSCRIPTION');
  }
}
function valid(
  device: Device,
  access: AccessState,
  epoch: string,
  now: number,
) {
  const session = access.sessions[device.session];
  return (
    device.expiresAt > now &&
    device.epoch === epoch &&
    session &&
    session.epoch === epoch &&
    session.expiresAt > now
  );
}
export function prunePush(
  push: PushState,
  access: AccessState,
  epoch: string,
  now: number,
) {
  for (const [id, device] of Object.entries(push.devices))
    if (!valid(device, access, epoch, now)) delete push.devices[id];
  for (const [id, delivery] of Object.entries(push.deliveries))
    if (delivery.expiresAt <= now) delete push.deliveries[id];
}
export function createPushService(
  store: PushStore,
  epoch: () => string,
  clock = Date.now,
) {
  return {
    async subscription(
      method: string,
      token: string | undefined,
      session: string,
      body?: unknown,
    ) {
      const id = deviceHash(token);
      if (!['GET', 'PUT', 'DELETE'].includes(method))
        throw new ApiError(405, 'INVALID_INPUT');
      const subscription =
        method === 'PUT' ? validateSubscription(body) : undefined;
      return store.transact((push, _group, access) => {
        const now = clock(),
          currentEpoch = epoch();
        prunePush(push, access, currentEpoch, now);
        const auth = access.sessions[session];
        if (!auth || auth.epoch !== currentEpoch || auth.expiresAt <= now)
          throw new ApiError(401, 'GROUP_ACCESS_REQUIRED');
        const minute = Math.floor(now / 60_000),
          day = Math.floor(now / DAY);
        if (push.minute !== minute) {
          push.minute = minute;
          push.requests = 0;
        }
        if (push.day !== day) {
          push.day = day;
          push.daily = 0;
        }
        if (push.requests >= 120 || push.daily >= 2000)
          throw new ApiError(429, 'RATE_LIMITED');
        push.requests++;
        push.daily++;
        if (method === 'DELETE') delete push.devices[id];
        if (subscription) {
          if (
            (!push.devices[id] && Object.keys(push.devices).length >= 50) ||
            Object.entries(push.devices).some(
              ([other, d]) =>
                other !== id &&
                d.subscription.endpoint === subscription.endpoint,
            )
          )
            throw new ApiError(409, 'SUBSCRIPTION_CONFLICT');
          push.devices[id] = {
            subscription,
            session,
            epoch: currentEpoch,
            createdAt: push.devices[id]?.createdAt ?? now,
            refreshedAt: now,
            expiresAt: Math.min(auth.expiresAt, now + 30 * DAY),
          };
        }
        return {
          subscribed: Boolean(push.devices[id]),
          expiresAt: push.devices[id]?.expiresAt ?? null,
        };
      });
    },
    async revokeSession(session: string) {
      await store.transact((push) => {
        for (const [id, d] of Object.entries(push.devices))
          if (d.session === session) delete push.devices[id];
      });
    },
    async active(id: string) {
      if (!/^[a-f0-9]{64}$/.test(id)) throw new ApiError(400, 'INVALID_INPUT');
      return store.transact((_push, group) => {
        const g = group.gatherings[id];
        return {
          active: Boolean(
            g && !g.cancelled && g.startsAt + GROUP_GRACE > clock(),
          ),
        };
      });
    },
  };
}
export type PushSend = (
  sub: Subscription,
  payload: { gathering: string; expiresAt: number },
  ttl: number,
  topic: string,
) => Promise<void>;
export function createDispatcher(
  store: PushStore,
  epoch: () => string,
  send: PushSend,
  clock = Date.now,
) {
  return async () => {
    const work = await store.transact((push, group, access) => {
      const now = clock(),
        currentEpoch = epoch();
      prunePush(push, access, currentEpoch, now);
      const claims: { key: string; device: string; gathering: string }[] = [];
      for (const g of Object.values(group.gatherings)) {
        // Only new private-group creations are events. Old data, edits, reads,
        // joins and leaves never generate notifications. Do not announce late.
        if (
          !g.notificationCreatedAt ||
          g.cancelled ||
          g.startsAt <= now ||
          g.notificationCreatedAt + 5 * 60_000 <= now
        )
          continue;
        for (const [id, d] of Object.entries(push.devices)) {
          if (id === g.creatorDevice || d.createdAt > g.notificationCreatedAt)
            continue;
          const key = hash(`${g.id}:${id}`),
            prior = push.deliveries[key];
          if (
            prior &&
            (prior.state !== 'retry' ||
              prior.readyAt > now ||
              prior.attempts >= 3)
          )
            continue;
          if (claims.length >= 16) break;
          // Claim BEFORE sending. Unknown network outcomes/crashes are NOT
          // resent: this avoids duplicate alerts but may lose a delivery.
          push.deliveries[key] = {
            state: 'claimed',
            attempts: (prior?.attempts ?? 0) + 1,
            readyAt: now,
            expiresAt: g.startsAt + GROUP_GRACE,
          };
          claims.push({ key, device: id, gathering: g.id });
        }
      }
      return claims;
    });
    const counts = { sent: 0, failed: 0, retry: 0, skipped: 0 };
    // Bounded batches keep one request below its execution budget.
    for (let offset = 0; offset < work.length; offset += 4) {
      await Promise.all(
        work.slice(offset, offset + 4).map(async (job) => {
          const snapshot = await store.transact((push, group, access) => {
            const d = push.devices[job.device],
              g = group.gatherings[job.gathering],
              now = clock();
            if (
              !d ||
              !valid(d, access, epoch(), now) ||
              !g ||
              g.cancelled ||
              g.startsAt <= now
            )
              return null;
            return {
              subscription: d.subscription,
              refreshedAt: d.refreshedAt,
              expiresAt: g.startsAt + GROUP_GRACE,
              ttl: Math.max(
                0,
                Math.min(300, Math.floor((g.startsAt - now) / 1000)),
              ),
            };
          });
          if (!snapshot) {
            counts.skipped++;
            return;
          }
          let outcome: Delivery['state'] = 'sent',
            gone = false;
          try {
            await send(
              snapshot.subscription,
              { gathering: job.gathering, expiresAt: snapshot.expiresAt },
              snapshot.ttl,
              job.key.slice(0, 32),
            );
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            gone = status === 404 || status === 410;
            // Only explicit provider rejection is safe to retry. Never log the
            // library error: it includes the endpoint and request headers.
            outcome = status === 429 || status === 503 ? 'retry' : 'failed';
          }
          await store.transact((push) => {
            const delivery = push.deliveries[job.key];
            if (delivery) {
              delivery.state = outcome;
              delivery.readyAt = clock() + 60_000;
            }
            const d = push.devices[job.device];
            if (
              gone &&
              d?.refreshedAt === snapshot.refreshedAt &&
              JSON.stringify(d.subscription) ===
                JSON.stringify(snapshot.subscription)
            )
              delete push.devices[job.device];
          });
          counts[
            outcome === 'sent'
              ? 'sent'
              : outcome === 'retry'
                ? 'retry'
                : 'failed'
          ]++;
        }),
      );
    }
    return counts;
  };
}
