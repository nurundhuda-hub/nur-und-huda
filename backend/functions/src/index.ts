import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineBoolean, defineString } from 'firebase-functions/params';
import { allowsOrigin } from './origins.js';
import { requireStagingAccess } from './staging-access.js';
import { requirePublicAccess } from './public-access.js';
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
  description: 'Comma-separated exact restricted staging origins; no wildcard.',
});
const serviceAccount = defineString('PRAYER_SERVICE_ACCOUNT', {
  description:
    'Dedicated service account with datastore.user only; no JSON key.',
});
const stagingAccess = defineString('PRAYER_STAGING_ACCESS', {
  default: '',
  description:
    'Private staging: issuedAt/expiresAt and up to two SHA-256 credential hashes. Missing or expired configuration denies all data access.',
});
const publicEnabled = defineBoolean('PRAYER_PUBLIC_ENABLED', {
  default: false,
  description:
    'Explicit production activation after release checks. Default closed.',
});
const publicOrigin = defineString('PRAYER_PUBLIC_ORIGIN', {
  default: '',
  description:
    'Exact official HTTPS origin, without a path. Separate from staging.',
});
function createStore(document: 'state' | 'public'): Store {
  const ref = getFirestore().doc(`prayerService/${document}`);
  return {
    transact: (work) =>
      getFirestore().runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        const state = snapshot.exists
          ? (snapshot.data() as State)
          : emptyState();
        const result = work(state);
        tx.set(ref, state);
        return result;
      }),
  };
}
const stagingStore = createStore('state');
const publicStore = createStore('public');
function endpoint(
  store: Store,
  origins: () => string,
  access: (credential: string | undefined) => void,
  staging: boolean,
) {
  const service = createService(store, Date.now, !staging);
  return onRequest(
    {
      region: 'europe-west3',
      serviceAccount,
      minInstances: 0,
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
      const origin = req.get('origin');
      if (!allowsOrigin(origins(), origin, emulator)) {
        res.status(403).json({ error: { code: 'ORIGIN_DENIED' } });
        return;
      }
      res.set('Access-Control-Allow-Origin', origin!);
      if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
        res.set(
          'Access-Control-Allow-Headers',
          staging
            ? 'Authorization,Content-Type,X-Staging-Access'
            : 'Authorization,Content-Type',
        );
        res.set('Access-Control-Max-Age', '600');
        res.status(204).end();
        return;
      }
      try {
        // Runs before any storage transaction, including GET. OPTIONS has no data.
        access(req.get('X-Staging-Access'));
        if ((req.rawBody?.length ?? 0) > 2048 || req.originalUrl.includes('?'))
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
}
// Separate endpoints and documents: an Origin header never unlocks staging data.
export const prayerApi = endpoint(
  stagingStore,
  () => allowedOrigins.value(),
  (credential) => requireStagingAccess(stagingAccess.value(), credential),
  true,
);
export const publicPrayerApi = endpoint(
  publicStore,
  () => publicOrigin.value(),
  () => requirePublicAccess(publicEnabled.value()),
  false,
);
export const expirePrayerGatherings = onSchedule(
  {
    region: 'europe-west3',
    serviceAccount,
    schedule: 'every 60 minutes',
    timeZone: 'Europe/Berlin',
    minInstances: 0,
    maxInstances: 1,
    concurrency: 1,
    memory: '256MiB',
    timeoutSeconds: 30,
    retryCount: 3,
  },
  async () => {
    // Retention still runs when production is disabled; never combine the stores.
    for (const store of [stagingStore, publicStore]) {
      await store.transact((state) => {
        prune(state, Date.now());
      });
    }
  },
);
