> **Task 28 update:** the owner now prefers automatic Actions publication. See [AUTOMATIC_PUBLISHING.md](AUTOMATIC_PUBLISHING.md). The Task 27 supervised branch publisher below remains inactive and must not run concurrently with the Actions deployment process. No live Pages setting has changed.

# First sermon release — Task 27

**Content is ready; the embargo remains active until 2026-11-06T07:00:00Z** (Friday 08:00 Europe/Berlin, CET). **No unattended schedule is configured or claimed. Nothing has been deployed by Task 27.**

## Duration and authorization

The owner explicitly replaced mandatory human-timed reading with an owner-approved approximate duration. The public model now records `basis: owner-approved-estimate`, `humanTimed: false`, `minutes: 10`, the owner's identifier, the actual decision-recording instant and an explanatory note. The display is **المدة التقريبية: 10 دقائق**. There is no claim that anyone timed the sermon.

The original corrected content approval remains unchanged:
`4008249eb6bc4213b1dea67c669f8e2a8c382357833584992f8cbb186f4af827`.

Original source hashes remain:

- Sermon r1: `f9821148c5846d19c5cc2e89a70f286baf266807ea12ef535afdb9ee7b75f44f`.
- Study r2: `0dcfe99f50f25ab56268b1965df1be1b349aca885e60c0950419e370d09cd858`.

The prior publication authorization is preserved, seal `9102bc8f2cc3508103a39bd19bbfff8a86873ab05b4a848a2ecc2c276c7800cb`. Task 27 records the policy change without editing any earlier approval, source or review artifact. The exact source text and reference mapping are retained; only the duration metadata and corresponding release seals change. Historical intake blockers are reconciled using the completed owner-accepted evidence and explicit decisions, not new invented scholarly attestations. The owner's original approval remains the authority for the religious text and limited-quotation assessment.

New private files, all ignored and mode 0600, are `task27-candidate.json`, `task27-reviewed.json`, `task27-approved.json`, `task27-prepared.json`, `task27-authorized.json`, `task27-public-catalog.json` and `task27-receipt.json`. The original Task 23 preparations remain immutable historical artifacts.

- Authorized catalog digest: `04fe4d7bbc54913d791197ab385493e290c0d1657c637e4397f77ca3472794e9`.
- Publication authorization seal: `2e08855928468901bcd8e99b3419f2a7710b164878a5a451f2ca59021cc0e7f1`.
- Task 27 receipt seal: `61185eb64cc870ed27b8c6d9d7f574e8ac21a45d4b1d1fe450eed8e380fbf428`.

The public-safe code pins only the catalog digest, revision identifiers and deadline. It contains no sermon body, study body, private approval record or credential. The source checkout's public catalog stays empty; local navigation continues to use the existing guarded readers.

## Supervised release process

The read-only GitHub check on 2 November confirmed that Pages currently serves the **legacy `main:/` source**, with its existing dynamic `pages-build-deployment` workflow. No setting was changed. The new local `sermon:release` command builds Astro output privately and, only after the deadline and an explicit publish command, publishes the checked static files to **`gh-pages` in this same repository** and selects that branch as the Pages source. It does not merge or modify `main`.

GitHub supports a dedicated static-output branch with `.nojekyll`; its Pages deployment still runs asynchronously. [GitHub publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site). Updating the source uses the official Pages API. [GitHub Pages API](https://docs.github.com/en/rest/pages/pages#update-information-about-a-github-pages-site).

This is a supervised manual release with retry, not an active timer. An operator must run it at or after the boundary on an awake, connected machine with a correct UTC clock. Build, queue and CDN propagation mean availability may be later than 08:00. No exact-minute cron guarantee is assumed. No paid service, background agent, Actions cron or private payload upload is configured.

### Before Friday

Use the clean `codex/audit-and-rebuild` checkout, installed locked dependencies and Node version from the README. Keep `.sermon-review/` local. Confirm GitHub authentication for this repository, push permissions, Pages administration permissions and a configured Git author identity. Do not upload a private review wrapper, future-dated source catalog or prebuilt content-bearing artifact to a public branch.

```sh
npm run verify
npm run sermon:release -- check --catalog task27-public-catalog.json
```

The second command validates the exact catalog and then intentionally exits nonzero before the embargo expires. It records a private failure/blocked receipt; it does not contact GitHub, build a content-bearing public directory or deploy. This is expected until the authorized instant.

### At or after 2026-11-06T07:00:00Z

```sh
npm run sermon:release -- publish \
  --catalog task27-public-catalog.json \
  --confirm-sha256 04fe4d7bbc54913d791197ab385493e290c0d1657c637e4397f77ca3472794e9
```

The command:

1. Validates the pinned catalog digest, revision approvals/history, owner-estimated duration, exact pair and simultaneous publication instant. Checks actual wall time before any publication work.
2. Requires a clean working branch and the exact repository; runs `npm run verify` on safe source. Rejects unexpected Pages settings. Acquires a local publication lock.
3. Archives the committed source into an ignored private temporary directory, injects only the public-shaped catalog there, builds with the real clock and runs production link/asset/privacy validation. No review wrappers or credentials are copied into `dist`.
4. Checks public navigation, both texts, study links, Imam controls, duration wording and offline artifact. Inventories output bytes, rejects hidden/private files and symlinks, and checks the staged distribution against that inventory.
5. Rechecks time, pushes only the distribution to `gh-pages` without force, then selects `gh-pages:/` through the Pages API. A concurrent remote update causes a safe push failure. `main` stays unchanged.
6. Polls public output up to 30 attempts, with a 10-second interval and bounded HTTP requests. Success requires the official Pages API to report a completed build for the expected distribution commit, plus matching public bytes for the manifest, all pages/downloads and JS/CSS/font/image assets. Push/API acceptance alone never means success.

### Failure and retry

Every attempted publish has an ignored `release-run-*.json` receipt with its phase, source/distribution commits, inventory and observed status. Failed verification means **not verified**, not necessarily unpublished: a successful push or Pages source update may already have started deployment. Do not blindly roll back, force-push or change the time.

- If the safe-source checks fail, run `npm run verify` to see full diagnostics and fix them before retrying.
- If GitHub rejects authentication, permissions, branch updates or settings, fix the specific reported phase. Existing source settings are recorded in the receipt.
- If propagation is merely late, rerun verification using the receipt filename:

```sh
npm run sermon:release -- verify --receipt release-run-REPLACE-WITH-ACTUAL-ID.json
```

- To retry the complete release, rerun the same `publish` command. It revalidates and rebuilds, fetches the current distribution parent, and makes a new fast-forward release commit (including an empty commit when needed to request another Pages build).
- An interrupted process can leave `.sermon-review/release-publish.lock`; check that no publisher remains active before removing only that lock. Normal success/failure removes its own lock and temporary build directory. Never delete the original private sources.

No live push, Pages source switch, deployment or CDN verification has been performed before the authorized instant. Those integration steps cannot honestly be called verified yet. The remaining activation requirement is an operator running the tested command after the deadline; no human-timing or content-approval blocker remains.

## Intended public URLs

These are release targets, **not a claim of current availability**:

- Overview: https://nurundhuda-hub.github.io/nur-und-huda/sermons.html
- Sermon: https://nurundhuda-hub.github.io/nur-und-huda/sermons/learn-our-religion/r1.html
- Study: https://nurundhuda-hub.github.io/nur-und-huda/studies/learn-our-religion-study/r2.html
- Offline: https://nurundhuda-hub.github.io/nur-und-huda/downloads/sermons/learn-our-religion/r1.html

## Validation boundary

Synthetic tests exercise actual Astro builds before, at and again before a past fixture deadline, keeping both real source files private. Public navigation, Imam controls, approximate duration, study links and offline rendering are checked against these built pages. Separate tests cover changed catalogs/seals, owner-estimate requirements, host timezones/DST, invalid output/symlinks, HTTP errors, stale public bytes and exhausted/successful retries. The real approved catalog is validated and rendered locally in memory without a future production build or network disclosure. Normal production output remains six core pages with an empty release manifest until the release command is used after the embargo.
