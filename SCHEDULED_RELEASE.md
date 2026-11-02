# Task 23 — first sermon scheduled-release preparation

**Prepared privately, not activated.** Sermon `learn-our-religion/r1` and study `learn-our-religion-study/r2` share the earliest permitted publication instant **2026-11-06T07:00:00Z**: Friday 6 November, 08:00 **Europe/Berlin (CET, UTC+01:00)**. The conversion uses the existing IANA-timezone calendar adapter, not the computer's local timezone or a fixed year-round offset.

## Approval and content preparation

The corrected private content-only approval seal was verified against the expected value:

`4008249eb6bc4213b1dea67c669f8e2a8c382357833584992f8cbb186f4af827`

Validation reconstructs the original approval, its exact source/evidence-bound review and the reviewer-only correction. It checks the original byte hash, correction chronology, unchanged attestation and content scope. Reviewer: Ahmad Ghalayini. The original and corrected approvals remain unchanged. Original source hashes remain:

- Sermon r1: `f9821148c5846d19c5cc2e89a70f286baf266807ea12ef535afdb9ee7b75f44f`.
- Study r2: `0dcfe99f50f25ab56268b1965df1be1b349aca885e60c0950419e370d09cd858`.

New files stay exclusively in ignored `.sermon-review/`:

- `task23-scheduled-preparation.json`: binds the corrected approval and both source hashes to one local/UTC schedule. Seal: `8a12442368dd9ce27da2f5e44d67939cee5363f3c3751117520dcacd2d4149c6`.
- `task23-publication-candidate.json`: exact mapped sermon/study wording and section order, both publication instants, series membership, source attribution and citation metadata. Candidate digest: `e57302480b1a8c81d8c65f7d98f0134bc5e8bdda8b2114cc735231b46b6d440a`.
- `task23-candidate-evidence.json`: records the candidate digest, source/approval bindings, provenance of prepared reference metadata and outstanding release requirements.

Only supplied Markdown formatting/structural whitespace is interpreted; Arabic words and diacritics are unchanged. Reference metadata reflects the owner's acceptance of the documented source findings in the content approval, not an invented new independent scholarly review. The prepared public-shaped candidate still has **draft release approvals**, null human duration and no history seals. It is not a deployable catalog. The exact real pages/download have therefore **not** been generated as a production release or placed in `dist/`.

The existing Astro detail/study/download templates remain the rendering path. Synthetic production builds exercise sermon/study links, series navigation, imam controls, print CSS and embedded-font offline reading. Existing real local previews remain separate from publication readiness.

## Static embargo behavior

All public routes derive from `sermonRelease`, which validates approvals and selects only records whose `publishAt` has arrived at the build snapshot. A public build refuses a future snapshot. Both exact revisions must use the same scheduled instant for this release. Versioned page paths, download paths and release metadata are generated from that same filtered projection; pre-release manifests contain empty release arrays. No sitemap generator is installed. Tests scan every generated HTML/JSON/JS/XML/map/text output for the embargoed fixture marker; any future sitemap/feed must also derive from this projection.

Tests perform three actual isolated Astro builds with synthetic content and a past test date: one second before release, exactly at release, then before release again. Both content pages and the download are absent before release, present at release, and removed by the subsequent pre-release rebuild. These tests do not change the real catalog or fake the production wall clock. Actual November-date boundary checks, summer/winter offsets, DST gaps/folds and multiple host timezones are covered separately.

**A public Git commit is itself disclosure.** Do not place the real candidate, private approval records or a future-dated catalog containing the bodies in this public repository before the embargo expires. Do not upload prebuilt content-bearing artifacts, preview URLs, logs or caches before then. A hidden page, `noindex`, omitted navigation, or browser-side countdown does not protect static files. Keep all pre-release real preparation local.

## Proposed activation mechanism

Use an **owner-supervised, one-off `workflow_dispatch` Pages deployment**, with manual monitoring and retry, after the deadline and separate authorization. This is an earliest-publication boundary, not a promise of availability at exactly 08:00. GitHub documents that scheduled events can be delayed or dropped, especially at the beginning of an hour; a single 07:00 cron is not a reliable exact-minute release. [GitHub scheduling limitations](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows#scheduled-workflows-running-at-unexpected-times).

No workflow, cron, external timer, paid service or Pages setting is enabled by this task. The activation implementation must:

1. Run only from the owner-authorized `main` commit, with one deployment at a time (`cancel-in-progress: false`). Use manual dispatch and monitor its completion; queued/delayed jobs must remain safe. Record the commit/artifact identity for retries.
2. Keep real content local until both the UTC boundary and explicit disclosure authorization. Before the boundary, finish the private release review/approval and retain its public-safe catalog locally. At or after the boundary, and only with authorization, transfer **only that catalog** to public source; never transfer review wrappers or credentials.
3. Build cleanly after the boundary. Run the existing checks, then the release check below **before artifact upload**. A pre-release build cannot be reused merely because time has passed: it contains no eligible pages. The check requires a current validated catalog, a non-future build snapshot at/after the deadline, the two exact revisions with identical publication times, and their page/download paths.
4. Upload only the checked `dist/` artifact, and deploy that same artifact. Use the documented `github-pages` environment and required `pages: write` / `id-token: write` permissions. Never upload the repository root. Pin reviewed action versions when the workflow is authorized. [GitHub Pages custom workflow requirements](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
5. Recheck actual UTC immediately before deploy; do not rely on an environment-supplied future clock. Monitor Pages completion and then check the two URLs, download and manifest. If the run fails or the release is absent, retry the same authorized release with a fresh build. Keep the prior site until a checked deployment succeeds. Do not treat dispatch acceptance as deployment success.

This supervised mechanism trades exact-minute availability for a strict no-early-publication boundary and observable completion. Queue, build and Pages propagation latency can delay availability. Unattended operation would require a separately authorized method for securely delivering the private payload and monitoring retries; that is neither configured nor implied here.

## Commands and remaining authorization

The private schedule CLI was run as follows (exclusive output creation; rerunning cannot overwrite the record):

```sh
npm run sermon:schedule -- \
  --approval content-approved-r1-r2.v2.json \
  --original-approval content-approved-r1-r2.json \
  --confirm-approval-sha256 4008249eb6bc4213b1dea67c669f8e2a8c382357833584992f8cbb186f4af827 \
  --review task21-content-review.json \
  --evidence task21-content-evidence.json \
  --report task21-content-report.md \
  --friday 2026-11-06 --time 08:00 \
  --out task23-scheduled-preparation.json
```

The future deployment prerequisite, which intentionally fails now, is:

```sh
npm run sermon:release-check -- \
  --publish-at 2026-11-06T07:00:00Z \
  --sermon learn-our-religion --sermon-revision r1 \
  --study learn-our-religion-study --study-revision r2
```

**Not ready for activation yet.** Required next steps:

1. Supply the actual human reading-duration record: measured/accepted minutes, reviewer, real review instant and acceptance note. The existing 598-word estimate is not this record. No duration has been fabricated or the gate weakened.
2. Finish review of the scheduled public candidate/reference mapping and reconcile the historical intake blockers using the completed evidence. The owner must accept the time-dependent next-Friday wording in the planned sequence; no second sermon date/content is invented. Use a new private candidate filename when adding duration, preserving this prepared version. Then complete the existing exact-hash release review/approval and private preparation, as documented in `SERMON_CONTENT.md`.
3. Separately authorize public disclosure, the public catalog change, merge and deployment/workflow activation. The scheduling decision and content-only approval do not grant those actions. Adapt the deliberately-empty-catalog tests/private-source exclusion only for the exact disclosure-authorized release in that later change; do not disable privacy checks generally.

Complete release approval before its chosen publication instant, as required by existing chronology validation. If that deadline passes with unmet checks, do not backdate approval: obtain a new publication instant. No final release approval, public-content commit, merge, workflow activation or deployment occurs in Task 23.
