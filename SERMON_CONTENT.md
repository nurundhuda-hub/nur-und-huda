# Friday sermon content and release contract

Task 11 · 2026-10-30 · Public catalog currently empty.

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

Each sermon/study has a stable slug, `r1`/`r2`… revision, title, edit/publication UTC instants, human approval, rights confirmation/attribution and verified reference records. The sermon adds its actual Friday date, exactly two nonempty khutbah parts, a human-reviewed duration estimate and an exact study ID/revision. The target is approximately ten minutes in total. Software does not invent a reading-speed estimate, acceptable duration range or religious judgment: the reviewer must read it aloud and record minutes, reviewer, date and a note explaining acceptance.

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

Screen wake-lock is opt-in through a button. It requires browser support and a secure context, can be refused/released by the browser or operating system, pauses while hidden and releases on close/pagehide/cleanup. A late asynchronous grant after closing is released immediately. An opted-in open session may reacquire after visibility/pageshow; failure leaves reading/printing usable. See the [Screen Wake Lock API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API). No camera, microphone, tracking, notifications or persistent preferences are added.

Print actions use the browser's print dialog. Print CSS hides reader controls, duplicated modal content and navigation, retaining the two-part article, metadata and references. The offline file has its own print rules. DOM tests verify structure and style rules; they do not establish pagination, native modal behavior, real-device wake locks or printer output.

## Scheduled publishing boundary

`publishAt` is the exact approved earliest publication instant in UTC; the public page labels it as the specified publication time. Dates for the eight-week schedule are derived in `Europe/Berlin`. The Node CLI wrapper establishes one `SERMON_BUILD_AT` for the whole build. Future public build clocks are rejected; an explicitly earlier clock can reproduce a prior snapshot. At the cutoff, eligible approved records and studies generate static pages. A draft never becomes eligible just because its date passes.

**No scheduler is activated.** A running static site will not publish content or refresh the eight-week calendar merely as time passes. A later authorized build/release is required. The desired approximately seven-day lead time is an editorial decision, not an enabled cron job or an invented automatic date. The manifest records build time, not the actual deployment timestamp. Restart a long-running dev server to advance its startup snapshot. [Astro static routing](https://docs.astro.build/en/guides/routing/) and [static endpoints](https://docs.astro.build/en/guides/endpoints/) supply the route generation.

## Entering the first real approved content

1. Keep drafts, AI-assisted preparation and private reviewer evidence outside the public repository. Obtain the genuine sermon, study and source/license evidence; do not use test fixtures as templates for religious text.
2. Prepare typed records for both parts and the extended study. Verify all quotations and locators, permissions/attribution, actual Friday date, duration and intended release instants. Use public-safe reviewer identifiers.
3. The responsible human explicitly approves each exact revision. Compute `contentDigest(record)` for that reviewed content, enter the matching approval fields, then compute `revisionSeal(record)` and append its history entry. These helpers only calculate hashes; they do not make the approval decision. Approve an announcement separately if a planned title should appear before the full release.
4. Add only reviewed records/history to `src/content/sermons.ts`. In this Task 11 snapshot, a test deliberately asserts the production catalog is empty. Replace that specific no-content assertion in the separately authorized content-entry change, retaining all approval, embargo, history, link and synthetic-data leak checks.
5. Run `npm run verify`. Inspect every generated route, revision link, study citation, reading mode, printable page and offline file with the actual approved Arabic content on target devices. Review the manifest and all staged changes before a separately authorized release.

Stop at human content approval in this task. No real sermon, study, approved announcement, calendar assignment, download or review identity has been invented or activated.
