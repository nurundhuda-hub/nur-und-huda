# Phase 1 implementation report

Date: 2026-10-29. Repository: `nurundhuda-hub/nur-und-huda`. Branch: `codex/audit-and-rebuild`.

## Delivered

- Astro 7 static output, strict TypeScript, modular CSS, pinned dependencies and lockfile. All six original `.html` routes and existing homepage/legal fragments are preserved beneath `/nur-und-huda/`.
- Shared Arabic RTL navigation/footer, active-page indicators, skip link, semantic headings, responsive grid layouts and ivory reading surfaces. Exact emerald/gold/ivory identity and tagline are retained.
- Original logo preserved byte-for-byte, displayed uncropped with intrinsic dimensions and no blending/filtering. Local Amiri and monochrome Aref Ruqaa fonts include unchanged OFL notices in the build and legal-page attribution.
- Native five-prayer disclosure works without JavaScript. Next-prayer/countdown remain unavailable because no approved data exists; Friday sermon and iqama have separate unavailable fields. No calculation engine or provider requests were introduced.
- Community page has no submission or joining form. Sermon page provides an unfilled eight-week-program section, two-part-content explanation and a named, large-text imam preview. No fabricated schedule, sermon, study destination or print/download action is offered.
- Quran links go to the existing official destinations. Homepage/library search filters the two verified Risala directory destinations by name/language, tolerates Arabic diacritics, reports result counts and handles no matches. No unverified book record is retained as a specific-book link.
- Legal sections retain clearly identified pending operator/legal review. Site behavior and local font licenses are described without asserting full legal compliance.
- Page-scoped behavior replaces the old all-pages initializer in generated output. Search enhances static links; dialog controls appear only after supported initialization. Native dialog handles modal behavior; code explicitly restores trigger focus.
- Reduced-motion styles, explicit light-surface text, 44–48px navigation/action controls, mixed-language annotations and print foundations. No remote font requests, trackers, browser storage, accounts, backend, or notifications.

The original root website files remain unchanged for reference and are excluded from Astro output. `main` and hosting configuration are untouched. No deployment workflow was added.

## Verification

| Check                    | Result                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependency installation  | Completed using official npm registry's `.com` hostname after `.org` DNS failed; exact versions locked. Installation reported zero vulnerabilities.                         |
| Astro/TypeScript         | Passed: zero errors, warnings or hints.                                                                                                                                     |
| Production build         | Passed: six static HTML pages.                                                                                                                                              |
| Automated tests          | 33 passed across interaction, emitted-runtime, structural accessibility and palette-contrast tests.                                                                         |
| Disclosure               | DOM test opens/closes the native panel and verifies five unavailable prayer entries.                                                                                        |
| Search                   | Both pages tested for Arabic/German terms, diacritics, empty/no-match cases, inert markup input and repeated initialization.                                                |
| Dialog                   | DOM tests verify opening/closing wiring, named dialog and focus restoration. Modal APIs are shimmed in tests; native browser behavior is not claimed.                       |
| Built JavaScript         | Actual emitted scripts execute against each generated page in isolated VM contexts without initialization errors.                                                           |
| Structural accessibility | axe-core reports no detected violations on the six generated pages, including enhanced search controls. Contrast/layout-dependent checks are excluded from this DOM result. |
| Colors                   | Exact palette tokens checked. Five intended text/background combinations exceed 4.5:1. Rendered-state contrast still needs browser review.                                  |
| Routes/assets            | Static validator confirms internal paths/fragments, first-party resources, six local WOFF2 assets, OFL notices and original/build logo hashes.                              |
| Local HTTP               | Project root plus all 16 built page/asset responses return 200 and match build bytes beneath `/nur-und-huda/`.                                                              |
| Public JavaScript budget | Two unique inline modules total 802 bytes gzip; no React runtime. This measures code size, not loading performance.                                                         |
| Formatting               | Maintained source and documentation checked with Prettier.                                                                                                                  |

Logo SHA-256 remains `547d63a94e56f7c6a8b4e9f17370dc8f0c1ed3e733cceac7bb61f0fda8b824f5`. The equivalent supplied WOFF font subsets were inspected for color tables; none of COLR/CPAL/SVG/CBDT/CBLC/sbix was found.

## Explicit verification limits

Browser discovery returned no available browser. No screenshots or rendered-layout results are supplied. **320, 375, 390, 768, 1024 and 1440 CSS-pixel layouts are implemented in CSS but untested in a rendering engine.** Short landscape, 200% text enlargement, 400% zoom, real iPhone/Android/tablet/desktop rendering, font shaping in browsers, Arabic screen readers, native dialog focus trapping/Escape, print pagination, reduced-motion behavior and initial-load network inspection remain unverified.

LCP and CLS were not measured. The original image remains 409,890 bytes by design. Automated structure/contrast checks and the tiny script size do not substitute for visual, device, performance or assistive-technology acceptance.

Phase 1 source and automated verification are ready for review. The full visual definition of done retains the manual checks above and owner visual review as pending. Subsequent functional phases still require approved prayer data, religious content, legal details and any applicable integration permissions. No live services, offline sermon downloads, administration or deployment are implied by this implementation.

## Task 03 — visual fidelity follow-up

Date: 2026-10-29. This update changes presentation only, on `codex/audit-and-rebuild`.

- The centered original logo, exact tagline and prayer card now form one vertical stack on mobile and desktop. The desktop side-by-side hero is removed. A subtle CSS mask feathers the image's outer background margins into the emerald backdrop; the original JPEG bytes, full image dimensions and uncropped placement remain unchanged. No blending, recoloring or replacement logo is used.
- The homepage prayer card is emerald with a fine gold border, inset detail and matching line icon. All unavailable states, the native five-prayer disclosure and separate Friday sermon/iqama fields remain intact.
- Four numbered link rows become decorative emerald cards with consistent, locally authored SVG line icons and the requested vocalized Ruqaa headings. The grid is one column below 360px and two columns from 360px, including the 390px target. Text remains free to wrap; no fixed content heights or truncation are used.
- A deep emerald gradient, low-opacity eight-point geometric pattern and restrained gold dividers unify the pages. Homepage reading/community/search sections share the card treatment and tighter spacing. Secondary reading surfaces remain ivory with dark text.
- Existing TypeScript behavior, dependency versions, source attribution, all six routes and all 33 tests are retained. The print stylesheet suppresses decorative backgrounds and resets card text to dark colors. The README now uses the verified explicit local `index.html` URL.

Validation: the full `npm run verify` suite passes, including all 33 tests, strict diagnostics, production build, asset/link checks, font/license checks, exact logo checksum and formatting. No additional client JavaScript is introduced; the two modules remain 802 bytes gzip combined.

**Visual limitations:** the approved mockup image was not available in the repository or conversation, so this implementation follows the supplied mobile design specification rather than claiming a measured image match. Browser discovery again returned an empty inventory. No screenshots, rendered 320/375/390/768/1024/1440px results, real-device checks, native dialog/keyboard tests, font-shaping review or screen-reader results are claimed. In particular, logo feathering and card spacing at 390px still need visual review. No new features, prayer data, backend, merge or deployment are included.

## Task 04 — desktop hero and interactive prayer card

Date: 2026-10-29. Changes are confined to `codex/audit-and-rebuild`.

- The hero is outside the constrained content shell: its emerald gradient and dedicated low-opacity geometric layer span the full page width. The original logo remains centered, uncropped and byte-for-byte unchanged, with CSS feathering confined to its outer background margins. At desktop widths the logo scales with viewport height (bounded at 18–26rem), and vertical spacing is reduced to bring the card upward. The exact tagline, local fonts and approved palette remain intact.
- The gold-bordered prayer card sits directly beneath the hero. Its native expand/collapse control has a prominent touch target and updated Arabic action label. The five-prayer list works without JavaScript. No countdown digits or prayer times appear in the current unavailable state.
- A typed, runtime-validated model covers Berlin schedule dates, five named prayers, absolute timestamps, source, revision-bound review metadata and freshness. Daily and Friday approval are independent. Friday sermon/iqama fields are never inferred. Approved future data can drive next-prayer selection and a live absolute-time countdown; production data remains `null`.
- Clock handling covers midnight rollover, tomorrow Fajr, explicitly delayed Isha, spring skipped hours, autumn repeated hours, stale/future data, hidden tabs, back-forward restoration and cleanup. Counts are not announced every second. Device clock accuracy remains an external dependency.
- Test fixtures are marked synthetic and rejected by the public initializer/component. A build gate prohibits active production payloads in this task and scans output for fixture leakage. No provider endpoints, scraping, backend, services, religious content or dependencies were added. Existing search/dialog behavior and all six routes remain.

Validation: `npm run verify` passes strict diagnostics, production build, **77 tests**, static route/link/asset checks, fixture-leak checks, exact logo SHA-256 and formatting. Tests include synthetic prayer validation/countdown/lifecycle scenarios, the original interactions and emitted JavaScript, six-page structural accessibility, an enhanced prayer-card accessibility check and palette contrast. Public JavaScript totals **4,431 bytes gzip** (measured code size, not performance). No new local HTTP check was performed for Task 04; the earlier Phase 1 HTTP result is historical.

**Unverified visuals:** no browser was available in the tool inventory. No screenshots or rendered 390px mobile/1440px desktop results are claimed. Full-width geometry, logo edge integration, first-viewport card placement across 1280–1920px, native keyboard/screen-reader behavior and real-device rendering still require visual review. The CSS targets those layouts but cannot establish their rendered appearance without a browser.

**Remaining approval dependencies:** activation requires reviewed source permissions and local prayer data, Fajr/Isha method, Ramadan Maghrib accuracy, date/freshness coverage and separate Friday arrangements. Validation cannot establish religious accuracy. Operator/legal and content approvals from Phase 1 remain pending. No unapproved times are active; no main merge, deployment or hosting changes are included.

## Task 06 — desktop sizing diagnosis

The initial workspace was clean on `codex/audit-and-rebuild` at `a3611f9`. A direct HTTP read of `http://127.0.0.1:4321/nur-und-huda/index.html` returned the Astro homepage (`body.page-home` and Vite development scripts). Its embedded base, layout, component and print CSS matched the workspace files byte-for-byte. The served layout CSS SHA-256 was `1ce2a5a3916e8030ab0530bd14a5e88331267d974e141e6149aeaf2df7bc5ba5`, matching the file in commit `a3611f9`. Port 4321 was owned by Node process 35367. The Astro status helper reported no registered server despite this HTTP response, so that status alone is not reliable evidence of which content is served.

No browser was available (`cua.listBrowsers()` returned an empty list). **Computed CSS and actual rendered dimensions at 1440×900 and 1280×800 were not measured.** HTTP/source inspection cannot establish what is displayed in the user's existing tab, its zoom, cached resources or effective CSS viewport.

Source-level cascade findings:

- The final `min-width: 1000px` homepage rules override the earlier 640px hero padding rule. The 600px/900px maximum-width rules do not match either requested desktop viewport. No later screen rule overrides the desktop logo; the subsequent 800px rule concerns only `.home-reading`.
- `.hero-logo` uses `clamp(22.5rem, 50svh, 32.5rem)`. The middle term depends on viewport **height**, so widening a desktop window does not itself enlarge the logo. `.hero-identity` caps available width at 32.5rem; the global image rule caps the logo at its containing block and preserves its ratio with `block-size: auto`. Neither cap binds at the two requested viewport sizes under a 16px root font assumption.
- `.hero` has full width and no desktop vertical padding. `.hero-identity` is a vertical stack of the square logo, tagline and divider. The negative 1rem logo bottom margin already reclaims some background-only space. `.prayer-stage` adds 0.25rem above the card; its 900px shell width does not constrain the logo because it is a separate sibling.
- The print-only 8cm image cap does not affect screen rendering. No application service worker, image transform or fixed hero height was found.

The following are **CSS arithmetic estimates only**, assuming CSS viewport dimensions as stated, a 16px root font, supported `svh`, and a single-line tagline. They are not `getComputedStyle()` or bounding-box measurements:

| Viewport | Logo width/height before Task 06 | Identity width | Hero height before Task 06 | Gap from hero end to card |
| -------- | -------------------------------- | -------------- | -------------------------- | ------------------------- |
| 1440×900 | 450px                            | 520px          | 486.64px                   | 4px                       |
| 1280×800 | 400px                            | 520px          | 431.68px                   | 4px                       |

The hero estimates are logo height minus 16px margin, plus tagline line height (44.64px / 39.68px), plus an 8px divider. A substantially larger uncropped square logo in the same centered stack necessarily consumes more vertical space. Reducing the remaining spacing cannot fully offset a further 20–25% enlargement. No stale CSS or conflicting screen override was reproduced at the inspected URL; the user's reported lack of visible change remains unconfirmed without their rendered viewport.

### Approved centered-stack refinement

The owner selected the centered logo → tagline → prayer card hierarchy and explicitly accepted that the card may start below the first viewport on shorter laptops. No two-column arrangement, fixed hero height, cropping or forced above-the-fold positioning is introduced.

Only the existing homepage desktop rules (minimum width 1000px) change. The logo uses `clamp(24.75rem, 55svh, 35.75rem)`, a modest 10% increase at every height bound. The identity wrapper's cap increases to the same 35.75rem so it cannot silently defeat the enlarged maximum. The image keeps its intrinsic aspect ratio, CSS feathering and original bytes; the full-width emerald/gold backdrop remains unchanged. The tagline's line height is slightly tighter, another 0.25rem of the image's empty lower background is reclaimed, and the 0.25rem gap above the prayer card is removed. Mobile rules, Arabic content, all six routes and interactive behavior are unchanged.

Under the same assumptions as the diagnostic table, the revised CSS predicts a 495px square logo and 524.76px hero at 1440×900, and a 440px square logo and 465.12px hero at 1280×800. These are **estimates, not browser measurements**. The larger image intentionally makes the hero taller overall despite reducing surrounding whitespace; this follows the approved design priority. Rendered logo edge integration, typography and actual card position still require browser review.

Verification: `npm run verify` passed all 77 tests, strict diagnostics, production build, route/asset checks, original logo checksum and formatting. A subsequent HTTP check confirmed the local Astro homepage serves the revised layout CSS byte-for-byte. A source comparison against `a3611f9` confirmed every rule outside the desktop media block is unchanged. No browser measurements or screenshots are claimed. No merge or deployment was performed.

## Task 07 — coordinated desktop introduction

The logo was inspected directly and decoded in memory using the already installed Sharp dependency, without writing an altered image. A threshold for warm gold/ivory pixels (`R > 100/130/160`, `R > G × 1.025`, `G > B × 1.03`) consistently found approximate artwork bounds x=101–1154 and y=50–1176 inside the 1254×1254 JPEG. This is an approximate color-based measurement, not exact segmentation: background ornament, shadows and antialiasing are not completely represented. The main artwork occupies most of the height; there is no large empty vertical region to remove safely. Original SHA-256 remains unchanged.

The desktop composition now treats the identity and prayer card as one full-width introduction with a continuous emerald backdrop and preserved gold geometry. The DOM order remains logo → exact tagline → prayer card. The new grouping uses `display: contents` below the desktop breakpoint so it adds no mobile layout box. Existing mobile CSS rules compare unchanged against the previous commit.

At screen widths of at least 1000px, the logo has an explicit 24rem square footprint, with a 20rem compact mode when viewport height is at most 740px. There is no viewport-height percentage sizing, scaling transform, crop, fixed hero height or clipped overflow. Both sizes preserve the full original image and aspect ratio. The existing CSS edge feathering remains confined to background margins. A 1rem negative bottom margin reclaims less than the approximate 20–24px of background below the artwork at those default sizes.

The prayer card has a coordinated 48rem maximum width and tighter desktop padding. Its service label and title share one wrapping row, the timezone has compact spacing, and the next-prayer panel has reduced padding. An unnecessary paragraph margin before the currently empty clock host is removed on desktop. All labels, approval warnings, five-prayer disclosure, distinct Friday fields and future approved countdown behavior remain present. No prayer data is activated.

**Tradeoff:** the logo is intentionally smaller than Task 06's 440–495px estimates. This creates usable space for the prayer card rather than letting a large square dominate the first screen. With a default 16px root font and a single-line tagline, CSS arithmetic predicts a 384px logo and approximately 423px hero at both 1440×900 and 1280×800, followed by an 8px gap to the card. Compact mode predicts a 320px logo and 359px hero. This leaves more of a laptop viewport available for the card's next-prayer section; it does not guarantee above-the-fold placement under zoom, large fonts, wrapping or browser chrome. The content remains in normal flow and can extend below the viewport.

**Verification:** `npm run verify` passed all 77 tests, strict diagnostics, production build, six-route/link/asset validation, exact logo checksum and formatting. A source comparison confirmed existing non-desktop rules are unchanged. An HTTP check at `http://127.0.0.1:4322/nur-und-huda/index.html` confirmed the new wrapper, exact tagline and served layout/component CSS matching the working files byte-for-byte. No dependency or runtime-script changes were made.

**Rendering limit:** browser discovery returned no available browsers, including Safari. No actual computed dimensions, Safari screenshots, font shaping, card position or mobile rendering were measured. The dimensions above are estimates only; visual acceptance remains pending. No merge, deployment or hosting changes were performed.

## Task 08 — independent prayer calculations and source verification

Research and implementation date: 2026-10-29. Full evidence, configuration instructions, reference comparisons and the approval process are in [PRAYER_TIMES_VALIDATION.md](PRAYER_TIMES_VALIDATION.md).

The offline TypeScript adapter uses pinned Adhan 4.4.6 with its MIT notice. All exposed calculation policies, angles/intervals, Asr, high-latitude handling, rounding and both sets of minute adjustments are explicit. It calculates Berlin civil dates into UTC instants and produces pending review artifacts compatible with the existing card. A separate adapter handles operator-supplied Friday sermon/iqama settings. The CLI records settings/payload hashes, confines draft output to ignored `.prayer-review/`, refuses overwrites and never updates production exports or approves a result. The card can display calculation method/source/review status using its existing elements.

The official hospital address is verified; its published map center is recorded as a provisional calculation point. Exact prayer-room coordinates, horizon/elevation and local religious policy still need confirmation. Mawaqit's official help describes a support-mediated widget route and private API; no integration, private API request, provider scraper or contact message was added.

Twelve attributed Hamm reference samples cover four seasons, Ramadan 2025/2026, a publisher-labeled Ramadan date in 2027 and spring DST. Four trial configurations produce reproducible signed differences without assigning an acceptable tolerance. The MWL/seventh-of-night summer candidate differs by Fajr +26 minutes and Isha −17 minutes from the published reference. Ramadan Fajr and Maghrib discrepancies also remain unresolved. An annual software test or a matching individual time does not approve worship guidance. The middle-of-night summer candidate can make Isha collide with the following Fajr; consecutive draft generation rejects that configuration.

**Verification:** `npm run verify` passed with zero Astro/TypeScript diagnostics, a production build, **112 tests across 8 files**, six-route/link/asset validation, original logo SHA-256, unchanged Adhan MIT notice, public draft/reference/test-data leakage checks and formatting. Tests include a full calculated leap year, century non-leap rejection, four host timezones, both Berlin DST transitions, midnight/year rollover, missing/stale/pending states, calculated next-prayer integration, clock corrections, timer cleanup, independent Friday fields and CLI output protections. Existing search, disclosure, dialog, emitted-script, accessibility and contrast checks still pass. Public JavaScript is **4,548 bytes gzip**; the calculation library and review datasets are not shipped to the page.

`npm run prayer:compare` successfully reproduced all 48 candidate/date comparisons. A separate `npm run prayer:draft` smoke run generated a pending, hashed three-day artifact only in the ignored review directory. The command did not activate prayer data. These comparisons validate reproducibility and expose discrepancies; they are not religious-accuracy acceptance tests.

**Preservation and limits:** homepage components/pages/styles, original logo and exact tagline are unchanged. Production `prayerData`, calculation settings and Friday settings remain `null`; the unavailable card remains public behavior. Browser rendering was unavailable, so no new Safari/mobile/desktop visual or real-device test is claimed. No main merge, deployment, hosting workflow, paid service or backend was introduced. Work stops at human review of location, methods, reference permissions, seasonal/Ramadan discrepancies, freshness/renewal policy and separate Friday arrangements.

## Task 09 — local mosque timetable verification and importer

The approved primary source policy is now a verified local mosque timetable, provisionally As-Salam Moschee Hamm. Adhan remains comparison/diagnostics only; the architecture, plan and Task 08 activation instructions have been updated accordingly. The existing official Mawaqit platform page names As-Salam Hamm, ID 5627, and Marokkanischer Verein As Salam e.V. Its current street address, operator confirmation, dated export, entry/adhan/iqama meanings and scoped reuse permission are unresolved. **No real local-mosque data was imported and no local seasonal/Ramadan comparison is claimed.**

[LOCAL_TIMETABLE_REVIEW.md](LOCAL_TIMETABLE_REVIEW.md) records the research, blockers, format instructions, comparison procedure and human approval checklist. The machine-readable source/permission register explicitly records zero authorized samples and pending approval. The blank manifest template is intentionally rejected until real evidence is supplied. No provider scraper, private API, account access or contact message was used.

The typed offline importer accepts canonical CSV/JSON only with source/identity evidence, time semantics, exact input checksum, current scoped permission and explicit date coverage/validity. It validates all five prayers, Berlin/DST instants, after-midnight Isha, interday ordering, duplicate/missing dates and malformed/duplicate fields. It returns a pending `review-only` artifact with a normalized checksum; hospital Friday is always separate/null. The CLI cannot bypass fixture protection or publish to source/public directories. Optional comparisons report signed differences, missing reference coverage and calculation failures, with no tolerance or approval and no replacement of imported values.

**Verification:** `npm run verify` passed zero Astro/TypeScript diagnostics, the production build, **145 tests across 9 files**, six-route/link/asset checks, original logo checksum, license checks, public-data leakage checks and formatting. New tests cover permission/source failures, missing coverage, leap/year boundaries, both DST transitions including ambiguous/skipped clocks, explicit Isha rollover, JSON/CSV parity, duplicate JSON keys, malformed input, pending/stale states and CLI refusal. Synthetic tests do not verify any mosque permission or prayer time. Public JavaScript remains **4,548 bytes gzip**; no importer or review dataset is included in the page bundle.

Homepage markup/styles and original logo are unchanged. Production `prayerData` is still `null`; no merge, deployment, workflow, backend or paid service was added. No new browser/real-device verification is claimed. Work stops before importing local data until the mosque/operator supplies the missing identity, semantics, authorized export and permission evidence.

## Task 10 — official Mawaqit link in the prayer card

Date: 2026-10-30. The homepage prayer card now provides **عرض مواقيت مسجد السلام**, linking directly to `https://mawaqit.net/de/essalam-hamm` in a new tab. It includes `rel="noopener noreferrer"`, a no-referrer policy and an associated visible Arabic new-tab notice. The static attribution **المصدر: مسجد السلام — Mawaqit** remains visible with or without JavaScript and is independent of the countdown's dynamic provenance field. The link uses the existing button treatment, emerald/gold palette and a wrapping grid within the card.

The five-prayer disclosure and existing countdown engine are unchanged; production `prayerData` stays `null`, with no times or active countdown. The separate Friday heading now explicitly identifies the prayer room, and its sermon/iqama fields remain unset. No embed, automatic provider request, scraper, private API or timetable copy was introduced. Original logo bytes, exact tagline, hero sizing and responsive breakpoints are unchanged.

`npm run verify` passed zero Astro/TypeScript diagnostics, the production build, **147 tests across 9 files**, six-route/link/asset validation, original logo checksum, licenses, leakage checks and formatting. Added tests verify the exact official destination/link text, attribution, safe external-navigation attributes, new-tab description, focusability, persistence after initialization and inactive daily/Friday times. Existing countdown/disclosure tests still pass. Public JavaScript remains **4,548 bytes gzip**. No new browser-rendered layout or real-device verification is claimed. No main merge or deployment was performed.

## Task 11 — Friday sermon platform

Date: 2026-10-30. The sermon overview now includes the next released approved sermon, eight upcoming Friday calendar slots, explicit availability states and a published archive. The production content catalog is empty: dates are unassigned, and no topic, sermon, study, religious quotation, reference record or approval identity has been invented. Existing source attribution and the clearly labeled reading preview remain available.

Typed sermon, study and independently approved schedule-announcement records feed a shared publication gate. Approval digests bind the reviewed content, revision, rights, references and intended publication time; historical seals also bind approval metadata. Missing studies, invalid references, unconfirmed rights, altered approved revisions and premature publication fail validation. Only released approved pairs generate versioned detail/study routes and offline files. Planned titles require their own approved announcement. History must be retained unchanged; hashes support review but do not authenticate a reviewer or prevent a trusted maintainer from rewriting both content and ledger.

Published detail pages render both khutbah parts, human-reviewed duration, exact specified publication time, revision, sources and the real **اقرأ الموضوع كاملاً** study link. Reading tools provide a fullscreen-style native dialog, bounded Arabic font controls, optional screen wake-lock with lifecycle cleanup, and print formatting. Approved offline HTML includes the complete versioned sermon, references, embedded licensed Amiri fonts and their OFL notice. Offline copies do not update or revoke themselves, and external study/reference links require connectivity.

The build uses a single publication cutoff and emits a public route manifest. Future cutoffs are rejected. No scheduler is enabled: advancing publication or the eight-week calendar requires a later authorized build/release. [SERMON_CONTENT.md](SERMON_CONTENT.md) documents the model, human review and rights checks, immutable revisions, content-entry procedure and first-content acceptance gate. README includes the platform workflow. No new dependency was introduced.

**Verification:** `npm run verify` passed with zero Astro/TypeScript diagnostics, production build, **172 tests across 11 files**, static route/link/asset validation, exact original logo checksum, font/license checks, public fixture-leak checks and formatting. New tests cover approval/embargo/history gates, exact study links, Friday date boundaries, HTML escaping, synthetic offline artifact generation, embedded fonts, print markup, reading/font controls, wake-lock denial and asynchronous cleanup, and structural accessibility. Synthetic fixtures are explicitly non-religious test content and are rejected by the production gate. The actual public build contains the six original HTML routes plus the publication manifest, with no sermon detail, study or download routes until content is approved. Public JavaScript on those existing routes remains **4,548 bytes gzip**.

**Limits and approval dependencies:** browser discovery returned no available browsers. Native dialog keyboard containment, wake-lock behavior, rendered mobile/desktop layouts, Arabic text shaping, print pagination and real-device downloads have not been visually verified. Populated Astro detail/study/download routes must receive build and browser acceptance with the first genuine approved content; current automated artifact/rendering checks use synthetic fixtures in tests. Homepage markup/styles, logo, tagline and prayer integration are unchanged; production prayer data remains inactive. No main merge, deployment, backend, authentication, scheduler or paid service was added. Work stops at human approval of real sermon/study content and its references, permissions, duration and publication metadata.
