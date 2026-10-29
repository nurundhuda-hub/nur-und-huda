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
