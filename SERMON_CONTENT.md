> **Current policy (Task 27):** an owner-approved approximate duration replaces the earlier timed-reading prerequisite. Historical task sections below describe their original checkpoints; they do not override this decision. The r1/r2 pair is now prepared privately with completed release checks; the UTC embargo still applies. See [SCHEDULED_RELEASE.md](SCHEDULED_RELEASE.md).

# Friday sermon content and release contract

Tasks 11–15 · Updated 2026-11-01 · Public editorial series metadata present; public sermon, study, announcement and approval collections remain empty. The first private draft pair and a development-only visual preview exist locally.

Draft outside the website. AI-assisted text must receive human religious, reference, duration and rights review before publication. This implementation contains no invented topics, Quran quotations, hadith or real reference records. Synthetic test bodies explicitly say they are not religious content and cannot enter the public build.

## Current public behavior

`sermons.html` provides the next available approved sermon, eight upcoming Friday calendar slots and an archive. With no approved records, it shows unassigned dates and honest empty states. A calendar slot is not an assertion that a sermon or gathering has been scheduled. The existing main reference label **ما لا يسع المسلم جهله** is retained; its general directory link is not presented as a verified edition, page citation or newly approved source.

The underlying statuses are deliberately separate:

| State                        | Public behavior                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unavailable                  | Date only; no topic, detail route or download.                                                                                                                            |
| Planned                      | A separately reviewed schedule announcement may disclose its title/date. The draft body remains private.                                                                  |
| Approved, before publication | No body, study or download. The title appears only through an independently approved announcement.                                                                        |
| Published                    | Approved sermon and its exact approved study revision have reached the approved publication time. Full text and versioned download become eligible for this static build. |

“Published” describes inclusion in the generated static release, not proof that GitHub Pages has deployed it. This task does not merge, release or deploy.

## Content model

`src/lib/sermons/model.ts` defines `SermonRevision`, `StudyRevision`, `ScheduleAnnouncement` and `SermonCatalog`. The server-only store is `src/content/sermons.ts`. Do not import that store into a client script or commit private drafts to this repository. An ignored `.sermon-review/` directory is available for local preparation; it is not encrypted storage or a backup service.

Each sermon/study has a stable slug, `r1`/`r2`… revision, title, edit/publication UTC instants, human approval, rights confirmation/attribution and verified reference records. The sermon adds its actual Friday date, exactly two nonempty khutbah parts, an owner-approved approximate duration and an exact study ID/revision. The target is approximately ten minutes in total. Task 27 explicitly removes mandatory timed reading. Record `basis: "owner-approved-estimate"`, `humanTimed: false`, positive `minutes`, `approvedBy`, the actual decision-recording time `recordedAt`, and an acceptance `note`. Display “المدة التقريبية: 10 دقائق” for the first sermon. This is not a human measurement.

Text blocks contain plain text and citation IDs, with `paragraph`, `quran` or `hadith` kinds. There is no arbitrary HTML/MDX execution. Renderers escape text without rewriting its spelling, punctuation or diacritics. Each Quran/hadith evidence block needs a matching reference kind. A study requires both Quran and hadith evidence slots, explanations in sections and verified references. These checks verify structure only; authenticity, exact quotation, interpretation, translation rights and citation accuracy remain human responsibilities. Do not populate a required slot with a fabricated quotation merely to pass validation.

References record kind, label, exact locator (edition/page or other verified identifier), optional HTTPS URL, verifier and verification instant. Only real, reviewed references may be entered. Unsafe URLs, missing evidence, absent study revisions, unconfirmed rights, stale approvals, missing khutbah parts and non-Friday dates fail the build. An approved sermon cannot reference a draft study or one scheduled to publish later.

## Approval and historical revisions

Approval is explicit: `status: 'approved'`, the matching revision, a public-safe reviewer ID, `reviewedAt` and the `contentDigest(record)` SHA-256 from `src/lib/sermons/publication.ts`. The digest covers the complete record except its approval object, including text, study binding, references, rights and intended publication time. Editing any covered field invalidates approval. The review instant must be no earlier than the edit and no later than publication; duration/reference checks must precede final approval.

After that review record is complete, append a catalog `history` entry with kind, ID, revision and `revisionSeal(record)`. This second hash includes the approval metadata. Every approved record needs a matching seal; every historical seal must still resolve to the unchanged approved record. A correction creates a new revision. Old released versions remain available at their original routes, and the archive selects the latest released revision while preserving links to all older released revisions.

The history ledger is append-only by editorial policy and code review. Hashes detect divergence from the retained ledger; they are not digital signatures, an authenticated approval service, or proof that a named reviewer performed the review. A maintainer able to rewrite both content and ledger could bypass that check, so inspect both in review. Never regenerate all historical seals to make a changed record pass. Git history is retained; no automatic history deletion is implemented.

Schedule announcements have their own revision, publication time, approval digest and history seal. They authorize disclosure of a planned title/date independently of private sermon text. Their ID identifies the corresponding sermon. Updating a planned title requires a new approved announcement; draft announcements do not appear publicly.

## Routes and offline artifacts

All routes include the GitHub Pages base `/nur-und-huda/`:

- `sermons.html`: overview, `#schedule`, `#archive`.
- `sermons/{id}/{revision}.html`: full two-part sermon, exact approved publication timestamp/revision, references, reading tools and history.
- `studies/{id}/{revision}.html`: real linked extended study with evidence and citations.
- `downloads/sermons/{id}/{revision}.html`: approved, versioned standalone sermon HTML.
- `sermon-publication.json`: build snapshot instant and the exact generated page/download paths; no private drafts or future titles.

Routes are generated from the same validated public projection. The **اقرأ الموضوع كاملاً** link points to the bound study version beneath each published sermon; no placeholder link is emitted. A study route exists only when linked by a released sermon. Downloads cannot be created for a missing, draft or future release. The current build has no sermon detail, study or download routes because no content has been approved.

The offline file includes the complete sermon, revision, references, embedded Amiri Arabic fonts and the complete SIL OFL notice, with no script or external font dependency. Its study/reference links require connectivity. It has no live update or revocation mechanism; a saved historical copy stays that version. Keep the version visible and ask readers to check the current site for corrections. Browser handling of the `download` attribute can vary; saving the standalone HTML through the browser is a fallback.

## Imam reading and printing

The published detail page offers a native modal dialog styled to fill the viewport. It is a fullscreen-style reading surface, not a request to hide browser chrome. It separates the two parts, uses readable local Naskh text, provides a labeled range and bounded size buttons, native Escape/focus containment and explicit focus restoration. The article remains readable without JavaScript or dialog support.

Screen wake-lock is opt-in through a button. It requires browser support and a secure context, can be refused/released by the browser or operating system, pauses while hidden and releases on close/pagehide/cleanup. A late asynchronous grant after closing is released immediately. An opted-in open session may reacquire after visibility/pageshow; failure leaves reading/printing usable. See the [Screen Wake Lock API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API). No camera, microphone, tracking or notifications are added. Task 15 adds device-local font/theme preferences as described below.

Print actions use the browser's print dialog. Print CSS hides reader controls, duplicated modal content and navigation, retaining the two-part article, metadata and references. The offline file has its own print rules. DOM tests verify structure and style rules; they do not establish pagination, native modal behavior, real-device wake locks or printer output.

## Scheduled publishing boundary

`publishAt` is the exact approved earliest publication instant in UTC; the public page labels it as the specified publication time. Dates for the eight-week schedule are derived in `Europe/Berlin`. The Node CLI wrapper establishes one `SERMON_BUILD_AT` for the whole build. Future public build clocks are rejected; an explicitly earlier clock can reproduce a prior snapshot. At the cutoff, eligible approved records and studies generate static pages. A draft never becomes eligible just because its date passes.

**No scheduler is activated.** A running static site will not publish content or refresh the eight-week calendar merely as time passes. A later authorized build/release is required. The desired approximately seven-day lead time is an editorial decision, not an enabled cron job or an invented automatic date. The manifest records build time, not the actual deployment timestamp. Restart a long-running dev server to advance its startup snapshot. [Astro static routing](https://docs.astro.build/en/guides/routing/) and [static endpoints](https://docs.astro.build/en/guides/endpoints/) supply the route generation.

## Entering the first real approved content

1. Keep drafts, AI-assisted preparation and private reviewer evidence outside the public repository. Obtain the genuine sermon, study and source/license evidence; do not use test fixtures as templates for religious text.
2. Prepare typed records for both parts and the extended study. Verify all quotations and locators, permissions/attribution, actual Friday date, duration and intended release instants. Use public-safe reviewer identifiers.
3. The responsible human explicitly approves each exact revision. Compute `contentDigest(record)` for that reviewed content, enter the matching approval fields, then compute `revisionSeal(record)` and append its history entry. These helpers only calculate hashes; they do not make the approval decision. Approve an announcement separately if a planned title should appear before the full release.
4. Add only reviewed records/history to `src/content/sermons.ts`. Tests deliberately assert that the religious content collections remain empty alongside the supplied series metadata. Replace those specific no-content assertions in the separately authorized content-entry change, retaining all approval, embargo, history, link and synthetic-data leak checks.
5. Run `npm run verify`. Inspect every generated route, revision link, study citation, reading mode, printable page and offline file with the actual approved Arabic content on target devices. Review the manifest and all staged changes before a separately authorized release.

Stop at human content approval in this task. No real sermon, study, approved announcement, calendar assignment, download or review identity has been invented or activated.

## Task 12 — educational series and original content-import gate

`src/content/educational-series.ts` holds only the user-supplied editorial plan: **ما لا يسع المسلم جهله**, subtitle **رحلة في تعلم أصول الدين**, four ordered phases and the eight exact supplied topics. All eight initial topics belong to the first phase, **العقيدة وأصول الإيمان**. Later phases have no invented topics. The first topic retains its full editorial label and separate sermon title **لنتعلم ديننا على بصيرة**. The user supplied the intended book title and committee attribution; the UI explicitly marks the local edition/pages/usage terms as unverified. There is no new source URL, quotation, page reference or license claim.

The public roadmap is at `sermons.html#series-ma-la-yasa`; topic anchors provide keyboard-accessible navigation. Its first companion-study outline contains headings only for the meaning of Islam, five pillars, two testimonies, knowledge before action, verified Quran/Hadith evidence and primary-book attribution. It is not a study route or a substitute for the real article. No **اقرأ الموضوع كاملاً** link appears for an unpublished topic. The existing eight-week Friday calendar remains independent and unassigned; neither a first Friday nor a publication date is inferred from topic order.

`src/lib/sermons/series.ts` validates unique series/phase/topic identities, contiguous order, phase progression and unique sermon/study bindings. When real revisions are supplied, both the first sermon and companion study must carry `series: { id: 'ma-la-yasa', topicId: 'introduction' }`. Their reserved IDs are `learn-our-religion` and `learn-our-religion-study`; these are prospective identities, not public routes or approvals. The sermon must bind the exact approved study revision through its existing `study` field. Do not create an `r1` record merely to fill a slot.

Membership is covered by the existing approval digest and immutable history seal. Changing it on an approved record requires a newly reviewed revision, not rewriting history. Other sermons may remain outside any series. The roadmap selects the latest released revision per topic, while old sermon/study routes retain their exact revision pairing. Series/current/previous/next navigation targets real roadmap anchors, including for the standalone offline document; links from an offline file need connectivity. Imam mode, fonts, printing and download eligibility still use the same publication gate. Editorial metadata does not approve a body or override an embargo.

### Exact input required to resume

At the Task 12 checkpoint, repository inspection included hidden/ignored local review files, excluding generated/dependency directories. It found no complete approved ChatGPT sermon draft and no local PDF, DOCX or text copy of the primary book. No other project, remote chat history or web book was accessed in that task. Task 13 intake below supersedes the missing-draft status; the local book remains absent.

The file requested at that checkpoint, now supplied locally, is:

`/Users/ahmadghalayini/Projects/nur-und-huda/.sermon-review/first-sermon-approved.txt`

It must contain the **complete exact revised user-approved draft**, both khutbah parts, in UTF-8. Preserve all words, diacritics, punctuation, paragraph breaks and the original separation between the parts. Do not replace it with a summary, topic list, regenerated draft or only the first part. If the part boundary is not explicit in the original, identify it separately rather than inserting new religious text. Keep the supplied original unchanged and record its SHA-256 before a later import; compare extracted body text against that original during review. No import command or file watcher runs automatically.

For primary-source verification, also provide the genuine local book at `.sermon-review/primary-source.pdf` (or identify the actual local file if another format). The book's arrival does not establish redistribution permission. Review edition/committee attribution, exact locators and any source URL/rights evidence before adding citations. No external source link is required merely to fill the outline.

After intake, human review must verify the supplied sermon and companion study, all Quran/Hadith references, source attribution and permissions, approximately ten-minute reading duration, actual Friday, revision and publication instant. Only then can the separately reviewed records/history be entered under the existing workflow. The first sermon draft is the immediate import blocker; an approved companion study, verified evidence, rights and explicit dates remain additional publication prerequisites. Task 12 stops here without creating religious content or approval records.

## Task 13 — private, undated draft intake

The complete supplied source has now been read and imported without rewriting. Private artifacts stay in ignored `.sermon-review/` and are **not committed**:

- `first-sermon-approved.txt`: unchanged user-supplied UTF-8 source. Its name is not publication approval.
- `first-sermon-reference-review.json`: source-hash-bound research observations, URLs, exact source spans for study excerpts and remaining blockers. This is not a human-verified public citation list.
- `first-sermon-r1.bundle.json`: two separate typed records, sermon `learn-our-religion/r1` and study `learn-our-religion-study/r1`, linked to `ma-la-yasa/introduction` and each other.
- `FIRST_SERMON_REVIEW.md`: local findings, source links, limitations and outstanding content decisions.

`src/lib/sermons/drafts.ts` defines the private model and lossless intake. It keeps the complete raw source, original SHA-256/byte count and exact slices for the two body parts. Slice offsets are JavaScript UTF-16 indices, not UTF-8 byte offsets. BOM/CRLF, diacritics and Markdown are retained. The source's title, headings and separator remain in `source.rawText`; no regularization or automatic religious correction occurs. The private record format is explicitly `supplied-markdown-verbatim`. This is an intake format, not a new public Markdown renderer.

Both records have `purpose: 'private-review'`, `approval: { status: 'draft' }`, null publication dates and pending rights. The sermon also has null Friday and duration fields. The public catalog rejects this model even if an approval label is changed. At the Task 13 checkpoint there was no preview route. Task 14 below adds local development reading only; no private file is imported by the public build and no draft offline download is created. Existing published imam-mode, print and offline architecture is unchanged.

The companion study is a **partial source compilation**, with six sections populated only by exact selected supplied passages and research notes. Research supports the supplied Quran locations and hadith collection references, with excerpt/orthography and narration-wording qualifications recorded privately. Book authorship was checked on the official catalog; no local book was available and its remote body was not used to compose the study. Book-dependent explanations, edition/locators, rights, final orthography review, local contextual claims and human duration review remain pending. No unverified source claim is promoted to a public `Citation`, and no unsupported extended explanation is generated.

### Reproducing intake

```sh
npm run sermon:import -- \
  --input .sermon-review/first-sermon-approved.txt \
  --review .sermon-review/first-sermon-reference-review.json \
  --out .sermon-review/first-sermon-r1.bundle.json
```

This command has already been run locally; repeating that destination fails rather than replacing the existing review. All three paths must be distinct files directly in the real `.sermon-review/` directory. Symlink inputs/review directories, public output paths, changed source hashes and malformed part boundaries are refused. Output is created exclusively with mode `0600`. It performs no network access and does not write to `src/content/sermons.ts`. Creating this ignored directory on another machine does not recreate the private source/review inputs.

The `DraftIntakeReview` schema requires the exact source SHA-256, research-check time, series/topic, revision, reference observations, section headings/notes, exact body spans and remaining blockers. Reference findings distinguish supported wording/excerpts, variant wording and attribution-only evidence. Study excerpts can only copy slices of the supplied body; blank sections remain blank until real material is reviewed. Research fields are not human approval fields. Do not silently update a research hash after editing the original; create and review a new source revision.

Run `npm run verify` after implementation changes. Tests use synthetic non-religious input and never require the real private source. Build validation rejects private bundle/format markers and, when the exact local source is present, scans raw output and rendered page text for long private paragraphs. This comparison-only scan handles whitespace/Markdown differences but is defense in depth, not a proof against arbitrary obfuscation. The primary protections remain separate private storage, no build import and the public publication gate. Fresh clones run all public gate/marker tests without private files.

There is no automatic promotion command. A future authorized content change must complete independent human sermon/study, reference and rights reviews; choose the Friday and publication instant explicitly; convert reviewed text into public content blocks while comparing it to the unchanged supplied source; then apply the existing approval digests and history seals. Formatting conversion must not rewrite Arabic words or diacritics. Until those decisions exist, keep the public religious-content collections empty and do not weaken the no-content tests or local leakage checks.

## Task 14 — owner-authorized local visual preview

The owner approved displaying the supplied sermon for visual testing only. This does not change either private draft's approval status, fill a Friday/publication date, complete the companion study or grant production publication rights.

Open `/nur-und-huda/_review/first-sermon` on the loopback address printed by `npm run dev`. The current test server uses `http://127.0.0.1:4340`. The full notice **نسخة تجريبية للمراجعة — غير منشورة للعامة** appears on the article and inside the imam dialog; print CSS retains the article's notice and both parts. The page displays the supplied vocalized title, original preamble, series title and lesson 1. Original words, diacritics and punctuation are preserved. Only Markdown title/part delimiters and paired `**bold**` markers are interpreted as presentation. Embedded HTML is escaped, and no Markdown links, images or executable content are enabled. Browser DOM line endings normalize CRLF to LF; the source file itself is never modified.

The preview reuses the existing reader frame and controller for modal open/close, focus restoration, bounded font controls, optional wake-lock and print actions. It never constructs a fake `PublishedSermon`, study or approval to satisfy a public renderer. There is no source download or companion-study link. Saving or printing through the owner's browser creates a local review copy, not an approved public offline artifact.

`scripts/local-sermon-preview.ts` registers middleware only for Astro's `dev` command. It injects no Astro page route and performs no read during builds, sync or static preview. A request reads only the fixed local source path and refuses symlink sources/directories. Listening address, peer address and Host must be loopback; the Host port must match the server. Forwarded headers and cross-origin requests are rejected. Responses use `no-store`, no-referrer, no-index and anti-framing headers. Vite's filesystem deny list additionally blocks `.sermon-review/`, including raw/absolute-file URLs, and the watcher ignores it. The client entry imports only safe styles, locally installed fonts and the existing reader controller. No draft text enters a JavaScript module or build artifact.

This is not a remotely hosted preview service. Keep the dev server bound to loopback and do not expose it using a reverse proxy/tunnel. A deliberately configured local intermediary that strips and rewrites all request metadata is outside the request checks' protection. `npm run preview` and GitHub Pages serve only `dist/`; neither has this middleware or route. The build validator explicitly rejects preview notices, paths, markup markers, client entry names and private source paragraphs in production output.

Restart an already running Astro daemon after changing integration code: `node scripts/astro.mjs dev stop`, then `npm run dev`. Refresh the page after source edits; a missing/invalid file returns a generic 503 without private text or filesystem traces. In a fresh checkout the owner must supply the ignored local source separately. No tracked file contains it.

Automated tests verify exact body text, safe formatting, labels, absence of dates/study/downloads, imam controls, font changes, print calls, local request policy and registration/output exclusion. Live localhost HTTP checks verify the genuine document and blocked private-file/cross-origin/forwarded access. Browser rendering is unavailable in this session: native print preview/pagination, native modal behavior, font appearance, wake-lock and device layouts require the owner's visual test. Technical basis: [Astro server integration hooks](https://docs.astro.build/en/reference/integrations-reference/#astroserversetup) and [Vite filesystem deny rules](https://vite.dev/config/server-options.html#server-fs-deny).

## Task 15 — responsive imam reader

The reader is a viewport-height dialog with a non-scrolling toolbar and a separate scrollable text region. The toolbar wraps, has at least 44px touch controls, safe-area padding and its own overflow for short screens/high zoom. The text region is keyboard-focusable. Navigation behind the native modal remains inert. CSS supports dynamic viewport height, reduced-motion behavior and forced colors; it does not disable browser zoom or text scaling.

Font decrease/increase use two-unit steps from 18 to 44, with reset to 32. These are nominal CSS pixels at a 16px root, applied as `size / 16 rem` so larger root/accessibility text settings are respected rather than capped. The device theme is the default, with explicit light/dark choices. `nur-und-huda.reader.v1` stores only `{ version, fontSize, theme }` in localStorage after a preference change. No reading history, position, sermon IDs or text are stored or transmitted. Invalid/blocked storage falls back safely; clearing this origin's browser site data removes saved preferences. Localhost ports have separate storage origins.

Font changes capture the visible text position with the browser caret APIs (including a Safari-compatible fallback) and compensate scroll position after reflow. Without caret support, the fallback preserves approximate progress through the visible block or scroll region. This is not a claim of pixel-perfect anchoring in every browser; real-device acceptance remains pending. Original sermon DOM text is not changed. Fullscreen is requested only by button action when supported and exits on close/cleanup; refusal leaves the fullscreen-style dialog usable. Wake-lock remains separately opt-in. Printing uses the original article rather than a duplicate dialog and does not inherit dark reading colors. See [fullscreen behavior](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen), [caret positioning](https://developer.mozilla.org/en-US/docs/Web/API/Document/caretPositionFromPoint) and [localStorage limits](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

## Task 15 — local approval and separate publication

**No real content is approved by this implementation task.** Owner permission to visually preview the first sermon is not reference/rights approval. The partial study, pending book evidence, duration and explicit Friday/publication decisions must be resolved first. Approval commands have no network access or web endpoint, and are not called by Astro or the preview. All output stays in `.sermon-review/`; the CLI refuses public destinations, symlink inputs/directories and overwrites. Existing revision history is preserved.

The local state sequence is `reviewed` → `approved` → `prepared` → `publication-authorized`. The last state is a private export authorization, **not an assertion that the website is published**. Neither approval nor the passage of time changes `src/content/sermons.ts`. The final public-content entry/build/release is a separate explicit action below.

### 1. Finish source and companion-study review; prepare private input

Read the exact source in the local preview, and resolve every blocker recorded in `first-sermon-r1.bundle.json`. Obtain the genuine complete study, verified references and rights evidence. The first draft currently does not satisfy these prerequisites. Do not populate missing evidence or dates merely to pass software checks.

Create `.sermon-review/publication-candidate.json` with **only** `{ "sermon": ..., "study": ... }`, using `SermonRevision` and `StudyRevision` from `src/lib/sermons/model.ts`. Both must still have `approval: { "status": "draft" }` and `purpose: "production"`; here that purpose describes the intended public schema, not permission to publish. The IDs, revisions and series membership must match the imported private pair. Preserve the first sermon title and exact body text, interpreting only supplied bold delimiters and structural whitespace. Splitting into paragraph blocks must preserve the same words/diacritics and paragraph order; a text change requires a new supplied source/import and review.

The candidate must include an explicitly chosen real Friday, UTC edit/publication instants, an owner-approved untimed duration estimate, confirmed rights evidence/attribution and genuine references with public-safe verifier IDs/times. Use a publication instant after the intended approval; never use a past date to skip review. The complete study must contain its verified Quran/Hadith evidence and explanations, and the sermon must bind its exact study revision. Keep private notes, source dumps and credentials out of these public-shaped records; unknown fields are rejected. Do not copy the private intake record and relabel it as production.

Create `.sermon-review/publication-checks.json` using `ReviewChecks` in `src/lib/sermons/approval-workflow.ts`:

- `reviewer`: public-safe human reviewer identifier.
- `confirmations`: each of `sourceText`, `references`, `rights`, `completeStudy`, `duration`, `dates`, `context` must contain `{ "confirmed": true, "evidence": "actual human review/evidence record" }` **only after that check has been performed**.
- `resolutions`: one `{ "blocker": "exact existing blocker text", "resolution": "actual resolution/evidence" }` for every blocker in the imported bundle. Missing/blank/duplicate resolutions fail.

These human attestations are required input, not generated defaults. The software checks structure and consistency, not the truth of a religious or licensing judgment.

### 2. Record review of the exact revision

```sh
npm run sermon:workflow -- review \
  --source .sermon-review/first-sermon-approved.txt \
  --bundle .sermon-review/first-sermon-r1.bundle.json \
  --candidate .sermon-review/publication-candidate.json \
  --checks .sermon-review/publication-checks.json \
  --out .sermon-review/reviewed-r1.json
```

This verifies the source/bundle round trip, exact candidate body, identities, confirmations and blocker resolutions. It binds source, bundle, candidate and current public catalog hashes. It remains a draft review record; approval performs the full existing publication validator. Inspect the saved private record and note the printed SHA-256.

### 3. Explicitly approve that reviewed revision

```sh
npm run sermon:workflow -- approve \
  --input .sermon-review/reviewed-r1.json \
  --confirm-sha256 REVIEWED_SHA256 \
  --out .sermon-review/approved-r1.json
```

Replace `REVIEWED_SHA256` with the exact hash printed by the review command, after checking its content. Approval records the reviewer, exact revisions, actual approval time, content digests and history seals, then runs `validateCatalog` with all existing rights/reference/study/date gates. Incomplete content fails even if every human-confirmation field says true. No public catalog file is written.

### 4. Prepare the private publication artifact

```sh
npm run sermon:workflow -- prepare \
  --input .sermon-review/approved-r1.json \
  --out .sermon-review/prepared-r1.json
```

This revalidates approval/history and the unchanged public baseline. Review the exact sermon/study pair, source attribution, public-safe metadata, dates, references, history and expected reading/printing/offline behavior. It does not enable any route. Record the prepared SHA-256.

### 5. Separately authorize public disclosure

```sh
npm run sermon:workflow -- authorize-publication \
  --input .sermon-review/prepared-r1.json \
  --confirm-sha256 PREPARED_SHA256 \
  --publisher PUBLIC_SAFE_PUBLISHER_ID \
  --out .sermon-review/publication-authorized-r1.json
```

This requires a new explicit action and exact prepared hash. The output's `catalog` contains only public-shaped content and retained history; the surrounding authorization metadata remains private. It still does not copy content into Git, build, merge or deploy. Any public baseline change requires review again. Files are created exclusively (`wx`, mode `0600`) and cannot be overwritten by the CLI. Keep prior records as immutable review history. Hashes catch accidental/unchecked modification; they are not digital signatures or identity authentication, and a trusted filesystem maintainer could rewrite both data and hashes.

### 6. Make the separately authorized public-content change

Only after explicit owner authorization to disclose the approved content, transfer the authorized artifact's **`catalog` only** into the typed export in `src/content/sermons.ts`, retaining all existing records/history. Do not copy the artifact wrapper, source/bundle, checks or review notes. Do not import `.sermon-review/` from public code. A public Git commit discloses its contents immediately even if the website's `publishAt` is later; keep embargoed material private until disclosure is authorized.

As part of that same reviewed content change, replace the Task 11–15 assertions that the production sermon/study arrays are empty with assertions for the exact newly authorized revisions. Adapt the local private-source leakage check only for the exact approved and publication-authorized content, retaining checks against all remaining drafts, private markers, preview routes and synthetic data. Run `npm run verify`, inspect the built detail/study links and versioned offline artifacts, and perform real-device reader/print checks. Do not weaken content digests, reference/rights validation, history seals or date gates.

Finally, commit/push the separately authorized content change for review. Merge to `main` and GitHub Pages release require their own explicit authorization; no command above performs them. The static site only includes records whose approved publication instant has arrived at build time. No scheduler is enabled. Task 15 stops before any real review, approval, authorization or public-content change.

## Task 16 — visible local preview and review status

The normal local preview now includes a sticky, wrapping toolbar above the title and body. It has labelled increase/decrease, reset and device/light/dark controls; opening imam mode is no longer required to discover them. Both interfaces share the existing 18–44 size limits and device-local preferences. The page uses a text anchor below the toolbar for font reflow, with the existing approximate fallback. Toolbar overflow on short/zoomed viewports is independently scrollable, with 44px targets, keyboard focus, safe-area spacing and forced-color support. Print excludes the toolbar and approval UI and retains the unchanged sermon and review notice.

The visible **اعتماد الخطبة** section is a read-only presentation of local workflow state, not an approval endpoint. Each loopback request validates `first-sermon-r1.bundle.json` against the original source. If present, `reviewed-r1.json` is reconstructed and checked against the source, bundle, confirmations, blocker resolutions and public baseline; a pure in-memory validation also applies the existing full approval gates. No result is saved or treated as an actual approval. `approved-r1.json`, when present, must validate against the same exact review/history before the page reports local approval. Missing, changed, symlinked or invalid records fail closed. The UI shows outstanding checks/intake blockers and never infers approval from the source filename or visual-preview permission.

Only a complete, valid, not-yet-approved review enables **اعتماد الخطبة — عرض الأمر المحلي**. This button reveals the exact `sermon:workflow approve` command and revision hash for a human to execute separately in the terminal. It performs no network request, filesystem write or approval. Reload after running an explicit command; private files are deliberately not watched. Follow the Task 15 sequence above for preparation and separate publication authorization. Browser checkboxes cannot bypass evidence validation, and approved status still does not publish anything.

`npm run validate:sermon-preview` tests the real local HTTP route and fetched client modules, in addition to `npm run verify`. It uses JSDOM with Vite HMR transport stubbed, so it detects stale HTML and initialization failures but does not establish visual layout, native browser support or real-device success. Restart the daemon after changes to integration/server rendering code; a successful unit suite cannot confirm what an already-running server is serving.

## Task 17 — proportional reader and clearer human review

The sermon title now scales with the body instead of inheriting the global viewport-based heading clamp. Both the preview article and imam reader use relative sizes: title 1.45em, khutbah heading 1.2em, subheading 1.08em, content blocks/quotations 1em. The base remains 18–44 nominal pixels, applied in rem for accessibility. Source spans, words, diacritics and paragraph ordering are untouched; no new religious markup is inferred. The reading-position fallback now includes h1/h3 as well as h2/text blocks. UI controls and the review notice retain independent sizes, and print keeps its existing light layout.

The local approval section separates seven Arabic human-review categories from the server's evidence status. Checkboxes are a session checklist only, reset on page restoration and never stored or sent. They cannot resolve source blockers or create evidence. The technical disclosure starts closed and contains the actual unresolved intake notes or validation-state warning. When a valid review has recorded all intake resolutions but a later content/history check fails, resolved intake notes are no longer falsely presented as unresolved; the UI reports that final validation is incomplete.

The button is now **عرض خطوات الاعتماد المحلي**, not a claim that clicking it approves a sermon. It stays disabled until both the exact server-validated review is ready and all session items have been checked. Unchecking an item hides the instructions again. In the current real draft, evidence remains incomplete, so checking every box still leaves the button disabled. There is no form submission or approval request. Use the Task 15 local commands for actual approval, then separate preparation/publication authorization; no real transition was performed by this task.

`PreviewReviewStatus` is the read-only presentation contract, `preview-review-markup.ts` renders it, and `preview-review-controls.ts` manages only session interaction. This separation prepares an authenticated admin adapter without adding one. A future implementation must authenticate and authorize the reviewer, revalidate exact revision/evidence on the server, record an auditable approval and independently authorize publication. Neither DOM state nor a checklist is a trusted authorization signal. Never connect this preview's button directly to a public action.

The exact-route HTTP smoke test now exercises page and imam controls, reset/focus, all-checkbox blocking, source identity and served relative CSS at 18/32/44 bases. JSDOM cannot resolve CSS-variable font sizing or provide native modal geometry, so tests explicitly supply base sizes for proportional cascade checks and stub modal methods. These tests do not establish real browser scaling, scroll geometry or native Safari behavior; manual visual/device validation remains necessary.

## Task 18 — supplied study import and local navigation

The owner supplied the exact `.sermon-review/study-001-approved.md` and explicitly granted editorial approval. Its own draft-status and final scholarly-review note are preserved verbatim; the preview adds separate UI context explaining that editorial approval is not evidence verification or publication permission. No missing quotations, references, source links or license terms have been generated.

`npm run study:import -- --editorial-approval` reads only the fixed private study source, original sermon source and `first-sermon-r1.bundle.json`. It reconstructs the existing intake, checks its source, retains the original UTF-8 Markdown and source spans, and creates `study-001-r2.bundle.json` with exclusive creation and mode 0600. The explicit flag records the owner's Task 18 editorial instruction; the filename alone grants nothing. The new private study r2 supersedes the partial private study r1 and binds the unchanged sermon r1 by ID/revision/source hash. The old pair is not overwritten. Approval stays `draft`, publication time is null, reference checks remain unverified and rights remain pending.

Only dev middleware can render `/nur-und-huda/_review/first-study`. Every request validates the artifact against both current sources and the original intake; missing files, symlinks, mismatched revisions, changed content or altered metadata fail closed. The sermon page offers **اقرأ الموضوع كاملاً** only for a valid present import. Study navigation returns to the sermon. Both use loopback-only access, no-store/no-index headers, direct-private-file denial and no POST actions. The study shares local font/theme controls, bounded responsive reading width, wrapping text/lists and print styling. The limited Markdown renderer preserves headings, paragraphs, bold emphasis, ordered/unordered lists and the divider; arbitrary HTML is escaped and no URLs are invented or activated. Raw source/structure stays recoverable from the immutable local record.

The local review panel reports study presence and editorial-only revision separately from evidence status. Historical intake blockers remain labelled as recorded notes pending explicit human reconciliation; adding a study neither deletes them nor silently checks the evidence checklist. The private r2 record is deliberately **not** a public `StudyRevision`. Task 18 retained the original r1-bound CLI; Task 19 below adds explicit source/revision binding for r2. Without those explicit study inputs, substitution is still rejected. Do not relabel the partial r1, rewrite its history, or copy this private artifact directly into public content. Actual approval, preparation, disclosure authorization and release remain separate gates.

At Task 18 completion, the book edition/page locators, explanatory attribution, Quran/Hadith comparison and rights evidence remained outstanding. Task 19's [evidence report](PUBLICATION_READINESS.md) records the subsequent source comparison and rights findings without treating them as formal human verification. The study itself requests final wording/reference review. Its material remains unchanged while mandatory checks are pending. Publication and Friday dates are not assigned by this import.

Production verification now compares built content against both private source files when available and rejects the study marker/path/source filename. CI without private files still tests synthetic imports, exact structure, forbidden production routes, access guards, immutable writes and changed-source rejection. HTTP smoke checks use the real local files and execute served reader modules in JSDOM, not a visual browser.

## Task 19 — explicit r1/r2 preparation and review

**Current state: blocked preparation only. Do not approve or publish the real pair yet.** The owner's editorial decision is separate from source/rights verification, formal approval and authorization to disclose publicly. [PUBLICATION_READINESS.md](PUBLICATION_READINESS.md) records the exact source hashes, evidence findings and unresolved checks. No Friday or publication instant is supplied.

The one-time command below requires the existing private sources and imports. It records the explicit Task 19 editorial instruction for the exact pair, with the actual machine recording time and no invented owner signature/time:

```sh
npm run sermon:prepare-pair -- --owner-editorial-approval
```

It exclusively creates `.sermon-review/publication-preparation-r1-r2.json` (mode 0600); an existing file is not overwritten. Its `.candidate` contains the mapped public-shaped text, but dates/duration are null, rights pending, references empty and both approvals draft. It is deliberately invalid for public publication. It does not create `reviewed-r1.json`, `approved-r1.json` or a public artifact. Do not relabel this wrapper as an approved record.

Once the owner has resolved the report's mandatory checks, copy only that `.candidate` into a new private `publication-candidate.json`, retaining the exact wording/ordering. Complete metadata with genuine reference verification, rights attribution, duration and explicitly selected dates. Confirm the study's retained review notes with the owner; changing wording requires a new source/revision. Supply the actual human confirmations and individual historical blocker resolutions described in Task 15. Never generate positive attestations just to satisfy validation.

For sermon r1 and the supplied study r2, replace the Task 15 review invocation with:

```sh
npm run sermon:workflow -- review \
  --source .sermon-review/first-sermon-approved.txt \
  --bundle .sermon-review/first-sermon-r1.bundle.json \
  --study-source .sermon-review/study-001-approved.md \
  --study-bundle .sermon-review/study-001-r2.bundle.json \
  --candidate .sermon-review/publication-candidate.json \
  --checks .sermon-review/publication-checks.json \
  --out .sermon-review/reviewed-r1.json
```

The two study flags are required together and accepted only for `review`. The review checks the current original sermon, original intake and exact r2 source/import. Its private seal includes study provenance. Wording, block order/type, title or link mismatches fail; verified citation metadata can be added without changing supplied text. The local preview also revalidates both current sources before reporting review readiness. Missing/changed study input blocks readiness rather than trusting a stale record.

After a genuine successful review, perform the existing Task 15 steps **3–6** separately: approve the exact reviewed hash, prepare a private artifact, explicitly authorize the prepared hash for disclosure, and only then make an independently authorized public catalog change. Those commands retain the original history, rights, reference, date and revision gates. The final authorized `.catalog` excludes private provenance and review wrappers. A Git commit of real content is disclosure even before its publication date. No step automatically commits, merges, deploys or activates a scheduler.

## Task 20 — content confirmation without scheduling

Content review and approval can precede choosing a Friday. They do not satisfy the later release approval automatically. The existing `sermon:workflow` remains the release workflow, including actual duration review, exact publication instants, Friday, reference/rights metadata, history and separate disclosure authorization. Neither its validators nor the preview's release-readiness controls have been weakened.

The new private `ContentEvidence` model in `src/lib/sermons/content-review.ts` binds the exact two source hashes and an evidence-report hash. It requires substantive findings and exact locations for Quran, Hadith, book, rights, consistency and context. `checked` means the recorded comparison/assessment is complete; it does not invent a human signature. `unresolved` blocks formal confirmation. See [CONTENT_EVIDENCE_REVIEW.md](CONTENT_EVIDENCE_REVIEW.md) for this pair's actual evidence, not generic licensing prerequisites.

The initial private files are `task20-content-evidence.json` and `task20-content-report.md`. They contain genuine findings with unresolved provenance/context left explicit. To prepare a content review, using **filenames within `.sermon-review/`**:

```sh
npm run sermon:content-review -- prepare \
  --owner-editorial-approval \
  --evidence task20-content-evidence.json \
  --report task20-content-report.md \
  --out task20-content-review.json
```

This records the existing editorial decision, original revision/bundle hashes and a reproducible duration estimate. It records the current machine event time while leaving the owner editorial approval time null. It never invents a reviewer, human timing or Friday. Existing files are not overwritten; after new evidence, create new evidence/report filenames and a new review output, retaining prior records. The initial review is blocked while the owner factual/provenance question remains unanswered.

When all substantive findings are resolved, the state becomes `awaiting-owner-content-confirmation`. The owner/reviewer must read the report and exact pair, then separately execute:

```sh
npm run sermon:content-review -- confirm \
  --evidence RESOLVED_EVIDENCE_FILENAME.json \
  --report RESOLVED_REPORT_FILENAME.md \
  --input READY_REVIEW_FILENAME.json \
  --confirm-sha256 EXACT_READY_REVIEW_HASH \
  --reviewer REAL_PUBLIC_SAFE_REVIEWER_ID \
  --attestation 'ACTUAL HUMAN CONTENT REVIEW AND RIGHTS-SCOPE CONFIRMATION' \
  --out content-approved-r1-r2.json
```

These capitalized arguments describe required real input; they are not supplied attestations. The command rereads current private originals/imports and evidence, reconstructs the review, checks its exact seal and rejects stale sources, incomplete findings, missing reviewer/attestation or reversed chronology. Only an actual explicit invocation records the real confirmation time. Files use exclusive creation and mode 0600. There is no browser endpoint, network request or public output.

The result is `content-approved-only`, with no public `.catalog`, null Friday/publication dates and `publicationAuthorized: false`. It cannot be passed to `sermon:workflow prepare` as a publication approval. Later, enter actual duration/scheduling and public-safe source metadata into the existing candidate, use the Task 19 r1/r2 review flags, and carry out the separate release approval and disclosure steps. Reuse the evidence honestly without treating a word-count estimate as human timing. Any changed wording requires a new immutable revision and review. The local preview continues to report release readiness separately; a content-only confirmation does not turn its publication controls on.

## Task 21 — owner confirmations and ready content review

The owner explicitly confirmed the prayer-room history and intended weekly series/website, and that the pair was prepared for this project with no undisclosed copied passages **to the owner's knowledge** beyond the identified quotations/definitions. These are owner factual statements, not an invented reviewer signature, independent proof of authorship or unlimited reuse permission. They resolve the requested `context` and `rights` provenance evidence; the existing source comparisons and quotation-scope assessment remain unchanged.

New ignored files retain the original Task 20 packet rather than modifying it:

- `task21-owner-confirmations.json`: exact factual statements, original source/revision bindings and prior review hash. Its machine recording time is not an inferred owner approval time; signature and owner confirmation timestamp remain null.
- `task21-content-report.md`: current addendum, embedded confirmation record and unchanged historical Task 20 research snapshot.
- `task21-content-evidence.json`: updated findings bound to that report and the exact original sources.
- `task21-content-review.json`: immutable ready packet, state `awaiting-owner-content-confirmation`, with no content-evidence blockers and no formal approval.

**Hash to confirm:** `f226b719eac55727f301cdf4938949f6815c73685b6f09409935d25e9a3463f8`.

This is the ready review hash, not the hash of an executed approval. The final approval record cannot exist until the owner explicitly confirms with their real reviewer identifier; its approval time will be the actual execution time. No backdated time, reviewer identity or signature has been supplied.

After reading the exact private pair and `task21-content-report.md`, the owner may run the following from the repository root. It prompts for the real reviewer identifier; the attestation is made only by deliberately executing this command. **Task 21 did not execute it.**

```sh
printf 'Your reviewer identifier: '
IFS= read -r reviewer_id
npm run sermon:content-review -- confirm \
  --evidence task21-content-evidence.json \
  --report task21-content-report.md \
  --input task21-content-review.json \
  --confirm-sha256 f226b719eac55727f301cdf4938949f6815c73685b6f09409935d25e9a3463f8 \
  --reviewer "$reviewer_id" \
  --attestation 'I have reviewed sermon r1, study r2 and the Task 21 evidence report. I approve this exact pair for content only and accept the documented findings and limited-quotation scope. I do not authorize public publication.' \
  --out content-approved-r1-r2.json
```

The CLI rereads/revalidates the current private sources, imports, evidence and report, rejects a changed seal or incomplete evidence, and writes the private output exclusively. It does not create a public catalog or publication artifact. No Friday or publication timestamp is required for content confirmation. Rehearsal, scheduling, time-dependent wording and separate public-disclosure authorization remain later release decisions. Keep all these private files out of Git; copying the command does not execute it or approve anything.

## Task 23 — scheduled pair with corrected content approval

The owner subsequently performed content-only approval; Task 22 retained that original record and corrected only its reviewer identifier in a separate private v2 record. Task 23 validates both canonical seals, the original byte hash, the current source/evidence-bound review, the correction chain and unchanged attestation. It does not reinterpret the corrected content approval as release/disclosure authorization.

`sermon:schedule` now prepares the exact pair for Friday 2026-11-06, 08:00 Europe/Berlin / 07:00 UTC. Both public-shaped records share the same instant; their release approvals remain draft, and human duration remains unset. The original Arabic sources/imports and both approval versions are unchanged. The private candidate adds source/citation metadata drawn from the owner-accepted evidence without rewriting body text. [SCHEDULED_RELEASE.md](SCHEDULED_RELEASE.md) records the sealed private preparations, exact commands and outstanding release steps.

The publication manifest now reports identities/times for **already released pairs only**, alongside their paths. Actual synthetic Astro builds verify that embargoed text/pages/downloads/metadata are absent before release, available at the boundary and removed on a subsequent pre-release rebuild. `sermon:release-check` is a deployment prerequisite, not authorization: it uses the real system clock, requires a fresh post-boundary manifest matching the validated catalog, checks both exact revision times and confirms output paths. Never override the clock to prebuild a real future release; never commit its text or upload content-bearing artifacts before authorized disclosure and the embargo boundary.

The release remains inactive. Existing human duration and final release-approval requirements are preserved. At activation, use the existing r1/r2 publication review/approval workflow with the supplied real duration and exact candidate; then separately authorize disclosure, the public catalog change, merge and deployment. The source-exclusion assertions are intentionally still strict until that later exact-authorized-content change. No workflow, cron, backend or scheduled deployment is created here.

## Private sermon-only release with an explicitly withheld study

The private group may now publish a separately approved sermon while its study is
withheld **only when the owner explicitly authorizes both that scope and private
publication**. The anonymous/public catalog still requires an approved sermon/study
pair; none of its approval or embargo gates have changed.

`src/lib/sermons/private-standalone.ts` separates source/evidence review, exact-hash
content approval, and publication authorization. It uses the existing UTF-8 intake,
canonical workflow hashing and immutable revision seals. Original preambles, plain
khutbah headings, supplied sitting directions and all body wording are preserved.
Historical imports retain their original shape and hashes. Estimated duration is
not represented as human timing.

The server-only loader explicitly allows the local `second-sermon-merged-*` packet:
source, intake bundle, evidence report, reviewed candidate, content approval and
publication authorization. It reconstructs every transition and verifies source and
report digests before appending the sermon to the independently verified first
release. The owner's merged roadmap is bound into this private review, leaving the
first release's historical baseline and records unchanged. A missing or changed
packet fails the private build; files are never discovered and approved implicitly.
These files remain ignored and must never be staged or uploaded as review artifacts.

An intentionally withheld study is represented as `null`, not as an empty approved
article. Its routes, links, metadata and downloads are absent. Normal sermon reading,
imam controls, printing and the approved offline sermon remain available behind the
private gateway. The dated eight-week calendar remains separate from the editorial
roadmap, which reflects the merged lesson.

Run `npm run verify`, then `npm run private:prepare -- --approved-sermon` and
`npm run private:check` sequentially. The prepared bundle is server-only. Run the
private emulator in Chromium and WebKit; it now checks exact additional-sermon text,
normal navigation, proportional reader scaling, themes, print invocation and offline
access at 320/390/768/1440px. `backend/tests/standalone-sermon-browser.mjs` also supports
read-only verification in an already authorized production browser. Physical devices
and printer output are not implied by these browser checks.

Deploy only the existing `privateSite` function after those gates pass. Do not upload
the site as public Hosting files or GitHub Pages output. Verify authenticated served
bytes, unauthenticated protection, the first pair and the withheld-study 404 after
deployment. Content hashes identify bytes; they are not cryptographic human signatures.
