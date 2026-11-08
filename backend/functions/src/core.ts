import { createHash } from 'node:crypto';
import { firstName, shortNote } from './fields.js';

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const GROUP_GRACE = 30 * 60_000;
export type Prayer = (typeof PRAYERS)[number];
type Member = {
  joined: boolean;
  revision: number;
  operationId: string;
  firstName?: string;
};
export type Gathering = {
  id: string;
  prayer: Prayer;
  startsAt: number;
  owner: string;
  members: Record<string, Member>;
  cancelled: boolean;
  note?: string;
  creationFingerprint?: string;
  notificationCreatedAt?: number;
  creatorDevice?: string;
};
export type State = {
  gatherings: Record<string, Gathering>;
  clients: Record<
    string,
    {
      minute: number;
      requests: number;
      day: number;
      creates: number;
      expiresAt: number;
    }
  >;
  quota: {
    minute: number;
    requests: number;
    day: number;
    dailyRequests: number;
    creates: number;
  };
};
export interface Store {
  transact<T>(work: (state: State) => T): Promise<T>;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export const emptyState = (): State => ({
  gatherings: {},
  clients: {},
  quota: { minute: 0, requests: 0, day: 0, dailyRequests: 0, creates: 0 },
});
export const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export function prune(state: State, now: number, grace = 0) {
  for (const [id, item] of Object.entries(state.gatherings))
    if (item.startsAt + grace <= now) delete state.gatherings[id];
  for (const [id, client] of Object.entries(state.clients))
    if (client.expiresAt <= now) delete state.clients[id];
}
function exact(
  body: unknown,
  keys: string[],
  optional: string[] = [],
): asserts body is Record<string, unknown> {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((k) => !keys.includes(k) && !optional.includes(k)) ||
    keys.some((k) => !Object.hasOwn(body, k))
  )
    throw new ApiError(400, 'INVALID_INPUT');
}
function operation(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9-]{36}$/.test(value))
    throw new ApiError(400, 'INVALID_INPUT');
}
function identity(token: string | undefined, required: boolean) {
  if (!token && !required) return null;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new ApiError(401, 'OWNERSHIP_REQUIRED');
  return hash(token);
}
function quota(state: State, owner: string | null, now: number) {
  const minute = Math.floor(now / 60_000),
    day = Math.floor(now / DAY);
  if (state.quota.minute !== minute) {
    state.quota.minute = minute;
    state.quota.requests = 0;
  }
  if (state.quota.day !== day) {
    state.quota.day = day;
    state.quota.dailyRequests = 0;
    state.quota.creates = 0;
  }
  if (state.quota.requests >= 120 || state.quota.dailyRequests >= 10_000)
    throw new ApiError(429, 'RATE_LIMITED');
  if (owner) {
    if (!state.clients[owner] && Object.keys(state.clients).length >= 300)
      throw new ApiError(429, 'RATE_LIMITED');
    const client = state.clients[owner] ?? {
      minute,
      requests: 0,
      day,
      creates: 0,
      expiresAt: now + 26 * HOUR,
    };
    if (client.minute !== minute) {
      client.minute = minute;
      client.requests = 0;
    }
    if (client.day !== day) {
      client.day = day;
      client.creates = 0;
    }
    if (client.requests >= 20) throw new ApiError(429, 'RATE_LIMITED');
    client.requests++;
    client.expiresAt = now + 26 * HOUR;
    state.clients[owner] = client;
  }
  state.quota.requests++;
  state.quota.dailyRequests++;
}
export function project(
  item: Gathering,
  owner: string | null,
  named = false,
  grace = 0,
) {
  const member = owner ? item.members[owner] : undefined;
  return {
    ...(named
      ? {
          participantNames: Object.values(item.members)
            .filter((m) => m.joined && m.firstName)
            .map((m) => m.firstName!),
          note: item.note ?? '',
        }
      : {}),
    id: item.id,
    prayer: item.prayer,
    startsAt: new Date(item.startsAt).toISOString(),
    ...(grace
      ? { expiresAt: new Date(item.startsAt + grace).toISOString() }
      : {}),
    participantCount: Object.values(item.members).filter((m) => m.joined)
      .length,
    joined: member?.joined ?? false,
    participationRevision: member?.revision ?? 0,
    organizer: item.owner === owner,
    cancelled: item.cancelled,
  };
}
export function createService(
  store: Store,
  clock: () => number = Date.now,
  named = false,
  privateGroup = false,
) {
  return async (
    method: string,
    path: string,
    token: string | undefined,
    body: unknown = null,
    device?: string,
  ) => {
    const list = method === 'GET' && path === '/gatherings';
    const create = method === 'POST' && path === '/gatherings';
    const match = path.match(
      /^\/gatherings\/([a-f0-9]{64})(\/participation)?$/,
    );
    if (
      !list &&
      !create &&
      !(
        match &&
        ((method === 'PUT' && match[2]) || (method === 'DELETE' && !match[2]))
      )
    )
      throw new ApiError(404, 'NOT_FOUND');
    const owner = identity(token, !list);
    // Rate-limit keys cannot be used as gathering ownership keys.
    const rateOwner = named && owner ? hash(`rate:${token}`) : owner;
    let name = '',
      note = '';
    const consentVersion = named ? 'prayer-v2' : 'prayer-v1';
    if (create) {
      exact(
        body,
        [
          'prayer',
          'startsAt',
          'operationId',
          'consent',
          ...(named ? ['firstName'] : []),
        ],
        named ? ['note'] : [],
      );
      operation(body.operationId);
      if (
        !PRAYERS.includes(body.prayer as Prayer) ||
        typeof body.startsAt !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(body.startsAt) ||
        body.consent !== consentVersion
      )
        throw new ApiError(400, 'INVALID_INPUT');
    }
    if (method === 'PUT') {
      exact(body, [
        'joined',
        'expectedRevision',
        'operationId',
        'consent',
        ...(named ? ['firstName'] : []),
      ]);
      operation(body.operationId);
      if (
        typeof body.joined !== 'boolean' ||
        !Number.isSafeInteger(body.expectedRevision) ||
        Number(body.expectedRevision) < 0 ||
        body.consent !== consentVersion
      )
        throw new ApiError(400, 'INVALID_INPUT');
    }
    if (named && (create || method === 'PUT')) {
      const fields = body as Record<string, unknown>;
      try {
        name = create || fields.joined ? firstName(fields.firstName) : '';
        if (!create && !fields.joined && fields.firstName !== '')
          throw new Error('INVALID_NAME');
        if (create) note = shortNote(fields.note ?? '');
      } catch (error) {
        throw new ApiError(400, (error as Error).message);
      }
    }
    if (
      method === 'DELETE' &&
      body != null &&
      (typeof body !== 'object' || Object.keys(body).length)
    )
      throw new ApiError(400, 'INVALID_INPUT');
    const input = body as Record<string, unknown>;
    return store.transact((state) => {
      const now = clock();
      const grace = privateGroup ? GROUP_GRACE : 0;
      prune(state, now, grace);
      // Persist quota even for denied business operations; all replicas share this transaction.
      quota(state, list ? null : rateOwner, now);
      try {
        if (list)
          return {
            serverTime: new Date(now).toISOString(),
            gatherings: Object.values(state.gatherings)
              .filter((g) => !g.cancelled)
              .sort((a, b) => a.startsAt - b.startsAt)
              .map((g) => project(g, owner, named, grace)),
          };
        if (create) {
          const id = hash(`${owner}:${input.operationId}`),
            existing = state.gatherings[id];
          const startsAt = Date.parse(input.startsAt as string);
          const fingerprint = named
            ? hash(JSON.stringify([input.prayer, input.startsAt, name, note]))
            : undefined;
          if (existing) {
            if (
              existing.startsAt !== startsAt ||
              existing.prayer !== input.prayer ||
              (named && existing.creationFingerprint !== fingerprint)
            )
              throw new ApiError(409, 'STALE_COMMAND');
            return { gathering: project(existing, owner, named, grace) };
          }
          if (
            !Number.isFinite(startsAt) ||
            new Date(startsAt).toISOString() !== input.startsAt ||
            startsAt < now + 60_000 ||
            startsAt > now + DAY
          )
            throw new ApiError(400, 'INVALID_TIME');
          if (Object.keys(state.gatherings).length >= 24)
            throw new ApiError(409, 'CAPACITY');
          // Creation allowance is independent of request allowance, including retries.
          const client = state.clients[rateOwner!]!;
          if (client.creates >= (named ? 6 : 3) || state.quota.creates >= 24)
            throw new ApiError(429, 'RATE_LIMITED');
          client.creates++;
          state.quota.creates++;
          const item: Gathering = {
            id,
            ...(named ? { note, creationFingerprint: fingerprint } : {}),
            prayer: input.prayer as Prayer,
            startsAt,
            owner: owner!,
            members: {
              [owner!]: {
                ...(named ? { firstName: name } : {}),
                joined: true,
                revision: 1,
                operationId: input.operationId as string,
              },
            },
            cancelled: false,
            ...(privateGroup
              ? { notificationCreatedAt: now, creatorDevice: device ?? '' }
              : {}),
          };
          state.gatherings[id] = item;
          return { gathering: project(item, owner, named, grace) };
        }
        const item = state.gatherings[match![1]!]!;
        if (!item) throw new ApiError(404, 'NOT_FOUND');
        if (method === 'DELETE') {
          if (item.owner !== owner) throw new ApiError(403, 'NOT_OWNER');
          item.cancelled = true;
          item.members = {};
          if (named) item.note = '';
          return { gathering: project(item, owner, named, grace) };
        }
        if (item.cancelled) throw new ApiError(410, 'EXPIRED');
        const member = item.members[owner!];
        if (member && member.operationId === input.operationId) {
          if (
            member.joined !== input.joined ||
            (named && input.joined && member.firstName !== name)
          )
            throw new ApiError(409, 'STALE_COMMAND');
          return { gathering: project(item, owner, named, grace) };
        }
        if ((member?.revision ?? 0) !== input.expectedRevision)
          throw new ApiError(409, 'STALE_COMMAND');
        if (!member && Object.keys(item.members).length >= 60)
          throw new ApiError(409, 'CAPACITY');
        item.members[owner!] = {
          ...(named && input.joined ? { firstName: name } : {}),
          joined: input.joined as boolean,
          revision: (member?.revision ?? 0) + 1,
          operationId: input.operationId as string,
        };
        return { gathering: project(item, owner, named, grace) };
      } catch (error) {
        if (error instanceof ApiError)
          return { error: { status: error.status, code: error.code } };
        throw error;
      }
    });
  };
}
