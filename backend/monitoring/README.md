# Prayer staging monitoring

Scope: **nour-und-huda only**, Functions in `europe-west3`, existing default
Firestore in `eur3`. This configuration does not deploy or authorize the service.

## Configured on 2026-11-04

The existing project-only **€10 calendar-month budget** was verified through the
Budgets API with `scope=projects/nour-und-huda`. Its existing actual-spend alerts
at **50%, 90%, 100%** were retained. A **100% forecast** alert was added. Credits
are included, so this budget measures net spend after applicable credits.
The amount, project filter, and existing default billing recipients were unchanged.

An enabled email channel named **Nur staging operator**, addressed to
`nurundhuda@gmail.com`, was created in this project and attached to the budget
and all four policies. Its resource is
`projects/nour-und-huda/notificationChannels/5131384501807781279`.
The API omits verification status; this is **not evidence of inbox delivery**.
No test incident, test email, or artificial charge was generated.

| Policy             | Trigger                                                | Cloud policy ID        |
| ------------------ | ------------------------------------------------------ | ---------------------- |
| API errors         | At least one 5xx in a 5-minute window                  | `2891156756156943783`  |
| API throttling     | At least one 429 in a 5-minute window                  | `13924954507924479039` |
| Excessive requests | More than 100 requests/minute, sustained for 2 minutes | `4532517948439921955`  |
| Cleanup errors     | At least one 5xx in a 5-minute window                  | `5161105580077534994`  |

These are deliberately sensitive **synthetic staging** thresholds, not claims
about acceptable error rates. The global application limit remains 120/minute.
All policies sum across revisions/instances and use built-in
`run.googleapis.com/request_count`; no custom billable metrics or payload logs
were introduced. The generator is [policies.mjs](./policies.mjs).

Policies are enabled, with explicit project, region and service filters.
Expected service names are `prayerapi` and `expireprayergatherings`, based on
Firebase CLI's Gen 2 naming convention. **No deployed service exists yet.**
Compare these filters with `serviceConfig.service` from the eventual deployed
Functions before treating the alerts as protecting the acceptance test.

## Limits and remaining verification

- Budget alerts are delayed notifications, **not a €10 hard cap**. No spend cap,
  automatic billing shutdown, or paid external monitoring service was configured.
- Cloud Run request metrics exclude requests rejected before reaching instances,
  including some capacity/IAM rejections. They do not measure every attack request.
  Metrics may lag by several minutes. Inspect platform-level errors during tests.
- A cleanup 5xx policy detects failures that reach the cleanup container. It does
  not detect a missing/disabled Scheduler job or rejected Scheduler authentication.
  After deployment verify Scheduler executions and establish its missing-success
  alert (two missed hourly runs), without generating predeployment false alarms.
- No endpoint uptime, live runtime IAM, scheduler delivery, regional latency,
  phone/tablet layout, or notification receipt has been verified by this task.
- No notification payload should include bearer tokens, request bodies, prayer
  participation or names. Provider request logs have separate retention/privacy
  implications; review them before allowing real participants.

## Before the controlled two-device test

1. Resolve the outstanding dependency disposition described in
   [STAGING_SAFETY_REVIEW.txt](../tests/STAGING_SAFETY_REVIEW.txt). No automatic
   risk acceptance is recorded.
2. Authorize a synthetic-only staging deployment separately. Recheck active
   account `nurundhuda@gmail.com`, project and the reviewed branch/revision.
3. Verify deployed runtime identity, default database access, deny-all Rules,
   exact origin, instance limits and authenticated hourly cleanup.
4. Confirm actual service names match the filters above, and the metric series
   appear. Test notification delivery using Cloud Monitoring's channel test
   facility where offered; record the operator's receipt. Do not manufacture a
   billing charge. Record budget delivery at its first genuine threshold event.
5. Exercise API alert delivery with synthetic failures only in a separately
   authorized test; do not publish a special public failure endpoint. Confirm
   that normal two-device traffic is below the volume threshold.
6. Follow `PRAYER_SERVICE.txt` Phase C using synthetic data only. Keep the public
   frontend disconnected until its separate privacy and acceptance gates pass.

## Reconciliation and rollback

Read these **project-scoped** resources, compare with `alertPolicies(channel)`,
then update the matching policy ID rather than creating duplicates. When using
the Budgets API, list with `scope=projects/nour-und-huda`; preserve the exact
single-project filter, amount, existing thresholds/recipients and current etag.
Never run an account-wide budget update. Cloud APIs may evolve; recheck their
official schemas before applying updates.

For alert noise, adjust only the corresponding policy or temporarily snooze it
with a recorded expiry; do not silently disable the entire operator channel.
To reverse this task's budget addition, remove only the forecast threshold and
new channel association using the latest etag. Keep the original €10 budget and
50/90/100% alerts. No rollback action was executed.

For service failure, use the operational rollback in
`backend/tests/STAGING_CONFIGURATION.txt`: disable frontend interactions, and
revoke public API invocation if necessary. Keep authenticated cleanup running
until short-lived records expire. Do not delete/recreate Firestore or disable
project billing as an emergency shortcut.

## Reproducible checks

```sh
npm ci --ignore-scripts --prefix backend/functions
npm run build --prefix backend/functions
firebase emulators:exec --project demo-nur-prayer --only firestore,functions --config backend/firebase.json 'node backend/tests/emulator.mjs'
firebase emulators:exec --project demo-nur-prayer --only firestore --config backend/firebase.json 'node backend/tests/runtime-audit.mjs'
npm audit --omit=dev --prefix backend/functions
npm run verify
```

The audit currently exits nonzero for six moderate findings; do not mask that
status or call it a clean audit. The guarded runtime test covers the compiled
API and cleanup handler with synthetic loopback Firestore, not the real Scheduler
or cloud OAuth/ADC paths. It will intentionally fail if a future change loads
`rimraf`, `glob` or `minimatch`, prompting a new reachability review.

## References

- [Project-scoped budget listing](https://docs.cloud.google.com/billing/docs/reference/budget/rest/v1/billingAccounts.budgets/list)
- [Budget thresholds and notifications](https://docs.cloud.google.com/billing/docs/reference/budget/rest/v1/billingAccounts.budgets)
- [Cloud Run metric definitions](https://docs.cloud.google.com/monitoring/api/metrics_gcp_p_z#run)
- [Notification channel status](https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.notificationChannels)
