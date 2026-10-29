# Nur und Huda — technical audit

Audit date: 2026-10-29. Repository: `nurundhuda-hub/nur-und-huda` only.
Inspected commit: `8f7adfd`. Working branch: `codex/audit-and-rebuild`.
Status: audit and proposal only; no application changes, merge, or deployment.

## Executive assessment

The current site is an honestly labelled static design prototype, not a functioning community service. Preserve its original logo, approved Arabic tagline, external-source approach, and refusal to display fabricated prayer times. The immediate defects are a shared JavaScript crash on all five secondary pages, an unusable library search there, palette drift, and low-contrast imam-dialog headings. Legal disclosures, prayer-source approval, content approval, and a privacy-conscious backend remain launch dependencies.

Recommend a static-first multipage site with Astro and TypeScript, retaining ordinary HTML navigation and adding small interactive components. A site-wide React SPA is unnecessary. Community writes and administration need a separate backend; neither GitHub Pages nor a frontend framework supplies one. See [ARCHITECTURE.md](ARCHITECTURE.md) and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Scope and evidence

- Read every tracked text file and inspected file inventory, local branch state, recent commit subjects, logo dimensions/size/hash, internal paths, IDs, and heading structure.
- Initial working tree was clean. Local `main`, `origin/main`, and the working branch pointed at `8f7adfd`; remote references were not refreshed. `main` was not checked out or changed.
- No applicable `AGENTS.md` was found in the repository or ancestor instruction locations. No other project or repository was inspected.
- Reproduced JavaScript initialization using Node's VM with a minimal DOM stub generated from each page's actual IDs. This confirms the missing-element exception, but does not substitute for browser testing.
- Calculated text/background contrast from CSS colors using relative luminance. Checked local file/fragment references with Python's HTML parser.
- Consulted primary public documentation for hosting, integration permissions, privacy, and architecture. External facts below were checked on the audit date; terms and limits must be rechecked when implementing.
- A temporary localhost server was started and stopped. Browser inspection could not proceed: the in-app browser was unavailable and the browser inventory was empty. No screenshots, device tests, screen-reader tests, Lighthouse scores, or rendered layout measurements are claimed.
- Production URL, Pages settings/source, HTTPS configuration, branch protections, repository visibility, Actions settings/history, account MFA, and backend accounts were not verified. Absence of configuration files does not prove absence of GitHub UI settings. This is not a full Git-history secret scan or a legal certification.

All HTML files and `app.js` occupy one physical line; findings therefore identify elements/selectors as well as line numbers.

## Existing architecture and file structure

```text
/
├── README.md           Prototype status and direct-open instructions
├── index.html          Homepage and all currently working interactions
├── together.html       Community-prayer explanation only
├── sermons.html        Sermon placeholder and source link
├── quran.html          Official-source and rights links
├── library.html        Search UI and two source-directory links
├── legal.html          Sources, privacy draft, Impressum placeholder
├── app.js              Disclosure, preview dialog, three-entry search
├── style.css           Shared theme, responsive and print rules
└── assets/
    ├── logo.jpeg       Original approved image
    └── .gitkeep
```

There are six HTML pages, one stylesheet, one script, one image, and no package manifest, build process, framework, database, API, authentication, CMS, service worker, test runner, or tracked CI workflow. Navigation uses relative `.html` links. Google Fonts CSS is imported remotely; the homepage script creates external library links using `textContent`. No application analytics, cookies, local storage, or submission endpoints appear in the inspected source.

`assets/logo.jpeg` is 1254 × 1254, 409,890 bytes. Preserve the file byte-for-byte:

```text
SHA-256 547d63a94e56f7c6a8b4e9f17370dc8f0c1ed3e733cceac7bb61f0fda8b824f5
```

## Severity scale

| Severity | Meaning |
| --- | --- |
| Critical | Confirmed immediate severe exposure or dangerous misinformation; none established in this audit. |
| High | Broken advertised interaction, major accessibility barrier, or blocker before the affected service launches. |
| Medium | Significant design, usability, maintainability, or assurance gap. |
| Low | Minor clarity or polish issue. |

An unimplemented feature is distinguished from a present defect. Conditional launch blockers do not mean the inactive prototype currently processes that data.

## Findings

### A01 — High — Shared script aborts on every secondary page (confirmed defect)

**Evidence:** `app.js:1` calls `toggle.addEventListener` immediately after looking up `#prayer-toggle`. Only `index.html:1` contains that element; all other pages include the script. The VM reproduction returned:

```text
index.html: initialization succeeded; 3 initial search results
together.html: TypeError: Cannot read properties of null (reading 'addEventListener')
sermons.html:  same TypeError
quran.html:    same TypeError
library.html: same TypeError
legal.html:   same TypeError
```

**Impact:** secondary-page initialization stops immediately. `library.html` search never initializes, despite having its input and results container. Static HTML still displays; this is not a total page-render failure. Fixing only the first dereference would expose further homepage-only dialog assumptions.

**Recommendation:** isolated, element-scoped initializers or page-specific modules, each safe when absent. Add a smoke check for every route and a real library-search regression check after approval to rebuild.

### A02 — High — Prayer service has no operational data pipeline (intentional gap)

**Evidence:** `index.html:1`, `#prayer`, has unavailable messages, a dash countdown, five names without times, and undetermined Friday information. `app.js:1` only opens the disclosure; no time source, clock, timezone, date rollover, or Friday schedule exists.

**Impact:** next prayer, live countdown, daily times, and separate sermon/iqama times are not implemented. The current warning is appropriate and must remain until data is approved.

**Recommendation:** approve a source and fixed prayer-room location, explicit `Europe/Berlin` handling, method/version metadata, stale-data states, and seasonal validation before activating times. Mawaqit describes its API as private and offers an official URL/widget through support; public visibility does not authorize scraping or use of private endpoints. [Mawaqit API guidance](https://help.mawaqit.net/en/articles/11991838-can-i-use-your-api)

### A03 — High — Community and administration services do not exist (intentional gap)

**Evidence:** `together.html:1` contains explanatory text only. There are no create/join controls, records, notifications, expiration jobs, moderation, admin route, login, rich text editor, scheduling, version history, announcements, or contact inbox. The homepage has only a `mailto:` contact link.

**Impact:** the approved interactions require new server-side work. Local storage or public Git commits would not provide shared, private, expiring records.

**Recommendation:** implement only after backend, abuse prevention, retention, and admin authentication gates are met. Public forms must not be enabled during a visual-only milestone.

### A04 — High — Legal disclosures and sensitive-data decisions are incomplete (launch blocker)

**Evidence:** `legal.html:1`, `#privacy` and `#impressum`, explicitly contain drafts/placeholders. No verified operator identity, controller contact, processing inventory, retention policy, or rights process is documented. `style.css:1` initiates remote Google Fonts requests on every page.

**Impact:** the site cannot claim privacy readiness even while static. GitHub states that Pages logs visitors' IP addresses. Proposed nicknames/messages associated with prayer gatherings may reveal religious belief or identify colleagues; absence of accounts does not establish anonymity. This is an architectural risk assessment, not a conclusion about a particular legal basis. [GitHub Pages data collection](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [EDPB guidance on lawful processing and sensitive data](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_de)

**Recommendation:** supply verified operator details and assess applicable German provider-identification duties; do not invent a hospital address or claim hospital sponsorship. Document hosting/font/email processing now, and Article 6 basis plus any necessary Article 9 condition before community processing. Prefer licensed self-hosted fonts. Non-commercial status alone does not resolve disclosure obligations. [DDG § 5](https://www.gesetze-im-internet.de/ddg/__5.html)

### A05 — High — Imam preview heading has insufficient contrast (confirmed CSS defect)

**Evidence:** global `h2` in `style.css:2` sets `#f0d38b`; `dialog` in `style.css:4` sets background `#faf3e5`. The dialog's inherited dark text does not override the explicit heading color. Contrast is approximately **1.32:1**, below even the 3:1 requirement for large text. Other sampled pairs are not universally poor: body ivory on the main background is approximately 13.20:1, and card heading on `#10513f` is approximately 6.34:1. [WCAG 2.2 contrast requirements](https://www.w3.org/TR/WCAG22/#contrast-minimum)

**Recommendation:** explicit light-surface text tokens and measured contrast for all states. Browser verification remains required, especially if the font itself paints colored glyphs.

### A06 — Medium — Approved palette is not implemented (confirmed design mismatch)

**Evidence:** `style.css:2` defines background `#062e26`, green `#0c4a3c`, gold `#d4b46d`, and cream `#fbf2dc`; the homepage theme-color is `#06382e`. Numerous independent colors appear in gradients and selectors.

| Role | Required value |
| --- | --- |
| Primary background | `#073D30` |
| Secondary green | `#0E5140` |
| Gold | `#C9A45C` |
| Light gold | `#E4C783` |
| Ivory | `#F8F3E6` |

**Recommendation:** centralize these exact tokens, derive ornament opacity from them, and measure each color pairing. No explicit red CSS text color was found. However, the selected `Aref Ruqaa Ink` face requires a glyph-palette inspection; CSS `color` alone is not sufficient assurance for a color-font variant. Its actual browser rendering was not verified. Prefer a licensed monochrome Ruqaa face and explicitly test the no-red requirement.

### A07 — Medium — Typography, logo treatment, and content identity need consolidation

**Evidence:** Ruqaa-style headings and Amiri body text match the intended categories, but fonts are remote (`style.css:1`) and have no bundled license records. `.logo` applies `mix-blend-mode:lighten`, a shadow, and rounded corners (`style.css:2`), which changes its rendered presentation. The image lacks intrinsic HTML width/height. `.mission` and mobile `.logo` rules are overridden later in the stylesheet.

**Impact:** typography depends on third-party availability; cascade changes are hard to reason about; image space is not reserved explicitly. Visual treatment may differ from approval without modifying the source image.

**Recommendation:** preserve the original image, review its treatment without blending, reserve its aspect ratio, self-host verified font files with licenses, and consolidate selectors. The visible tagline is already exactly **منبر للذكر .. ومرجع للعلم النافع**. The homepage description omits its dots; use the exact approved text wherever reproducing the tagline. The official German hospital name appears only in the footer, not the hero: this is currently consistent with avoiding prominent hospital branding.

### A08 — Medium — Mobile and accessibility support is partial

**Confirmed in source:** all pages declare `lang="ar" dir="rtl"` and viewport metadata; the layout has a 680px breakpoint; focus-visible styling, input labels, a native dialog, and disclosure ARIA attributes already exist. Retain these strengths.

**Gaps and risks:**

- Homepage has no `h1` or skip link. Secondary pages have only a back link instead of shared primary navigation/current-page state.
- `#imam-dialog` has no `aria-labelledby` association. Its close button has no explicit text color on a light surface while the document declares a dark color scheme: rendered contrast needs checking.
- Mobile nav uses 13px text without explicit target padding/minimum dimensions. Target size and spacing compliance cannot be established without rendering.
- `scroll-behavior:smooth` has no reduced-motion override; sticky-header anchor clearance is not defined.
- Search has no explicit empty-results message or announced result summary. German headings/footer text are not tagged `lang="de"`; bidirectional mixed content needs inspection.
- Hero minimum heights are 620px/510px. On short screens this can delay access to the prayer card. No measured overflow is claimed; verify 320px width, landscape, zoom, and Arabic line wrapping.
- Print CSS is partial: homepage footer/hero remain, some headings and links retain gold, and no approved sermon print layout exists. No offline path exists.

**Recommendation:** use the concrete device, keyboard, screen-reader, contrast, zoom, print, and reduced-motion checks in the implementation plan. A source review cannot certify WCAG conformance.

### A09 — Medium — Library and Quran source navigation overstates some destinations

**Evidence:** `app.js:1` contains three directory-level links, not a curated book catalog. The named primary book links to the general Arabic directory; its exact edition/availability is not established. Search checks title/tags, not a real subject taxonomy. `index.html:1` labels a link “المصدر الرسمي” while opening the internal `quran.html` page in a new tab.

**Impact:** users may expect a particular book or official external destination and reach an index instead. There are no book descriptions, exact edition references, or asset-specific license records.

**Recommendation:** distinguish source-directory links from verified book records and internal Quran navigation. Arabic and German Risala directory pages were reachable through the research tool, but specific book links and redistribution rights were not verified. [Arabic directory](https://risala.prh.gov.sa/ar/main-content), [German directory](https://risala.prh.gov.sa/de/main-content)

The King Fahd rights page grants use of the specified Illustrator digital edition, including websites; it is not blanket permission for all text, fonts, APIs, scans, or audio on related domains. Until a particular asset and its conditions are verified, retain official links only. [Edition-specific rights](https://dm.qurancomplex.gov.sa/rights/)

### A10 — Medium — Sermon lifecycle is only described, not implemented

**Evidence:** `sermons.html:1` has no eight-week schedule, approved text, two-part reading view, extended-study route, reference records, downloadable edition, publication timestamp, or approval/version metadata. The homepage dialog is explicitly a preview. “اقرأ الموضوع كاملاً” appears in prose, not an actual link beneath a sermon.

**Recommendation:** separate schedule metadata, approved two-part sermon, and extended study; require documented human review and approximately seven-day publication lead time. No invented topics or religious citations should fill empty slots. Scope is large but honest placeholders reduce immediate misinformation risk.

### A11 — Medium — Deployment and security controls are undocumented/unverified

**Evidence:** no tracked Actions workflow, package/lockfile, dependency update policy, deployment runbook, custom 404, or security policy is present. Current relative links resolve locally and do not inherently require SPA routing. A missing `CNAME` or `.nojekyll` is not by itself a defect for this simple source tree.

**Impact:** releases rely on unknown external configuration and manual checks. Future client-side secrets, untrusted rich text, anonymous writes, and authentication would add risks not currently present.

**Recommendation:** later verify Pages source and HTTPS; add build/test-only PR checks, protected production publishing, rollback instructions, and base-path tests. Keep private drafts, service credentials, inbox data, and gatherings out of public source/build output. Define API authorization and sanitized rich-text boundaries before implementation. Do not claim header-based protections from files that Pages does not serve as header configuration.

No obvious credentials, executable user-content sink, or active submission API was found in the inspected working tree. `textContent`, native controls, and `noopener noreferrer` on existing new-tab links are positive choices; none proves the safety of future backend code.

### A12 — Medium — Automated quality controls are absent

There are no committed checks for syntax/linting, type safety, route initialization, broken links, accessibility, visual regression, content schemas, license completeness, prayer-date logic, privacy expiration, or publication authorization. Dense single-line source makes review and future diffs harder. Add checks incrementally where functionality exists; do not build tests against invented religious content or present arbitrary fixture times as real schedules.

## Audit verification results

| Check | Result and limit |
| --- | --- |
| Working branch / initial status | Correct branch; clean at start. |
| Local asset and fragment references | No broken local references among the six pages. External links not exhaustively checked. |
| JS initialization | Homepage passes minimal DOM harness; five secondary pages fail deterministically. |
| Heading inventory | Homepage lacks `h1`; secondary pages have one. |
| CSS contrast sample | Imam heading fails at 1.32:1; sampled main text passes. Not a full contrast audit. |
| Logo | Original exists and checksum recorded. |
| Production/device/security settings | Not verified; explicit acceptance work remains. |

## Priority order

1. Review this audit and architecture before any rebuild. Keep truthful inactive states.
2. Fix page initialization and imam readability as part of the approved visual milestone; restore exact identity and accessible shared navigation.
3. Complete operator/privacy/source decisions and prayer methodology validation before public activation.
4. Deliver approved static content, then protected administration and backend publication, then community writes and expiration.
5. Add optional notifications only after retention, browser support, and consent are tested. Nothing in this audit authorizes paid services, deployment, or a merge.
