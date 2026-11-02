# Task 20 — content evidence review, sermon r1 / study r2

**Current release status (Task 23):** The owner has since performed content-only approval, with a separate reviewer correction retained in private v2 history. That exact approval is validated for scheduled preparation. Both revisions are prepared for 2026-11-06T07:00:00Z, but final release approval, human duration and public-disclosure/deployment authorization remain outstanding. See [SCHEDULED_RELEASE.md](SCHEDULED_RELEASE.md). Earlier Task 20/21 statements below are historical snapshots.

**Task 21 update:** The owner has explicitly confirmed local context/program intentions and project provenance, preserving the qualifier “to the owner's knowledge” regarding undisclosed copying. Those two evidence gaps are resolved in a new private packet; the Task 20 snapshot below remains historical. All six content-only evidence categories are now checked. The state is **awaiting-owner-content-confirmation**, not formally approved. No scheduling, publication artifact, disclosure authorization or deployment was created. See [the exact confirmation command](SERMON_CONTENT.md#task-21--owner-confirmations-and-ready-content-review).

**Religious source comparison completed; formal human content confirmation is still pending.** No substantive mismatch was found in the cited Quran passages or the two attributed Hadith. No wording was changed. Content approval is now independent of Friday scheduling; this does not remove the existing public-release gates.

The exact original SHA-256 values remain:

- Sermon r1: `f9821148c5846d19c5cc2e89a70f286baf266807ea12ef535afdb9ee7b75f44f`.
- Study r2: `0dcfe99f50f25ab56268b1965df1be1b349aca885e60c0950419e370d09cd858`.

Locations below refer to lines of the unchanged private UTF-8 files `first-sermon-approved.txt` (S) and `study-001-approved.md` (E). Their full text, evidence packets, source archives and approval records stay in ignored `.sermon-review/`. Machine research findings are not fabricated human signatures or theological certification.

## Quran: official reference and exact locations

Compared all six distinct passages with the King Fahd Complex's [official developer source](https://qurancomplex.gov.sa/quran-dev/) and its linked [Hafs archive](https://download.qurancomplex.gov.sa/resources_dev/kfgqpc_hafs_v30.zip). Download SHA-256 `227e6b1564d980f2bd09c2c35ebfb0330ac268c79a7c247cd1ab665bc635f245` matches the publisher's displayed checksum. Comparison used `kfgqpc_hafs_v30-data/kfgqpc_hafs_v30.json`, both the Uthmani field and the publisher's unvocalized conventional-spelling search field. No official text, font or dataset is being redistributed or substituted into the drafts.

| Passage | Private locations | Official record and Medina page | Result                                                                                                                                    |
| ------- | ----------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 3:102   | S16               | id 395; p.63, lines 3–4         | Full verse; words and verse number correct.                                                                                               |
| 47:19   | S60; E14, E173    | id 4564; p.508, lines 14–15     | Opening excerpt ending at the personal forgiveness clause, before the clause concerning believers. Correct number and continuous excerpt. |
| 20:114  | S82               | id 2462; p.320, lines 1–2       | Final four-word supplication; correct number and excerpt.                                                                                 |
| 51:56   | E36, E173         | id 4731; p.523, lines 3–4       | Full verse; words and number correct.                                                                                                     |
| 16:36   | E94, E173         | id 1937; p.271, lines 4–7       | Opening through the command to shun taghut; correct continuous excerpt, not the full verse.                                               |
| 7:158   | E115, E173        | id 1112; p.170, lines 11–14     | Opening through the universal address; correct continuous excerpt, not the full verse.                                                    |

The supplied quotations use conventional spelling/vocalization, not byte-identical Uthmani text. Differences include separated vocative spelling, ordinary versus small alif, hamzat al-wasl, recitation/stop marks, and assimilation notation: e.g. the Uthmani extra assimilation shadda in 3:102, 16:36 and 20:114. Ordinary sukun in the supplied spelling does not reproduce all the Mushaf's tajwid notation. No changed word, incorrect verse number or substantive vowel error was identified in this comparison. These findings do not certify recitation performance or convert the draft to Uthmani orthography. Preserve the supplied text; identify excerpt boundaries in reference metadata.

## Hadith

| Private locations | Exact witness                                                                                                                        | Result                                                                                                                                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S48; E52, E177    | [Bukhari 8](https://sunnah.com/bukhari:8), Book 2, Hadith 1; [Muslim 16c](https://sunnah.com/muslim/1/21), Book 1, Hadith 21         | The full sermon wording follows Bukhari, including Hajj before fasting. Muslim is a parallel witness, with additional servant/messenger wording and a different pilgrimage phrase. The study deliberately quotes only the opening with ellipsis. Both collections support the attribution; do not claim identical wording in both. |
| S28; E18, E178    | [Bukhari 71](https://sunnah.com/bukhari:71), Book 3, Hadith 13; [Muslim 1037a](https://sunnah.com/muslim:1037a), Book 12, Hadith 126 | The selected sentence matches both Arabic witnesses. It is part of a longer narration, not the entire report.                                                                                                                                                                                                                      |

The study's Muslim numbers 16 and 1037 refer to the numbered narration groups; suffixes c/a identify the specific online witnesses checked. Conventional spacing, punctuation and alif typography differ without changing words. The un-attributed closing supplications are prayers, not additional claims of verbatim Prophetic narration; no invented Hadith grades/references were added.

## Book attribution, quotations and explanations

The [official catalog](https://risala.prh.gov.sa/ar/content/251) and local [publisher PDF](https://risala.prh.gov.sa/storage/contents/251/ar-ma_la_yasa-3.pdf) support the committee attribution at S30/E161. PDF SHA-256: `b5a5b89c396560f1b4d3501f80bc0f24a68972654c7f6ba0f40cda99d4e27948`. Printed pages 2–8 were visually inspected, as were supporting pages 53, 97, 113 and 123. Printed page n is PDF page n+2 (one-based).

| Private material                        | Book location                 | Classification                                                                                                                                                         |
| --------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S44; E26 and the definition subheadings | p.3, opening definition       | Close/direct definition wording, explicitly attributed in the study; not wholly independent prose.                                                                     |
| S52; E84, E88–90                        | p.5, first-testimony section  | Short traditional formula plus paraphrase of its two elements.                                                                                                         |
| S54; E108–111                           | p.7, second-testimony opening | Close short clauses, with the first two reordered and minor grammatical framing differences.                                                                           |
| E64, E68, E72, E76                      | pp.53, 97, 113, 123           | Brief explanatory summaries; fasting has close standard-definition wording. These supporting locations are review evidence, not silently inserted new draft citations. |
| E165–169 bibliography                   | pp.2–8                        | Locators correct. First-testimony discussion starts on p.5 and continues onto p.7; second-testimony starts on p.7 and continues on p.8.                                |

Remaining introductory, practical and hospital-context prose is explanatory application rather than a continuous book extract. Quran/Hadith passages are separately attributed sources, not original authorship of the modern committee. This comparison identifies overlaps, not the historical provenance of every common formula. The original study note that it is not a verbatim reproduction is accurate at article level, but must not be interpreted as denying its short direct/close passages. Its draft-status and final-review wording is preserved.

## Rights assessment

No blanket publisher reuse grant was found on the official item page or in the inspected book front matter. The copyright notice identifies جمعية خدمة المحتوى الإسلامي باللغات, 1447 AH. This absence does **not** establish that a license is required for all material citing the book.

For this German educational site, [UrhG §2](https://www.gesetze-im-internet.de/urhg/__2.html) concerns protected personal intellectual creations; [§51](https://www.gesetze-im-internet.de/urhg/__51.html) allows quotation where its extent is justified by the quotation purpose; [§63](https://www.gesetze-im-internet.de/urhg/__63.html) requires source acknowledgement. Applied here, the short attributed definition is actually explained in the study, rather than presented as a substitute for the book. That supports a limited-quotation assessment, not unrestricted republication. No arbitrary word-count safe harbor is asserted. Whether an individual traditional formula is itself protectable, and the adequacy of the final presentation, remain case-specific legal questions.

The working assessment is **limited attributed quotation plus explanatory prose, not reproduction of a protected book chapter**. Independently written explanations require no publisher license merely for citing the book. A separate full-book reuse license is not imposed as a blanket prerequisite. Owner confirmation of provenance is still needed to rule out undisclosed copied passages; any additional protected material must be assessed on its own. No scan, layout, font, PDF or modern translation is included in the public candidate. [Sunnah.com section 8](https://sunnah.com/about) also permits selected Hadith for teaching/presentation; this does not grant rights to other material. Reading an authoritative Quran source for comparison does not by itself import a dataset license obligation into independently supplied text.

## Consistency, context and duration

The exact pair is sermon r1 → study r2, lesson one of the existing series. Both introduce Islam and its pillars, lead toward the first testimony and connect knowledge to action. The sermon's four-stage program matches the existing roadmap. Hajj-before-fasting in the quoted Bukhari narration and fasting-before-Hajj in the study's teaching order are not contradictory doctrine. No substantive sermon/study contradiction was found.

Only the owner can confirm the local history at S20 and the intended weekly/website commitments at S24–38. S64's next-Friday promise must be checked again when scheduling; it is not a reason to invent a Friday now. E141 is practical hospital-context advice, not a claim of official hospital endorsement.

Reproducible estimate: **438 + 160 = 598 Arabic letter-run words** in the two body parts, excluding bracketed verse locators and Markdown delimiters. At illustrative rates of 80/100/120 words per minute, speaking time is **7.48 / 5.98 / 4.98 minutes**, respectively, before pauses, the sitting interval or recitation pacing. These are arithmetic scenarios, not empirically verified Arabic speaking rates or a human timing result. Approximately ten minutes has not been demonstrated. Actual rehearsal/acceptance remains a release-stage duration check; it does not block evidence comparison or require a date to approve content.

## Exact remaining actions

1. Owner factual confirmation: the prayer-room history/program commitments are accurate, and the non-quoted explanations were independently drafted with no undisclosed third-party copying. Until received, only `context` and `rights` provenance remain unresolved in the private content packet.
2. Owner/reviewer must inspect this evidence and explicitly confirm the exact content-review hash, accepting the findings and limited-quotation scope. Existing editorial approval is recorded, but is not silently promoted to formal approval. No human signature or approval timestamp has been invented.
3. Later, separately: rehearse and accept duration, choose Friday/publication instants, recheck time-dependent wording, complete the existing publication-candidate review, and explicitly authorize disclosure. A content-only approval has no public catalog and cannot pass the release workflow as a publication approval.

There is no requirement to obtain a new publisher license for independently written explanations merely because the source is cited. If the owner cannot confirm provenance or intends broader reproduction, that specific rights issue remains open. The site remains unpublished; no scheduling, merge, deployment or public approval endpoint is enabled.
