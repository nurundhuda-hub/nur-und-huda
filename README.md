# نور وهدى — Nur und Huda

**منبر للذكر .. ومرجع للعلم النافع**

Arabic-first, non-commercial educational website. Phase 1 uses **Astro static output, TypeScript, and modular CSS**. No React SPA, user accounts, analytics, or notifications. The optional Firebase prayer-coordination backend is prepared separately; the public build remains disconnected until production configuration and privacy checks are satisfied.

The homepage uses the official MAWAQIT widget; our independent countdown stays inactive. Unreleased sermons remain excluded from builds; local development links the private sermon/study through the normal sermon page. Quran/library entries link to original sources; no Quran text or books are hosted. Legal operator details still require review.

## Private-group release — current destination

The prepared replacement uses the existing Firebase Hosting site **https://nour-und-huda.web.app**, with every website page, asset and prayer API request passing through a server-side shared-code gate. Hosting's static directory is empty. A random, server-validated `Secure; HttpOnly; SameSite=Lax` session lasts up to 365 days; there are no accounts or individual passwords. The code and session cookie never enter frontend JavaScript. The new group data is separate from both restricted staging and the older public-API preparation.

New logins receive a 365-day server expiry and cookie `Max-Age=31536000`. Existing 90-day sessions remain valid until their original expiry; deployment does not silently extend them. Logging out and signing in again creates a new 365-day session. Logout revocation, shared-code rotation and hourly expiry cleanup are unchanged.

**Deployed on 2026-11-04:** open **https://nour-und-huda.web.app**. Live two-session WebKit acceptance passed; physical iPhone acceptance remains for the owner. GitHub Pages and the staging site remain unchanged. See [the deployment result](backend/tests/PRIVATE_LAUNCH_RESULT.txt) and [private release runbook](backend/tests/PRIVATE_GROUP_RELEASE.txt). These supersede the earlier public-API rollout instructions below. Do not use the older Pages publishing commands to release this private site.

```sh
npm run build --prefix backend/functions
npm run private:prepare
npm run private:check
node backend/tests/run-emulators.mjs http
node backend/tests/run-emulators.mjs guarded
# Optional Playwright installation outside the repository:
PRAYER_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs PRAYER_BROWSER_ENGINE=webkit node backend/tests/run-emulators.mjs private
npm run verify
```

The private test uses local HTTPS at `https://localhost:4443`, an ephemeral self-signed certificate, and demo-only Hosting/Functions/Firestore emulators. Certificate bypass exists only in the test browser. Two isolated sessions exercise the shared-code form, persistent cookie, named prayer flow, logout and direct-asset protection. It is not proof of a cloud deployment or two physical iPhones.

For a separately authorized live acceptance run, use `PRAYER_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs PRAYER_BROWSER_ENGINE=webkit node backend/tests/private-live.mjs --authorized-live`. It targets only the existing private site, reads the code locally without printing it, creates synthetic gatherings and cancels them afterward. It never resets the database. Results stay under ignored `.prayer-review/`; no cookies, tokens or access codes are written to the report. Do not share private credentials or include them in test logs.

`npm run private:keys` generates a new local-only code packet under ignored `.prayer-review/group-production-access/`, refuses overwrite, and prints no credentials. A packet already exists on the owner's working machine; do not rerun to replace it. `private:prepare` creates the ignored server-only bundle at `backend/functions/private-site/`; never copy it to Hosting's public directory or a public build artifact. No command above deploys anything. Private sermon review routes remain loopback-only and are not included even behind the shared-code gate.

**Task 09 source decision:** a verified local mosque timetable is the primary source, provisionally As-Salam Moschee Hamm. Adhan calculations are comparison/diagnostics only. No authorized local timetable has been obtained; production remains inactive. See [LOCAL_TIMETABLE_REVIEW.md](LOCAL_TIMETABLE_REVIEW.md).

## Community prayer coordination

The simplified Arabic flow supports first names, optional notes, multiple gatherings per prayer, one-tap join/leave and organizer-only cancellation. Names are remembered locally; no accounts or production tester codes. Public and restricted staging APIs use separate state and contracts. **Implemented locally, not publicly deployed or verified on physical phones.** The default public build remains disconnected.

See [the current implementation and release status](backend/tests/SIMPLIFIED_SERVICE_REVIEW.txt) for retention, limits, production blockers and the two-phone checklist. [The release preparation](backend/tests/PUBLIC_LAUNCH_REVIEW.txt) records the official Pages setup and rollout steps. Historical Task 30 count-only behavior is superseded for the public API; restricted staging retains its legacy contract.

```sh
npm run build --prefix backend/functions
node backend/tests/run-emulators.mjs http
node backend/tests/run-emulators.mjs guarded
npm run verify
```

For optional real browser tests, install Playwright outside the repo and set `PRAYER_PLAYWRIGHT_MODULE` to its `index.mjs`. Run `node backend/tests/run-emulators.mjs browser`; set `PRAYER_BROWSER_ENGINE=webkit` for the Safari-engine run after installing Playwright WebKit. The runner starts a loopback Astro server on port 4344 and demo-only Firebase emulators, then stops its own servers. It does not replace an existing dev server or touch cloud data. Browser tests use synthetic names and are not physical-device acceptance.

## Local development

Use Node **22.23.3** (`.nvmrc`), or a supported Node version from `package.json`, and npm. Astro 7 requires at least Node 22.22.0. Install the locked dependencies:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4321/nur-und-huda/index.html**. Use the port printed by Astro if 4321 is busy. The explicit file URL works in both development and production preview; development also accepts `/nur-und-huda` without a trailing slash. All internal paths deliberately include the GitHub Pages project base.

The original root HTML/CSS/JS files remain unchanged as a migration reference. **Opening root `index.html` displays the old prototype.** The maintained application is in `src/`; use Astro to view the rebuild. The build does not include the legacy pages/scripts.

### Read the first sermon locally

In `npm run dev`, use the normal **منبر الجمعة** navigation (`/nur-und-huda/sermons.html`). A card marked **قراءة محلية — غير منشورة للعامة** provides the first lesson's reading, Imam Mode and extended-study links. It uses the existing private local readers without copying text into the public catalog. Keep the original sources/imports in `.sermon-review/`; missing or invalid inputs remain unavailable rather than falling back to invented text.

Task 25's verified server is **http://127.0.0.1:4342**:

- Normal sermon page: `/nur-und-huda/sermons.html`
- Sermon r1: `/nur-und-huda/_review/first-sermon`
- Immediate Imam Mode: `/nur-und-huda/_review/first-sermon#imam`
- Study r2: `/nur-und-huda/_review/first-study`

These work only in loopback local development, not `npm run preview` or GitHub Pages. The normal production page, embargo and publication catalog remain unchanged. To repeat the full HTTP navigation and served-JavaScript test, use the port printed by the running development server:

```sh
npm run validate:sermon-preview -- http://127.0.0.1:4342/nur-und-huda/sermons.html
```

The test starts at the homepage and follows the normal links to both actual sources. Its JSDOM execution checks reader interactions, not native browser layout or printing/fullscreen behavior.

## Build and verify

```sh
npm run verify
```

This runs strict Astro/TypeScript checks, a production build, Vitest DOM/interaction/accessibility checks, static route/asset/integrity validation, and formatting checks. `npm test` builds before testing so tests inspect actual output. No script deploys anything.

| Command                       | Purpose                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `npm run check`               | Astro/TypeScript diagnostics                                                         |
| `npm run build`               | Prepare verified assets and emit six static pages to `dist/`                         |
| `npm test`                    | Build and run behavior, emitted-script, structural accessibility, and contrast tests |
| `npm run validate`            | Validate existing `dist/` routes, fragments, asset paths, fonts, logo and JS budget  |
| `npm run format`              | Format maintained source, tests and implementation documentation                     |
| `npm run format:check`        | Check formatting without changing files                                              |
| `npm run prayer:compare`      | Report differences against attributed Hamm reference samples, without approval       |
| `npm run prayer:draft -- ...` | Generate an unapproved offline review artifact; see the validation report            |

For an HTTP check of the production output:

```sh
npm run build
npm run preview -- --port 4321
npm run validate:http
npm run preview:stop
```

`validate:http` expects the preview on `127.0.0.1:4321`. Astro 7 preview runs as a background process; stop it using the last command. Build-tool telemetry is disabled by the project CLI wrapper without modifying global preferences.

DOM tests do not render pages. They cannot establish mobile layout, native dialog focus trapping/Escape, screen-reader usability, or measured loading performance. See [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) for verified results and pending checks.

## Preserved public routes

| Built path beneath `/nur-und-huda/` | Page                                                     |
| ----------------------------------- | -------------------------------------------------------- |
| `index.html` (also project root)    | Homepage, prayer disclosure, source search, imam preview |
| `together.html`                     | نصلّي معاً — inactive community service                  |
| `sermons.html`                      | Sermon/schedule empty states and reading-mode preview    |
| `quran.html`                        | Official Quran source links                              |
| `library.html`                      | Searchable Arabic/German source directory                |
| `legal.html`                        | Sources/licenses and clearly marked legal drafts         |

Existing homepage fragments `#home`, `#prayer`, `#together`, `#sermons`, `#library`, and legal fragments `#sources`, `#privacy`, `#impressum` are preserved.

## Source organization

- `src/pages/`: six Astro pages, emitted as real `.html` files.
- `src/layouts/`, `src/components/`: shared RTL layout, navigation/footer, prayer card, directory and dialog.
- `src/scripts/`: small element-scoped TypeScript modules; no global page assumptions.
- `src/lib/`: base-path helper, verified directory destinations and pure prayer-data validation/clock logic.
- `src/data/prayer-data.ts`: inactive production prayer payload (`null`).
- `src/lib/prayer-calculation/`: configurable offline Adhan adapter and civil-date/reference helpers.
- `src/data/prayer-settings.ts`: provisional hospital coordinates; calculation and Friday settings remain `null`.
- `validation/`: attributed research samples and explicitly unapproved example settings, excluded from public output.
- `src/styles/`: exact palette tokens, foundations, layouts, components and print styles.
- `scripts/`, `tests/`: build preparation and validation.
- `assets/logo.png`: unchanged original artwork; `assets/logo.webp` is its retained lossless derivative. The homepage now serves the exact owner-reviewed `assets/logo-transparent.png` (1672 × 941), SHA-256 `bdd7b6cdcdc87d71efdd4069160261ddaac157c9fa03ef874d3e035aa504d7fb`. This deterministic alpha-mask derivative preserves all original RGB values. Owner approval covers its reviewed appearance on the emerald homepage, including the documented flattened-source shadow/edge limitations. Build preparation copies the approved bytes without generating, resizing or recompressing them, and validation checks the source and packaged hashes. The old CSS edge mask is disabled; the private review files and extraction tooling are not published.
- `public/.nojekyll`: static-host compatibility marker; it does not configure or trigger deployment.

## Fonts and identity

The exact tagline and five approved colors are preserved. **Aref Ruqaa** (not the multicolored Ink variant) supplies decorative headings; **Amiri** supplies Naskh body text. Arabic and Latin subsets are bundled locally through pinned `@fontsource` packages, with no Google Fonts requests.

Both font packages carry **SIL Open Font License 1.1**. Their unchanged copyright/license notices are copied to `dist/licenses/` and linked from the legal page. Sources: [Aref Ruqaa](https://fontsource.org/fonts/aref-ruqaa), [Amiri](https://fontsource.org/fonts/amiri). Fonts are not renamed or modified. The asset validator checks the equivalent supplied WOFF subsets for color-font tables.

Approved logo SHA-256:

```text
547d63a94e56f7c6a8b4e9f17370dc8f0c1ed3e733cceac7bb61f0fda8b824f5
```

## Prayer data boundary (Task 04)

`src/data/prayer-data.ts` intentionally exports `null`. The static card always works without JavaScript as an unavailable state with a native five-prayer disclosure. The client activates times/countdown only after validating a supplied payload; no provider, location lookup, public calculation fallback, fetch or storage is connected.

The `PrayerCardData` contract in `src/lib/prayer-times.ts` requires schema version, purpose and `Europe/Berlin`. Daily and Friday schedules have separate source IDs/labels, revisions, review status/reviewer/timestamp and freshness windows (`updatedAt`, `validFrom`, `expiresAt`). Each daily record contains its Berlin civil date and exactly five named ISO timestamps. Friday has an explicit Friday date and separate nullable `sermonAt` and `iqamaAt`; neither is inferred from Dhuhr.

Timestamps need seconds and either UTC `Z` or an explicit offset correct for Berlin at that instant. Bare local times, impossible dates, skipped DST times, incorrect seasonal offsets, duplicate dates and nonchronological prayers fail closed. Explicit offsets distinguish the repeated autumn hour. Isha may belong to the next civil date but must precede the next supplied Fajr. Calendar rollover uses Berlin dates, not fixed 24-hour additions. Missing tomorrow Fajr never causes today's times to be reused.

Approval must match the data revision and be at least as recent as the data update. Expired, unreviewed, invalid or missing current-day data suppresses daily times/countdown. The clock recalculates from absolute instants, pauses while hidden/on `pagehide`, refreshes on visibility/`pageshow`, and exposes cleanup for future component teardown. Seconds use `role="timer"` with live announcements off. Its accuracy depends on the visitor's device clock and browser timezone data.

Metadata validation is **not proof of religious accuracy or authorization**. Before a separate activation change, the owner must approve the source and reuse permissions, locality and date coverage, Fajr/Isha method, Ramadan Maghrib accuracy, freshness policy and independent Friday arrangements. Record the review and update the deliberate no-active-payload build gate only in that reviewed activation change. Any serialized review metadata is public; use an approved public reviewer identifier, never private contact details or secrets.

Synthetic fixtures live only in `tests/fixtures/`, with `purpose: 'test-fixture'` and an unmistakable test-only marker. Production initialization rejects them; Astro rejects test-purpose payloads, and validation scans public output for their marker. Test callers must opt in explicitly. Never copy fixture times into production data.

## Offline calculation and review (Task 08)

The modular TypeScript adapter uses pinned **Adhan 4.4.6 (MIT)** to calculate the five prayers from explicit location, angles/intervals, Asr, high-latitude policy, rounding and adjustments. It generates pending review data only. Source/method/review status fit the existing card; Friday remains independent. No homepage design change or live calculation has been activated.

Read [PRAYER_TIMES_VALIDATION.md](PRAYER_TIMES_VALIDATION.md) for authoritative location evidence, library and Mawaqit research, dated Hamm comparisons, configuration instructions and the human approval gate. `npm run prayer:compare` reproduces research discrepancies across seasons and Ramadan. `npm run prayer:draft -- ...` writes a settings/payload-hashed draft only under ignored `.prayer-review/`; it never approves data or modifies production exports. Example settings are not locally approved prayer guidance.

Summer Fajr/Isha and Ramadan Maghrib differences remain unresolved. Passing software tests is not religious approval. Keep production inactive until the operator and responsible religious reviewer approve the exact location, policy, results, source permissions, freshness/renewal process and Friday arrangements. No acceptable error tolerance is assumed.

## Local timetable review (Task 09)

`src/lib/local-timetable/` validates authorized canonical CSV/JSON files, source/identity evidence, exact checksums, time semantics, scoped permissions, coverage, Berlin/DST instants and chronological consistency. Output is a pending review artifact, not a public payload. Mosque iqama data cannot populate daily prayer-entry times; hospital Friday settings stay separate.

`npm run timetable:import -- --input FILE --manifest FILE --out .prayer-review/NAME.json` imports an explicitly authorized local file. Add `--compare-settings validation/settings.example.json` for diagnostic comparisons with the existing dated reference samples and Adhan. The settings are an unapproved diagnostic candidate. No file is downloaded, scraped, approved or published by this command. No live sample was imported in Task 09.

The [source/permission register](validation/local-source-permissions.json) records unresolved evidence and zero authorized samples. The [manifest template](validation/local-manifest.template.json) is intentionally incomplete and fails validation until real evidence is supplied. Follow [LOCAL_TIMETABLE_REVIEW.md](LOCAL_TIMETABLE_REVIEW.md) for formats, permission scope, comparisons and the human approval checklist. Keep private authorization records and imported files in ignored `.prayer-review/`, never in public assets or Git by default.

## Friday sermon platform (Tasks 11–12)

`sermons.html` includes the next approved/public sermon, eight upcoming Friday calendar slots and a publication archive. The content store `src/content/sermons.ts` contains the user-supplied educational series metadata but no sermon, study, announcement or approval records. Unassigned calendar dates are explicitly identified as planning slots. The homepage logo and prayer integration remain unchanged.

The **ما لا يسع المسلم جهله** series (**رحلة في تعلم أصول الدين**) has its four phases, eight ordered editorial topics and first companion-study outline at `sermons.html#series-ma-la-yasa`. These are undated headings, not approved sermons or calendar assignments. Series navigation connects only released sermon/study revisions. The supplied sermon r1 and study r2 remain private until the release embargo expires. Task 27 completes their release preparation using the existing content approval, owner publication authorization and owner-approved approximate duration. See [PUBLICATION_READINESS.md](PUBLICATION_READINESS.md) and [SERMON_CONTENT.md](SERMON_CONTENT.md) for the current evidence and workflow.

Typed sermon/study records, revision-bound human approvals, rights/reference checks and an append-only history ledger control static publication. An approved sermon requires its exact approved study version; the visible **اقرأ الموضوع كاملاً** link never targets a placeholder. Separate approved announcements can disclose planned titles without exposing private drafts. Every historical released revision retains its own URL.

Published detail pages provide both khutbah parts, exact specified publication time/revision, citations, fullscreen-style imam reading, font adjustments, optional screen wake-lock and printing. Versioned offline HTML embeds licensed local fonts and contains only approved released content. The current production build emits no detail/study/download routes because the authorized pair remains private until 2026-11-06T07:00:00Z.

Read [SERMON_CONTENT.md](SERMON_CONTENT.md) for schema fields, approval/hash instructions, routes, offline limitations and the first-content gate. `publishAt` is enforced at build time using a consistent clock; no scheduler or backend is enabled, and a later authorized build/release is needed to publish due content. Drafts stay outside the public repository, for example in ignored `.sermon-review/`. Never regenerate old history seals to overwrite an approved revision.

Private intake is available through `npm run sermon:import -- --input .sermon-review/first-sermon-approved.txt --review .sermon-review/first-sermon-reference-review.json --out .sermon-review/first-sermon-r1.bundle.json`. It requires existing local input/research files, preserves source bytes, refuses overwrites and keeps both linked records unapproved with no Friday/publication date. It never fetches sources or approves references. Review files are not in Git and are intentionally absent in fresh clones; tests use synthetic fixtures. `npm run verify` checks for private draft markers and, when the local source exists, leaked source paragraphs in built output.

### Local first-sermon review (Task 14)

Run `npm run dev`, then open `/nur-und-huda/_review/first-sermon` on the **localhost address printed by Astro**. For example, with port 4340: `http://127.0.0.1:4340/nur-und-huda/_review/first-sermon`. The preview reads `.sermon-review/first-sermon-approved.txt` on each page request; keep that private file on this computer. It shows both original khutbah parts, series/lesson metadata, the exact review notice, imam mode/font controls and browser printing. No Friday, publication date, companion-study link or draft download is added.

Use **`npm run dev`**, not `npm run preview`: the latter serves the production build, where this route intentionally does not exist. After updating preview integration code, restart a previously running daemon with `node scripts/astro.mjs dev stop`, then `npm run dev`. Refresh the page after editing the local source; private files are excluded from Vite's file serving and watcher. Do not proxy or tunnel this local server. The preview rejects non-loopback listeners/clients, forwarded requests and cross-origin access. Responses are non-cacheable and cannot be framed. Visual-review permission does not approve public publication, and no private source is committed.

### Reader and local approval workflow (Task 15)

Imam mode keeps a wrapping toolbar visible above independently scrolling text. Font controls cover 18–44 nominal pixels (default/reset 32), applied in rem so root text settings and browser zoom still work. Light, dark and device-default themes plus font size are stored only in local browser storage; failure falls back to session preferences. No sermon text or reading position is stored. Fullscreen and wake-lock are optional capabilities. Print remains light and includes the local-review notice where applicable. Text anchoring preserves reading position during size changes, with an approximate block/proportional fallback where caret APIs are unavailable.

`npm run sermon:workflow -- review|approve|prepare|authorize-publication ...` provides **local CLI actions only**, with no approval endpoint. It writes immutable private artifacts under `.sermon-review/` and never changes public source, Git or deployment. See the [Task 15 procedure in SERMON_CONTENT.md](SERMON_CONTENT.md#task-15--local-approval-and-separate-publication) for candidate fields, explicit human checks, hash confirmations and the separate final public-content step. The real sermon/study remain unapproved; their source, rights, study-completion and date blockers still apply.

### Visible preview controls (Task 16)

The local preview now displays labelled **− تصغير الخط**, **+ تكبير الخط**, reset and theme controls above the title, without opening imam mode. The toolbar sticks to the top while the page scrolls; imam mode retains its own controls and uses the same preferences. A readiness message confirms JavaScript initialization. The **اعتماد الخطبة** link leads to the visible status/requirements section after the sermon. Its button stays disabled until the exact local revision passes all review and publication checks. Once ready, it reveals the explicit CLI approval command; it never executes approval or publication in the browser.

After pulling changes, restart the Astro daemon and use its printed localhost address. For a fixed port: `node scripts/astro.mjs dev stop`, then `npm run dev -- --port 4340`, and open `http://127.0.0.1:4340/nur-und-huda/_review/first-sermon`. An old process on another port can still serve stale middleware. Do not open a LAN/proxied URL; local review is intentionally restricted to loopback.

With that server running and the genuine private source present, run `npm run validate:sermon-preview` (or append `-- http://127.0.0.1:PORT/nur-und-huda/_review/first-sermon`). This checks the exact HTTP page and executes its served application modules in JSDOM, covering initialization, page controls, source preservation and blocked approval. Only Vite's HMR transport is stubbed. This is **not visual browser/device testing**; Safari layout, sticky geometry, fullscreen and native printing still require manual checks. The smoke test expects the current real draft to remain blocked; update that expectation only with a separately authorized content approval.

### Complete reader scaling and review checklist (Task 17)

The preview and imam reader now share a proportional sermon hierarchy: title 1.45×, khutbah headings 1.2×, subheadings 1.08× and body/quotation/supplication text 1× the selected 18–44px base. Toolbar controls and review notices keep their own UI sizes. Device-local font/theme preferences and text-position anchoring remain in place.

The local review panel groups requirements into seven Arabic categories with accessible, **session-only** checkboxes. Recorded evidence status is separate from those checkboxes. Raw unresolved notes are inside a closed technical-details disclosure. Checking all boxes never validates sources, changes a record or approves content. **عرض خطوات الاعتماد المحلي** becomes available only when the server has validated the exact complete review and the session checklist is complete; it displays CLI instructions without executing them. Actual approval, artifact preparation and publication authorization remain the separate Task 15 commands. No authenticated admin or web approval endpoint is active.

### Private extended-study preview (Task 18)

The supplied `.sermon-review/study-001-approved.md` is imported as private study **r2**, linked to sermon **r1**, while the original partial study r1 remains intact. On a machine with the genuine private inputs and explicit owner editorial permission, import once with `npm run study:import -- --editorial-approval`. It creates `.sermon-review/study-001-r2.bundle.json` exclusively (no overwrite), preserves the complete Markdown/checksum and does not verify citations, grant rights or authorize publication. Private files are deliberately absent from Git/fresh clones.

Restart the dev server after integration changes, run `npm run dev -- --port 4340`, and open:

- Sermon: `http://127.0.0.1:4340/nur-und-huda/_review/first-sermon`
- Study: `http://127.0.0.1:4340/nur-und-huda/_review/first-study`

The sermon now shows **اقرأ الموضوع كاملاً** beneath its text only when the imported study matches both source files and the exact linked revision. The study has return navigation, local font/theme controls, readable RTL headings/lists and a clear editorial-only notice. The original draft-status and final-review wording remains untouched. Missing or changed study inputs disable the link and make the study route unavailable; neither route exists in production.

`npm run validate:sermon-preview` now checks **both** HTTP routes, navigation, exact study block wording/order, loaded reader controls and access restrictions; it requires both genuine imported private sources. See [SERMON_CONTENT.md](SERMON_CONTENT.md#task-18--supplied-study-import-and-local-navigation) for unresolved checks and the separate future promotion boundary. Visual device testing remains unverified when no browser is available.

### Final evidence review and r1/r2 preparation (Task 19)

[PUBLICATION_READINESS.md](PUBLICATION_READINESS.md) records source comparisons, printed book pages, rights evidence and remaining blockers. Both exact sources are unchanged. The owner's editorial decision is recorded privately; neither real record is formally approved or publicly authorized.

`npm run sermon:prepare-pair -- --owner-editorial-approval` creates an immutable, private **blocked preparation**, not a release. It binds sermon r1 to the supplied study r2 and deliberately leaves evidence pending and dates null. An existing preparation is never overwritten. The extended review command requires both `--study-source` and `--study-bundle` to validate r2; without them the original r1 rules remain. See [the Task 19 procedure](SERMON_CONTENT.md#task-19--explicit-r1r2-preparation-and-review) before entering real reviewer evidence or dates. Formal approval and public disclosure remain separate explicit actions.

## Hosting boundary

### Automatic Friday publication (Task 28)

The reviewed r1/r2 catalog can now be packaged as an authenticated encrypted payload for a restricted GitHub environment. The scheduled Actions workflow checks the real UTC embargo, validates the exact pair, skips verified duplicate releases, deploys only checked Pages output and verifies live bytes. It has no automatic content approval and cannot release before **2026-11-06T07:00:00Z**.

**Automatic publication is not active yet.** GitHub still serves legacy `main:/`; the release environment, secrets and activation variable are not configured, and this workflow is not on the default branch. [AUTOMATIC_PUBLISHING.md](AUTOMATIC_PUBLISHING.md) contains the Thursday preparation, final security confirmation, Friday retries, owner status and manual-dispatch fallback. `npm run sermon:package` creates only local ignored secret files. No secret values or plaintext content belong in Git or logs.

### First authorized release (Task 27)

The exact approved sermon r1/study r2 catalog retains its **public** release instant of **2026-11-06 08:00 Europe/Berlin = 07:00 UTC**. The owner separately authorized access through the shared-code private Firebase website on November 4; see the private-group release procedure below. Its owner-approved duration is displayed as **المدة التقريبية: 10 دقائق**. A timed reading is not required or claimed. Existing source hashes and approval records are unchanged; final release metadata/seals are recorded in new ignored artifacts.

Use `npm run sermon:release -- check --catalog task27-public-catalog.json` for catalog validation and an embargo check. Before the deadline it intentionally exits nonzero. After the deadline, the explicit `publish` action builds in a private isolated directory, verifies static output, publishes only that output to `gh-pages`, selects it as the Pages source and checks actual public bytes with retries. It never modifies `main`. [SCHEDULED_RELEASE.md](SCHEDULED_RELEASE.md) contains the exact hash-confirmed command, receipt-based retry/verification instructions and public URL targets.

**No unattended schedule is configured.** An operator must invoke the release after the deadline. GitHub Pages still uses `main:/`; Task 27 does not change live settings or deploy. Before-deadline public catalog/source commits, artifact uploads and deployments remain forbidden. Only the source-free code/tests/docs are pushed now.

Task 20 adds a local **content-only** review/confirmation stage independent of Friday and publication dates. See [CONTENT_EVIDENCE_REVIEW.md](CONTENT_EVIDENCE_REVIEW.md) for verified source locations, the limited-quotation assessment and reading-duration scenarios, and [the content-review commands](SERMON_CONTENT.md#task-20--content-confirmation-without-scheduling). The real pair remains private; its completed content and release approvals are separate records. Unresolved evidence still cannot be confirmed away by the CLI. A content-only record never substitutes for the existing publication approval/catalog or authorizes disclosure.

Task 21 records the owner's actual context/provenance confirmations in a new private packet. The exact r1/r2 pair is now ready for formal owner confirmation, with no remaining content-evidence blockers. No approval command was executed. [The ready hash and owner command](SERMON_CONTENT.md#task-21--owner-confirmations-and-ready-content-review) prompt for the real reviewer identifier and leave scheduling/publication separate.

`astro.config.mjs` uses static output, file-format routes, and base `/nur-und-huda`. A future authorized release would publish **only `dist/`**, not the repository root. This phase adds no GitHub Actions/Pages publishing workflow and changes no hosting settings. Keep `main` and the live website unchanged until a separate release instruction.

Design decisions and future service gates remain documented in [AUDIT.md](AUDIT.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Official MAWAQIT homepage widget

Optional private-group Web Push is implemented for `نصلّي معاً`, with a
30-minute gathering visibility grace period. Only explicit opt-in subscribes a
device; there are no new accounts. See
[the push release runbook](backend/tests/PUSH_RELEASE.txt) for architecture,
privacy, exact deployment selectors, test coverage and activation status.
Do not infer that push is active from a successful local build: the VAPID secret,
runtime binding and scheduled delivery worker must be configured and verified
in `nour-und-huda` first. No real-phone delivery is claimed by emulator tests.

The homepage uses the unchanged high-resolution logo with its embedded tagline,
a compact prayer panel, four service cards and an information/contact card.
Phones use a safe-area-aware bottom navigation bar; “المزيد” opens a keyboard
accessible menu. Desktop retains the existing top navigation and a wider card
grid. The dedicated library search, prayer coordination and sermon reader remain
on their existing routes. Mobile navigation is hidden in Imam Mode and print.

`backend/tests/site-navigation.mjs` and `branding-sermon-browser.mjs` exercise
the protected homepage at 320, 375, 390, 430, 768 and 1440px in either supported
browser engine, including menu focus, card links, footer clearance, provider
zoom/pan and the approved sermon/study pair. Screenshots stay in the local
temporary directory. See `backend/tests/HOMEPAGE_REDESIGN.txt` for results and
visual limitations.

The homepage embeds Nur und Huda's official MAWAQIT widget (**56820**) with a permanent source/fallback link and a separate Friday section (**13:00 / 13:30**, first/second Friday prayers). URLs, the verification date and the two owner-supplied Friday values live in `src/data/mawaqit.ts`. The widget supplies its own live display; our calculation/countdown engine remains inactive and no timetable is copied or fetched through a private API.

On narrow screens, the official widget fits the card without cropping. Use **تكبير اللوحة** for larger provider text, then the visible left/right buttons or horizontal scrolling to reach the full timetable; **عرض اللوحة كاملة** restores the overview. The official source link stays available even without JavaScript or when the iframe fails. No iframe content is modified or copied. The outer frame preserves the site's identity; MAWAQIT controls the embedded theme. The privacy draft documents the third-party connection. See the Task 29 section of [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) for endpoint verification, browser checks and limitations. Run `npm run verify` after changes; it allows only this exact homepage iframe. This integration does not change sermon release or deployment configuration.

### Approved sermon on the private Firebase website

`npm run private:prepare -- --approved-sermon` builds only the exact approved
sermon r1/study r2 pair for the server-gated group. It requires the existing local
source files, corrected approval, Task 21 evidence, complete Task 27 authorization
chain and `.sermon-review/private-site-release.json`. This separate sealed record
captures the owner's November 4 private-site publication instruction, exact source
and catalog hashes, target origin and actual recording time. It is not a new
content approval or permission to release anonymously before Friday. Never commit
these local files or upload `dist` as a public artifact.

Preparation and the Firebase predeploy hook reconstruct the approval chain and
compare the generated articles, Imam Mode text and offline file with the approved
renderer output. Only their three explicit routes may contain the approved texts.
Other draft sources and review records remain excluded. Downloads link back to the
private Firebase site. A private-audience manifest is rejected by public release
validation. The ordinary `npm run verify`/public build still excludes private text.

The package is served by the existing `privateSite` function; Firebase Hosting's
static directory stays empty. Deploy only this function using the existing
`backend/firebase.private.json` configuration and `nour-und-huda` project after
verification. The public GitHub Pages website and its embargo remain unchanged.
For authorized live browser acceptance, run `backend/tests/private-live.mjs
--authorized-live` with the existing Playwright setup; it checks every packaged
resource behind the gateway and exercises the real prayer workflow. Physical
phone testing remains distinct from automated WebKit testing.

### Quran reader

The Quran route loads the official [Ayat reader from King Saud University](https://quran.ksu.edu.sa/index.php?l=ar), whose About panel credits the King Fahd Complex as the source of its Mushaf images. The publisher supplies iframe embedding code and links its [mobile interface](https://quran.ksu.edu.sa/m.php). We use those two interfaces, without copying, editing, generating or locally hosting Quran text, images or fonts. This permission to display the publisher's reader is not a redistribution license for its underlying assets.

Verified on 2026-11-12: the former King Fahd `/apps/` link returns HTTP 404; `dm.qurancomplex.gov.sa/rights/` redirects to the new main site's `/rights`, also HTTP 404. The replacement Complex homepage marks its developer and embedding services as coming soon and denies framing via CSP/X-Frame-Options. Those broken links are no longer used by the website. The archived Hafs research dataset is not substituted into the reader.

The page uses the mobile reader below 1100px and the publisher's desktop reader above that threshold. Crossing the threshold reloads the reader. The mobile provider may ask for Arabic on first use; the accessible surah selector above the frame opens the selected chapter using the reader's supported `#aya=N_1` URL fragment. A direct external-reader link remains visible without JavaScript and if embedding fails. The iframe uses `allow-scripts allow-same-origin` only and sends no initial Referrer. The provider's own analytics/storage and network dependency are disclosed in the privacy notice; our private access cookie and participation data are not sent to the university.

The 114 navigation names/numbers/start-page facts in `src/data/quran-surahs.json` were extracted from the previously verified official Complex Hafs v30 metadata archive (`https://download.qurancomplex.gov.sa/resources_dev/kfgqpc_hafs_v30.zip`, SHA-256 `227e6b1564d980f2bd09c2c35ebfb0330ac268c79a7c247cd1ab665bc635f245`). Only factual chapter labels/order/page numbers are included: no verse text, font, image, executable publisher code or Quran dataset is redistributed. The displayed pages continue to come directly from Ayat, not from that archive. The archive's availability is not claimed to grant blanket reuse rights.

### Private sermon editor

Every member signed in with the existing shared code can use **تعديل** on a published sermon. No additional account, password or role is required. Open `/nur-und-huda/sermon-editor.html?id=learn-our-religion` (or `meaning-of-testimony`). Save a draft, preview, then explicitly confirm publication. The previous publication remains available while editing. **استعادة النسخة السابقة** creates another published revision; it never erases history.

The gateway keeps the existing reading, imam and download URLs. Server-only seeds are derived from the approved baseline at `private:prepare -- --approved-sermon`; private source files remain untouched. Firestore `privateSermonEdits/{id}` stores one shared draft and the current/previous publication. Immutable `revisions/{number}` documents preserve every publication and the original baseline. A server timestamp and content SHA-256 identify each revision; no personal editor identity is claimed. Drafts and revision history persist until an explicit future maintenance decision, unlike temporary prayer gatherings.

All endpoints require the same private session, exact Origin on mutations and JSON bodies. Direct Firestore access stays denied. Transactions check the draft/publication version, and operation IDs make retries idempotent. Limits: 240 title characters, 40,000 characters per khutbah, 100,000 study characters, 220 KB combined UTF-8 content, 240 KB request body, 120 successful writes per sermon/hour. Edited text is escaped, never interpreted as HTML or normalized. Existing introduction, references and series links stay attached; only already-published studies can be edited. Publishing is a group member's explicit action, not a claim of renewed scholarly verification.

`editor-check` is an isolated technical acceptance record, absent from the sermon schedule. Tests may save, publish and restore only this record on production; real sermon records must remain unchanged. `backend/tests/sermon-editor-http.mjs` and `sermon-editor-browser.mjs` exercise authorization, drafts, preview, conflict prevention, retries, two-session publication and restoration. It contains no religious content. Its test state/history can be removed by scoped operational maintenance without touching actual sermons.

Deployment remains `firebase deploy --only functions:prayer:privateSite --project nour-und-huda --account nurundhuda@gmail.com --config backend/firebase.private.json`; prepare the approved private bundle and run the existing private security gates first. No Hosting, staging, Pages, runtime IAM, rules, push worker or scheduler change is needed. Rollback to the prior function stops web editing while retaining Firestore revisions; export/review the current publications before reverting so a rollback does not silently substitute older sermon text.

### Imam auto-scrolling

Open **وضع الإمام**, then tap **بدء**. Five speeds use actual pixel movement: 6, 10 (default), 16, 24 and 32 px/s. These are adjustable interface defaults, not measured sermon reading rates. The preferred level stays on this device; text and reading history are not stored locally by this feature. No scrolling starts automatically, including with reduced-motion preferences or after reopening.

The reader shows one khutbah at a time. It stops when the current khutbah's last lines are visible; it never advances to the second by itself. While paused, choose **الانتقال إلى الخطبة الثانية**, then **بدء**. Manual touch, wheel, keyboard or scrollbar movement pauses scrolling. Font changes, resizing, hidden tabs, printing and stalled animation frames also pause it. **بداية الخطبة** resets only the selected part. Part switching/reset are disabled while scrolling to avoid accidental jumps. Additional font, print, optional fullscreen and wake-lock controls are under **خيارات القراءة**. The fixed dialog works without native fullscreen. Wake lock still depends on browser/OS support.

The animation uses requestAnimationFrame timestamps, fractional pixel accumulation and part-specific DOM bounds; no word-count assumptions. Delayed frames never cause catch-up jumps. Closing/disposal cancels frames and listeners. Original/static and editor-published text use the same reader; the published page and offline documents remain unchanged and readable if scrolling JavaScript is unavailable. References stay available for manual reading after auto-scroll stops. Browser tests use actual frame movement and an isolated technical editor revision, never changes to real sermon text. Physical iPhone/Android testing remains distinct from WebKit/Chromium emulation.
