# Controlled two-phone staging test

**Staging only. No public production launch is authorized.** The owner accepted
the six documented moderate dependency findings temporarily for this limited
test in Task 31D. This does not waive them for production.

Open **https://nour-und-huda-staging.web.app/nur-und-huda/together.html**.
The site root redirects there. GitHub Pages is unchanged.

## Access for the two testers

The owner has two different 256-bit access codes in the **private local file**
`.prayer-review/staging-access-31d.json`: `testerA` and `testerB`.
It is ignored by Git, mode 0600, and excluded from all uploaded content.
Give A only `testerA` and B only `testerB` through a private channel. Do not put
codes in URLs, screenshots, GitHub issues, shared documents, or public chat.

On each phone, paste its own 43-character code into **رمز الاختبار الخاص بك**
and tap **دخول الاختبار**. Copy only the code, without JSON quotes. Codes expire
at **2026-11-07 06:58:28 Europe/Berlin** (2026-11-07T05:58:28Z).

The public entry page and static assets are not secret. Every API data request,
including reads, requires a valid code checked by the server. There is no public
registration, client-only access flag, URL secret, or unauthenticated fallback.
Only SHA-256 credential hashes and the validity window are configured server-side.
Missing, invalid, revoked, malformed or expired access fails closed before any
Firestore transaction. Two issued codes authorize their holders; this is a
capability system, not verified identity or a hardware lock. Do not share codes.

The browser sends the code in a dedicated HTTPS header, separate from the existing
ownership token. It stores access in sessionStorage for the tab/session, never in
the URL or localStorage. Tap **خروج من الاختبار** to clear local access. This does
not cancel a gathering or revoke the code on other devices; cancel participation
first when needed. A restored browser session may retain sessionStorage, so use
logout explicitly. Server expiry still applies to every subsequent data request.

## Test on two physical devices

Use synthetic meetings only. Do not coordinate an actual prayer or enter personal
data. Use two separate physical devices, preferably iPhone Safari and Android
Chrome, with one assigned code each. Keep both browser tabs open during the test.

1. **Phone A:** log in, choose a prayer and a test time at least 10 minutes ahead
   in Berlin time, then create a gathering. Accept the privacy consent when shown.
   A should see participant count **1** and an organizer cancellation control.
2. **Phone B:** log in and tap **تحديث**. Open the same gathering and tap
   **انضمام**, accepting consent. Both phones should show **2** after refresh or
   the next visible-page poll (normally within 30 seconds).
3. Rapidly tap Join/reload on B. The count must stay **2**. Duplicate HTTP retries
   were tested automatically; do not expect a disabled button to send requests.
4. On B tap **إلغاء مشاركتي**. Both should show **1** after refresh. Rejoin and
   confirm **2** again.
5. B must not see organizer cancellation. Only A can cancel the gathering.
   The server's rejection of a forged B cancellation was tested automatically;
   you do not need to expose ownership tokens in browser tools.
6. Put B in airplane mode. Refresh/mutation controls should stop working and an
   Arabic offline/error message should appear. Restore connectivity and refresh.
   No action should be silently queued or added twice. Do not treat old displayed
   counts while offline as fresh server confirmation.
7. A taps **إلغاء الجماعة** and confirms. Both lists should become empty after
   refresh. Log out on both phones. Refresh without re-entering a code: no
   gathering data or mutation capability should be available.

Record the phone models, OS/browser versions, test time, observed counts and any
problem. **Do not record codes, ownership tokens, request headers or participant
identifiers.** Physical-device acceptance remains pending until the owner reports
these results. No such test has been claimed by the agent.

## Deployed configuration and verified checks

- Firebase project `nour-und-huda`, account `nurundhuda@gmail.com`.
- Existing Firestore `(default)` remains `eur3`, with deny-all client rules.
- Functions `prayerApi` and `expirePrayerGatherings` are active in `europe-west3`.
  Both use the keyless `prayer-runtime` identity with database-scoped access.
- API: min 0/max 2 instances, concurrency 10, 256 MiB, 15-second timeout.
  Cleanup: min 0/max 1, concurrency 1, 256 MiB, 30-second timeout, 3 retries.
- API Cloud Run invocation is publicly reachable at the transport layer, but
  application access is enforced by the mandatory tester gate. Both the Function
  URL and direct Cloud Run URL were tested against missing/incorrect credentials.
- Cleanup is not public: only the runtime identity has service-level invoker
  access. Scheduler uses its OIDC identity and an hourly Europe/Berlin schedule.
  One authenticated Scheduler-triggered execution succeeded at
  2026-11-04T06:10:31Z. This is not a claim that a later hourly run was observed.
- Live synthetic API checks passed creation retry, concurrent duplicate joins,
  count changes, leave, stale replay and organizer-only cancellation. The test
  gathering was cancelled; no active synthetic gathering was left behind.
- Direct unauthenticated Firestore access and anonymous cleanup calls are denied.
  Wrong-origin API requests are denied; the dedicated staging origin is accepted.
- Built-in metrics are visible for the actual `prayerapi` and
  `expireprayergatherings` services, matching the four configured alert policies.
- The €10 project-only monthly budget remains active, with actual alerts at
  50/90/100% and a 100% forecast alert. Owner email notifications are configured;
  inbox receipt/incident delivery has not been independently confirmed.
- Seven-day container-image cleanup is configured for this project's Frankfurt
  `gcf-artifacts` repository. Deployment initially returned a nonzero exit after
  successfully creating Functions because this policy was absent; it is now set.
- HTTPS checks verified all **28 served files** against the validated payload.
  Credential bytes are absent and private review/environment routes return 404.
  The staging payload is isolated in ignored `backend/.staging-site`.

## Validation limits and remaining concerns

Backend TypeScript, both isolated emulator suites, and `npm run verify` passed
(270 tests, zero Astro diagnostics). The compiled API still passes with
rimraf/glob/minimatch module loading forbidden on the exercised emulator paths.
The six moderate advisories remain installed; no compatible update was available.
The owner's acceptance is for this controlled staging test only.

Browser automation was unavailable (neither in-app browser nor Chrome provider
was available). Mobile rendering, real offline transitions and two physical
devices remain for the owner. Automated UI tests cover login/logout/expiry and
offline handling, but do not replace those checks.

Budget alerts are not a spending cap. Unauthorized invocations can still cost
money even though they cannot access Firestore. Instance limits are not absolute
billing limits. Cross-region Firestore/Functions traffic can add latency/cost.
Request metrics do not cover every platform rejection. The cleanup error alert
does not detect a disabled Scheduler job; monitor its executions during the test.
Production privacy/operator approval remains separate. No push notifications,
production frontend activation, main merge, or LEVANCE resource access occurred.

## Close or revoke access

Expiry automatically blocks data access after the stated deadline; it does not
delete the Functions or stop authenticated cleanup. For early closure, set the
ignored `backend/functions/.env.nour-und-huda` value `PRAYER_STAGING_ACCESS=''`
and redeploy **only** the API with the explicit target:

```sh
firebase deploy --project nour-und-huda --account nurundhuda@gmail.com --config backend/firebase.json --only functions:prayer:prayerApi --non-interactive
```

Do not execute that closure command until the test is finished or needs stopping.
To revoke one code, remove only its SHA-256 hash from the private configuration
and redeploy the same API; one remaining hash is supported. Do not extend expiry
or introduce new testers without a new staging decision.

For abusive traffic, also remove `allUsers` invoker access from the exact
`prayerapi` Cloud Run service; UI logout/CORS alone is insufficient. Keep the
cleanup job and its authenticated invoker intact until short-lived state expires.
Never delete/recreate Firestore or disable billing as a rollback shortcut.
