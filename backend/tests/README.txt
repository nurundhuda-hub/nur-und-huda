PRAYER SERVICE — LOCAL TESTS

Use Node 22 and Java 21. Tests refuse any cloud Firestore target: demo-nur-prayer
and loopback 127.0.0.1:8086 only. They do not deploy or activate the service.

  npm ci --ignore-scripts --prefix backend/functions
  npm run build --prefix backend/functions
  node backend/tests/run-emulators.mjs http
  node backend/tests/run-emulators.mjs guarded
  npm run verify

The wrapper creates an ignored, synthetic .env.local temporarily and refuses to
overwrite an existing one. It enables the public API only in the demo emulator,
with origin http://127.0.0.1:4344. Restricted staging remains on origin 4343 with
synthetic credentials. Never deploy while an emulator run is active.

Browser integration (optional tooling, no production account required)
--------------------------------------------------------------------
Install Playwright in a temporary directory outside this repo. Set
PRAYER_PLAYWRIGHT_MODULE to that installation's absolute index.mjs path.
Then:
  node backend/tests/run-emulators.mjs browser

The default uses installed Google Chrome on macOS. PRAYER_BROWSER_EXECUTABLE may
point to another Chromium executable. For the Safari engine, install Playwright
WebKit and set PRAYER_BROWSER_ENGINE=webkit. The runner starts its own foreground
Astro server on 127.0.0.1:4344 with --ignore-lock, preserving an existing dev server,
and closes only its own process group afterwards. It clears ONLY the synthetic
demo Firestore database and uses synthetic Arabic/Latin first names and notes.
Two isolated browser contexts exercise the actual Astro route + compiled HTTP API;
these are NOT two physical phones or a live production acceptance test.
Screenshots: TMPDIR/nur-community-<engine>-320.png and -390.png.

Contracts
---------
prayerApi (restricted staging) keeps the legacy count-only prayer-v1 contract.
publicPrayerApi uses separate storage and prayer-v2 with firstName and optional
note. Both preserve owner capabilities, transaction retries and direct-client
Firestore denial. Public activation defaults off outside the demo tests.
See SIMPLIFIED_SERVICE_REVIEW.txt for current behavior, retention, quotas,
production blockers and the actual two-phone acceptance procedure.

Dependency audit
----------------
  npm audit --omit=dev --prefix backend/functions

This currently exits nonzero for six moderate inherited findings. The guarded
compiled API/cleanup run forbids loading rimraf/glob/minimatch and exercises
synthetic expired-name deletion, but does not prove every cloud authentication
or failure branch. See PUBLIC_LAUNCH_REVIEW.txt. Staging-only risk acceptance
must not be silently extended to production.
