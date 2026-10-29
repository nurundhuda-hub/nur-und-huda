# Nur und Huda — incremental implementation plan

Date: 2026-10-29. Status: **awaiting audit/plan review; implementation has not started**.
Repository: `nurundhuda-hub/nur-und-huda`. Working branch: `codex/audit-and-rebuild`.

Use [AUDIT.md](AUDIT.md) for evidence/severity and [ARCHITECTURE.md](ARCHITECTURE.md) for the proposed technical decisions. Phases below are future tasks, not completed work or authorization to deploy. Do not modify `main`, merge, deploy, delete the existing site, create other repositories, introduce paid services, or commit secrets under this audit task.

## Phase 0 — Review and baseline (P0)

**Deliver now:** the three requested documents, original-site inventory, reproducible findings, logo checksum, proposed architecture, and visual acceptance criteria.

**Review decisions:** approve the visual scope; choose Astro static + TypeScript or the simpler modular-HTML alternative; identify the operator who will supply legal details and approve religious content. Backend provider and prayer-method choices can remain pending while the visual shell is built.

**Acceptance:** documents reviewed by the project owner; first implementation scope explicitly accepted. Application files and original logo remain unchanged. No deployment or branch merge occurs. A lack of response is not approval to start the rebuild.

## Phase 1 — First visual rebuild and functional baseline (P1)

**Depends on:** Phase 0 review. **Addresses:** A01, A05–A09, A11–A12.

Tasks:

- Preserve all six routes and source content; migrate shared layout/components if Astro is approved. Format source for review. Keep the original website recoverable through version control; no destructive replacement before comparison.
- Introduce the exact five approved colors, monochrome Ruqaa headings, readable Naskh body, subtle geometry, and the original logo. Verify licenses before adding local fonts.
- Keep the exact tagline **منبر للذكر .. ومرجع للعلم النافع**, including the two dots, and keep the hospital name out of prominent homepage branding.
- Build shared responsive navigation/footer with all modules and legal destinations. Add a homepage `h1`, skip link, language/direction annotations, and an explicit current-page state.
- Fix element initialization on every route. Make prayer expansion, imam preview, and library source search work independently. Correct the internal Quran link label and distinguish source-directory entries from book records.
- Preserve honest unavailable states for actual prayer times, community creation/joining, and unpublished sermons. Use existing verified source links; no invented books, dates/times, topics, quotations, or legal text.
- Improve dialog contrast/name/focus behavior, touch targets, empty search results, reduced-motion behavior, anchor clearance, and light-surface text. Add image dimensions without modifying logo pixels.
- Add local build/validation commands and PR checks with no publishing permissions. Record screenshots and behavior evidence when a browser is available.

**Acceptance:** every item in the first-visual-rebuild definition of done below passes. Deliver a reviewable branch/local preview and evidence, not a live service. Functional module implementation continues only in later phases.

## Phase 2 — Legal identity and source register (P1 launch gate)

**Depends on:** operator input; can proceed after Phase 0 alongside visual work. **Addresses:** A04, A07, A09.

Tasks:

- Obtain verified operator identity/contact and assess applicable Impressum requirements. Clearly describe independence from the hospital; do not invent an affiliation/address.
- Inventory current and planned data flows: Pages logs, fonts, source links/embeds, API, admin authentication, contact inbox, gathering capabilities, notifications, and backups.
- Complete Datenschutz for actual behavior; assess Article 6 and any required Article 9 basis for prayer-associated data, processor terms, transfers, rights/withdrawal handling, retention, and optional browser storage. Do not present generic prose as legal approval.
- Create Quellen & Lizenzen entries with asset-specific evidence for King Fahd, Risala, Mawaqit, local fonts, and dependencies. Verify Arabic/German directory links and any selected book edition separately.
- Obtain any needed Mawaqit integration authorization through the operator. Keep Quran and library link-only until intended asset uses are established.

**Acceptance:** operator-reviewed legal disclosures are complete for the functionality being launched; all used assets have a recorded permission basis and correct attribution. Outstanding permissions keep the affected asset/integration disabled. No personal-data form is enabled merely because legal page routes exist.

## Phase 3 — Approved prayer data and live card (P1)

**Depends on:** approved source/location/method; relevant Phase 2 review. **Addresses:** A02.

Tasks:

- Confirm prayer-room coordinates and local timetable authority. Evaluate official Mawaqit URL/widget versus authorized data access; record permission and technical limitations. Do not scrape private endpoints.
- Select and license-review a maintained calculation engine for independent fallback. Obtain explicit Fajr/Isha, high-latitude, Asr, sunset/rounding, and Ramadan decisions from the responsible reviewer.
- Add a source adapter, validity/provenance metadata, cache policy, and approved manual override process. Keep provider secrets server-side. Treat Friday sermon/iqama as a separately approved schedule.
- Implement next prayer, live countdown, five-prayer disclosure, next-day rollover, and source/status display with `Europe/Berlin` logic.
- Test provider outage, stale/missing records, midnight, year change, leap day, spring/fall DST, other device timezones, resumed/sleeping tabs, and device-clock discrepancies.
- Compare approved local references across seasons and Ramadan, with special scrutiny of Fajr/Isha and Maghrib. Agree discrepancy tolerances with the reviewer; do not invent a universal acceptable error margin.

**Acceptance:** reviewer signs off the source/configuration and comparison record; unresolved discrepancies prevent activation. Friday and daily prayer times are distinct. No expired or unapproved times appear as current. Fallback is explicitly identified; absent approved data yields an unavailable state. Test-only synthetic clock fixtures must never ship as real prayer data.

## Phase 4 — Public sermon, study, Quran, and library structure (P2)

**Depends on:** approved content and relevant Phase 2 permissions. **Addresses:** A09–A10.

Tasks:

- Add a rolling eight-Friday schedule in Berlin calendar dates; display only approved topics and label unfilled slots honestly.
- Define validated sermon/study schemas with two parts, source edition/pages, approval metadata, publication date, and revision. Require the exact link **اقرأ الموضوع كاملاً** beneath each published sermon, leading to its actual extended study.
- Create imam reading mode with adjustable large text, print styles, and an explicit versioned offline save/download of approved content. Test Arabic shaping, diacritics, references, and pagination.
- Begin with human-controlled publication of already approved content. AI-assisted drafting remains outside the site; drafts must never enter the public build/repository.
- Build verified library cards (title, original short description, language, subject, source, exact reading link) and title/subject search with empty states. No unauthorized book copies or covers.
- Keep Quran linked to the official source unless a specific permitted asset has been verified. If hosting is approved later, add checksum/integrity checks and qualified review of exact text/rendering.

**Acceptance:** an approved sermon can be read, printed, saved offline, and traced to its approved revision and extended study. Approximate ten-minute length is checked by human reading of both parts. No invented references fill content gaps. Offline reload works for the explicitly saved edition and clearly shows its version. Catalog entries resolve to verified originals. Empty states remain valid if approved content is not yet available; feature acceptance with real content then remains pending.

## Phase 5 — Backend foundation and protected administration (P2)

**Depends on:** provider/retention/privacy review and suitable operating budget; Phase 4 content model. **Addresses:** A03–A04, A10–A12.

Tasks:

- Validate the proposed Supabase EU Free pilot against inactivity, quotas, function/log locations, export/restore, scheduler reliability, and deletion requirements. Do not provision a paid plan. If unsuitable, document an alternative and obtain approval before any spending.
- Add versioned migrations and default-deny database policies. Expose only narrow server APIs; keep private drafts/inbox out of anonymous reads and all static assets.
- Provision one administrator with passkey or strong MFA; implement backend authorization, session revocation, recovery, and MFA-bypass tests. Disable public admin signup.
- Implement an Arabic-capable rich text editor, structured content validation, sanitization, immutable revisions, explicit review/approval, announcements, and a restricted contact inbox/moderation view.
- Implement scheduling around approved revision hashes and Berlin dates; invalidate approval on edit. Publish approved sermons approximately seven days before Friday, with retry/status monitoring and a manual fallback.
- Export only approved, due public content into controlled static builds. Separate scheduled time from actual successful publication, and protect build credentials. Add rollback and encrypted editorial backup/restore procedures.

**Acceptance:** unauthenticated, non-admin, and insufficient-MFA API requests cannot access drafts or perform privileged actions. Malicious rich text is inert. A scheduled draft cannot leak into public JSON, repository, logs, or build artifacts. Approved revision publish/rollback works; failed builds are visible and retryable. The operator accepts the proposed one-hour publication window and outage process, or supplies a different requirement. Restore succeeds without reviving expired community records. Actual backend limitations and total cost are documented before enabling services.

## Phase 6 — Community prayers with expiry and moderation (P2)

**Depends on:** Phase 5 backend/authentication, Phase 2 lawful-processing review, approved retention policy, and prayer/calendar context. **Addresses:** A03–A04.

Tasks:

- Implement nickname, prayer, proposed time, short plain-text message, and multiple concurrent gatherings per prayer. Validate times in the Berlin context; make clear that proposed gathering time is not an authoritative prayer time.
- Add account-free one-click join/undo with per-gathering capabilities, idempotent retries, and transactional deduplication. Do not create a cross-prayer attendance profile.
- Add creator deletion, report handling, administrator removal, input limits, honeypot, and rate limits suitable for shared hospital networks. Include a feature switch to disable writes during abuse/outages.
- Enforce active-only server reads immediately at expiry. Physically purge rows and related capabilities using the approved schedule; redact logs and exclude community data from long-lived application backups/caches.
- Add retention monitoring/retries and test recovery after missed jobs. Document provider-managed log/backup retention; hiding rows is not deletion.

**Acceptance:** two browsers can create separate gatherings for the same prayer and join successfully without accounts; retries do not create duplicate intents. Invalid/oversized/script payloads and expired joins are rejected. Creator controls cannot affect another gathering. No participant list, attendance history, rankings, or gamification appears. Under the proposed policy, data disappears publicly at start + 60 minutes and is physically purged within another 15 minutes; the operator must approve these numbers. Scheduler/free-tier behavior that cannot meet the policy blocks launch. Test messages remain private test data, never production community posts.

## Phase 7 — Optional notifications and release readiness (P3)

**Depends on:** a stable community service and explicit feature approval. Notifications are optional and cannot block the static site's usefulness.

Tasks:

- Add opt-in browser notifications only after an explicit user action. Implement unsubscribe, revoked-permission behavior, invalid-endpoint deletion, expiry, and minimal generic notification content. Verify current iOS/Android/browser restrictions before promising background delivery.
- Complete supported-device, Arabic screen-reader, keyboard, zoom, print/offline, network-failure, and security checks; review future German extensibility.
- Verify actual Pages source/HTTPS, base path, branch protections, workflow permissions, operational ownership, limits, backup restoration, and rollback.
- Prepare a reviewable release artifact, content/license checklist, open-risk list, and operator runbook. Measure performance and error behavior; do not add visitor tracking to do so.

**Acceptance:** notifications never prompt on first page load and gracefully degrade when unsupported. No paid notification channel is introduced. All release blockers are resolved or the affected feature remains disabled. **A separate explicit release instruction is required before merging or deploying; this task does neither.**

## Definition of done — first visual rebuild

This milestone is complete only when the following evidence exists. It does not imply that legal review, live times, sermons, community features, or administration are production-ready.

| Area | Concrete pass condition |
| --- | --- |
| Scope | Application changes are reviewed on a working branch; all existing routes/content remain recoverable; no merge/deploy or live data collection. |
| Logo | Original `assets/logo.jpeg` is byte-identical to SHA-256 `547d63a94e56f7c6a8b4e9f17370dc8f0c1ed3e733cceac7bb61f0fda8b824f5`; served logo matches, is large, uncropped and legible, with reserved aspect ratio. |
| Identity | Exact five approved hex tokens are used for their intended roles. Exact tagline **منبر للذكر .. ومرجع للعلم النافع** appears unchanged. No red decorative text/headings, including color-font glyphs. Hospital name is not prominent. |
| Typography | Licensed local Ruqaa-style headings and readable Naskh body fonts; intact Arabic shaping/diacritics, readable fallback, no automatic remote font requests. |
| Layout | All six pages inspected at 320, 375, 390, 768, 1024 and 1440 CSS-pixel widths, including short landscape. No horizontal page scroll, clipped controls, overlapping text, or lost navigation. Screenshots record browser/viewport/font-loaded state. |
| Real devices | Core navigation/disclosure/dialog/search checked on an iPhone Safari and Android Chrome; tablet and desktop checked. Emulation can supplement but must not be reported as physical-device coverage. Missing devices are an explicitly pending acceptance item. |
| Navigation | All modules/legal links are discoverable; deep links and refresh work beneath `/nur-und-huda/`; local links and assets return successfully. Quran link label describes its actual destination. |
| Interaction | No uncaught page-init errors on any route; prayer disclosure toggles with correct ARIA state; library source search works on homepage and library page, including no-match results; dialog opens/closes by pointer/keyboard and restores focus. |
| Honest states | No invented times, sermon content, source claims, or gatherings. Unapproved prayer data remains unavailable with no active countdown. No create/join/contact submission controls imply an operational backend. |
| Accessibility | One clear `h1` per page, semantic landmarks, skip link, named dialog, labeled controls, visible/unobscured focus, logical RTL keyboard order, language annotations, and meaningful image text. Screen-reader pass with an Arabic-capable voice is recorded. |
| Contrast and targets | All text meets 4.5:1 normal / 3:1 large-text contrast; relevant non-text controls meet 3:1. Primary touch controls target at least 44 × 44 CSS px as a project usability goal. Secondary link spacing/size is checked against WCAG 2.2 rather than assumed from font size. |
| Reflow and motion | Content remains usable at 200% text enlargement and 400% desktop zoom/reflow; no essential content loss. Reduced-motion preference disables smooth motion; sticky navigation does not obscure focused/anchored content. |
| Performance | Provisional mobile lab targets: LCP ≤ 2.5s, CLS ≤ 0.1, public-route JS ≤ 50 KB gzip excluding a future admin bundle. Record device/throttling settings and median of three runs; do not claim field metrics. Preserve the approved image even if a target requires revisiting other page costs. |
| Privacy | Initial-load network inspection shows only intended first-party static requests; no analytics, remote fonts, auto-loaded embeds, or unexpected storage/permission prompts. Legal pages remain clearly draft until verified. |
| Quality evidence | Build/type/lint checks pass if tooling is adopted, plus route/link smoke checks, focused interaction regressions, and automated accessibility checks. Manual contrast/RTL/device evidence accompanies automation; no high-impact accessibility defect remains. |
| Handoff | README has accurate local commands; comparison screenshots and known limitations are supplied. Owner reviews the visual result before the next implementation scope. |

Accessibility thresholds derive from [WCAG 2.2](https://www.w3.org/TR/WCAG22/); the 44px primary-control target and performance budgets above are project goals, not a claim that every one is a WCAG AA requirement.

## Test and operational priorities

Keep checks proportional to delivered behavior. Start with the actual secondary-page crash, navigation, library search, contrast, and static output. Add prayer-clock boundary tests when the clock exists; add authorization, sanitization, concurrent join, retention, and publication tests when their backend exists. Avoid tests that merely duplicate implementation details.

Content integrity is a release check: approved logo/tagline, Quran source checksum if hosting becomes permitted, license register, required sermon study link, and approval-to-revision matching. Synthetic data is allowed only in clearly isolated tests and must not enter public build output.

Every future release needs a named operator, last known good artifact, rollback procedure, known limitations, and evidence that no draft/private data or secret was exported. Automatic dependency or content publication must never bypass the human approval requirements.
