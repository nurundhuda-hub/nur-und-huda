import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineString } from 'firebase-functions/params';
import {
  ApiError,
  createService,
  emptyState,
  prune,
  type State,
  type Store,
} from './core.js';

const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
if (
  emulator &&
  (process.env.GCLOUD_PROJECT !== 'demo-nur-prayer' ||
    !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ''))
)
  throw new Error('Unsafe emulator target');
initializeApp(emulator ? { projectId: 'demo-nur-prayer' } : undefined);
const allowedOrigins = defineString('PRAYER_ALLOWED_ORIGINS', {
  description:
    'Comma-separated exact staging or approved Pages origins; no wildcard.',
});
const serviceAccount = defineString('PRAYER_SERVICE_ACCOUNT', {
  description:
    'Dedicated service account with datastore.user only; no JSON key.',
});
const ref = getFirestore().doc('prayerService/state');
const store: Store = {
  transact: (work) =>
    getFirestore().runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const state = snapshot.exists ? (snapshot.data() as State) : emptyState();
      const result = work(state);
      tx.set(ref, state);
      return result;
    }),
};
const service = createService(store);
export const prayerApi = onRequest(
  {
    region: 'europe-west3',
    serviceAccount,
    maxInstances: 2,
    concurrency: 10,
    timeoutSeconds: 15,
    memory: '256MiB',
    invoker: 'public',
    cors: false,
  },
  async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Vary', 'Origin');
    const origins = allowedOrigins
      .value()
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    const origin = req.get('origin');
    if (!origin || !origins.includes(origin) || origins.includes('*')) {
      res.status(403).json({ error: { code: 'ORIGIN_DENIED' } });
      return;
    }
    res.set('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
      res.set('Access-Control-Allow-Headers', 'Authorization,Content-Type');
      res.set('Access-Control-Max-Age', '600');
      res.status(204).end();
      return;
    }
    try {
      if ((req.rawBody?.length ?? 0) > 1024 || req.originalUrl.includes('?'))
        throw new ApiError(400, 'INVALID_INPUT');
      if (['POST', 'PUT'].includes(req.method) && !req.is('application/json'))
        throw new ApiError(415, 'INVALID_INPUT');
      const authorization = req.get('authorization');
      if (authorization && !authorization.startsWith('Bearer '))
        throw new ApiError(401, 'OWNERSHIP_REQUIRED');
      const result = await service(
        req.method,
        req.path,
        authorization?.slice(7),
        req.body,
      );
      if ('error' in result && result.error)
        throw new ApiError(result.error.status, result.error.code);
      res.status(200).json(result);
    } catch (error) {
      const safe =
        error instanceof ApiError ? error : new ApiError(503, 'UNAVAILABLE');
      if (safe.status === 429) res.set('Retry-After', '60');
      // Never log tokens, request bodies, prayer participation or raw IPs.
      res.status(safe.status).json({ error: { code: safe.code } });
    }
  },
);
export const expirePrayerGatherings = onSchedule(
  {
    region: 'europe-west3',
    serviceAccount,
    schedule: 'every 60 minutes',
    timeZone: 'Europe/Berlin',
    maxInstances: 1,
    timeoutSeconds: 30,
    retryCount: 3,
  },
  async () => {
    await store.transact((state) => {
      prune(state, Date.now());
    });
  },
);
