# نور وهدى — Nur und Huda

**منبر للذكر .. ومرجع للعلم النافع**

Arabic-first, non-commercial educational website. Phase 1 uses **Astro static output, TypeScript, and modular CSS**. No React SPA, backend, authentication, analytics, submissions, or notifications.

Prayer times remain unavailable until a source is approved. Sermons and community gatherings are honest empty states. Quran/library entries link to original sources; no Quran text or books are hosted. Legal operator details still require review.

## Local development

Use Node **22.23.3** (`.nvmrc`), or a supported Node version from `package.json`, and npm. Astro 7 requires at least Node 22.22.0. Install the locked dependencies:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4321/nur-und-huda/index.html**. Use the port printed by Astro if 4321 is busy. The explicit file URL works in both development and production preview; development also accepts `/nur-und-huda` without a trailing slash. All internal paths deliberately include the GitHub Pages project base.

The original root HTML/CSS/JS files remain unchanged as a migration reference. **Opening root `index.html` displays the old prototype.** The maintained application is in `src/`; use Astro to view the rebuild. The build does not include the legacy pages/scripts.

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
- `assets/logo.jpeg`: original approved logo, never transformed. Build preparation copies it unchanged into `public/assets/` and checks its SHA-256; generated copies are ignored by Git.
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

## Hosting boundary

`astro.config.mjs` uses static output, file-format routes, and base `/nur-und-huda`. A future authorized release would publish **only `dist/`**, not the repository root. This phase adds no GitHub Actions/Pages publishing workflow and changes no hosting settings. Keep `main` and the live website unchanged until a separate release instruction.

Design decisions and future service gates remain documented in [AUDIT.md](AUDIT.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
