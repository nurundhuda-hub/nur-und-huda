# Local mosque timetable review

Task 09 · Checked 2026-10-29 · `codex/audit-and-rebuild`

**Decision:** a verified local mosque timetable is the primary source, provisionally As-Salam Moschee Hamm. Independent Adhan calculations are comparison/diagnostics only, never a replacement or public fallback. Production `prayerData` remains `null`.

**Blocked on source verification and authorization:** an official Mawaqit platform listing was found, but no authorized, dated mosque export or publisher-confirmed time semantics were obtained. The current mosque address and ownership of the listing still need operator confirmation. **Zero real local-mosque rows were imported.** Summer/Ramadan mosque comparisons cannot be performed yet. Importer development and synthetic software tests are complete; neither grants permission nor religious approval.

## Identity and timetable investigation

| Evidence                                                                                                                      | Finding                                                                                                                                             | Verification limit                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Official Mawaqit listing](https://mawaqit.net/de/essalam-hamm)                                                               | Displays مسجد السلام As-Salam Moschee — Hamm, ID **5627**, and **Marokkanischer Verein As Salam e.V**. Separate Adhan and Iqama labels are present. | Confirms what the platform listing says. The accessible page did not provide a verifiable dated five-prayer export or street address. It does not establish the operator's current control, timetable year, column meanings or reuse permission. |
| [Cylex address listing](https://web2.cylex.de/firma-home/as-salam-moschee-hamm-16418251.html)                                 | Gives **Spenglerstraße 1, 59067 Hamm**.                                                                                                             | Secondary directory evidence only; address is provisional, not a verified mosque statement.                                                                                                                                                      |
| [Mosquee-proche listing](https://www.mosquee-proche.com/mosquee/essalam-hamm/1472/)                                           | Names the same association and address and displays timetable/iqama content.                                                                        | Third-party mirror, not accepted as an authorized source. Its “verified” label is not our verification. No times or iqama offsets were copied.                                                                                                   |
| [Local newspaper report](https://www.wa.de/hamm/marokko-gegen-frankreich-imam-ruft-zum-gebet-auch-bei-elfmeter-94389295.html) | Refers to As-Salam at Lange Straße.                                                                                                                 | This is an unresolved address-description difference, not evidence of a confirmed relocation. No street number or mosque-authorized correction was established.                                                                                  |

Do not confuse Hamm in North Rhine-Westphalia with Hamburg-Hamm, or another As-Salam mosque. No verified mosque-owned website with a downloadable timetable was established in this research. No private endpoints, embedded configuration extraction, provider scraping, third-party API libraries or account access were used. No mosque/support messages were sent.

## Meaning of the times and official acquisition path

Prayer entry, adhan and iqama are distinct facts. The Mawaqit page has separate labels, but these labels alone cannot identify the semantics of an unseen export. A mosque's call may coincide with entry or be delayed. Its iqama is a congregational arrangement and cannot be treated as the beginning of the prayer window. Imsak is not automatically Fajr; sunrise is not one of the five prayers. The mosque must confirm each exported column, summer policy and any Ramadan exceptions. Friday Dhuhr must remain the daily Dhuhr entry; do not substitute Jumu'a.

[Mawaqit's official download instructions](https://help.mawaqit.net/en/articles/8999582-how-to-download-the-prayer-times-of-my-mosque) describe administrator Actions → timetable → CSV/PDF, optional iqama in PDF, and calendar downloads in the mobile app, including Hijri-month/Ramadan exports. This is the appropriate acquisition route for the mosque/operator. No authorized export was provided to this project. Documentation about downloading/sharing a calendar is not evidence of the scope granted for this hospital website's copying, transformation, public hosting or renewal.

[Mawaqit's API answer](https://help.mawaqit.net/fr/articles/11991838-puis-je-utiliser-votre-api) says its API is private and offers support-mediated integration options. It does not authorize undocumented endpoints or scraping. If an official iframe is later considered, obtain its mosque-specific details and review the privacy/terms separately. This task adds no widget.

The operator should obtain a publisher-provided CSV/JSON (or an authorized original plus a checked manual transcription), current mosque identity/address confirmation, definitions of entry/adhan/iqama, calendar year/timezone and explicit reuse terms. Request the exact permission scope needed: private comparison/import first; later public display and redistribution separately. Record attribution, restrictions, covered revisions/dates, corrections/revocation channel and validity/renewal. Do not infer permission from public accessibility, non-commercial use or a displayed logo.

## Source and permission register

[validation/local-source-permissions.json](validation/local-source-permissions.json) is the machine-readable evidence register. It records candidate identity, official platform URL/ID, provisional address, acquisition channels and blockers. Current authorization and approval fields are empty/pending, and `authorizedSampleCount` is zero. It is **not** an import manifest or permission grant.

Existing Diyanet/VEZ NRW samples remain attributed research comparisons from Task 08. They are not As-Salam times and cannot be relabeled or used to fill missing local rows. No blanket full-calendar redistribution license was established for those sources. Adhan's MIT code license permits software use under its notice; it grants neither authority over mosque data nor approval for a prayer method. See [PRAYER_TIMES_VALIDATION.md](PRAYER_TIMES_VALIDATION.md) for those sources and limitations.

## Importer contract

`src/lib/local-timetable/importer.ts` exposes `TimetableManifest`, `TimetableReview` and `importTimetable(bytes, manifest, options)`. It is an offline Node/TypeScript tool, absent from the public page bundle. It does not fetch, repair missing dates, calculate replacements, round source times or infer approvals. The CLI has no test-fixture bypass option.

The manifest binds a local file's exact SHA-256 to a source ID, publisher, mosque, address, revision, issue/acquisition instants, verified identity evidence, declared time meaning and scoped permission evidence. Valid scopes are `local-review` (required) and `public-display` (optional and never implied). Grant/verification/acquisition timestamps cannot be in the future; permission must be valid at import and cover the declared timetable validity window. Expired timetables may still be examined as historical diagnostics if permission is current. They are explicitly marked stale.

These records are human attestations. Software validates their structure, scope, dates and checksum; it cannot authenticate a letter, verify a signatory's authority, check revocations online or turn typed “granted” into legal permission. Keep original permission records securely outside public output, using evidence references and public-safe identifiers in review files. Do not put private contact details or credentials in the repository.

The importer requires:

- Schema version 1, `Europe/Berlin`, and a documented `prayer-entry` or `adhan` meaning. Unknown, mixed or iqama semantics are rejected. An imported adhan label remains adhan; it is not certified as entry time.
- Exactly one row per civil date across the declared inclusive range, 1–370 consecutive dates. Duplicate, missing, out-of-range and impossible dates fail. Valid leap days and year boundaries work. Unsorted rows are sorted without changing their values.
- Exactly five named prayers per row. Unknown columns/keys, including mosque Friday/iqama/sunrise fields, fail rather than being silently ignored. Map publisher columns explicitly in a separately reviewed normalization step.
- Strictly increasing absolute instants, correct Berlin civil dates, and Isha before the following supplied Fajr. Only Isha may belong to the following day. Missing coverage never invokes Adhan.
- A declared validity window inside date coverage and permission expiry. Include adjacent dates for next-prayer continuity; set the intended live validity window inside that padded coverage. Imported output has an explicit future/current/stale indicator but always pending approval.
- UTF-8 input, 1 byte–2 MiB. Metadata dates use UTC `YYYY-MM-DDTHH:mm:ssZ`. Empty fields, formulas, invalid offsets, nonexistent wall times and ambiguous unqualified DST times fail.

### Canonical file formats

CSV must have exactly this comma-separated header, in order:

```csv
date,fajr,dhuhr,asr,maghrib,isha
```

Use full Gregorian `YYYY-MM-DD` dates. Quoted cells, UTF-8 BOM, LF and CRLF are supported. Semicolon-delimited files, translated headers, yearless dates and additional columns require explicit, checked normalization first; there is no guessed Mawaqit export schema. No real export was available to certify a provider-specific mapping. Preserve the authorized original, record its hash and normalization decisions, and verify the resulting canonical file row-by-row or against a publisher-approved mapping. Bind the canonical file hash in the manifest and retain both hashes in the approval record.

JSON uses an array of objects with exactly `date` and `times`; `times` has exactly `fajr`, `dhuhr`, `asr`, `maghrib`, `isha`, all strings. JSON and CSV have the same validation rules. No prefilled mosque records are included.

Time cells accept:

- `HH:mm`, interpreted on that row's Berlin date.
- `HH:mm+1`, only for an explicitly publisher-confirmed after-midnight Isha. The importer never guesses next-day intent from an earlier-looking clock time.
- A full ISO timestamp with seconds and `Z` or an explicit **correct Berlin offset**. This resolves the repeated autumn hour without guessing. A spring-gap local timestamp or wrong seasonal offset is rejected. UTC timestamps must still land on the allowed Berlin date.

The source keeps its precision; output is normalized to UTC ISO instants, with no prayer adjustments. Leap seconds and `24:00` are not supported; resolve such source conventions with the publisher before normalization. The existing calendar adapter supports years 1900–2199.

### Entering an authorized file

1. Resolve the blockers first. Put the original authorized export and supporting private evidence outside public assets, for example in ignored `.prayer-review/`. Do not copy the web listing, mirror data or Task 08 calculations into a mosque file.
2. Copy [validation/local-manifest.template.json](validation/local-manifest.template.json) into that review directory. It deliberately has pending/blank fields and **cannot pass validation**. Fill fields from actual evidence; use a unique source revision. Set identity to verified and permission to granted only after obtaining that evidence. Record exact time semantics, attribution, restrictions, permission dates/scopes, coverage and validity. If no restrictions apply, state that only when confirmed.
3. Hash the authorized canonical input, for example with `shasum -a 256 .prayer-review/authorized.csv`, and enter the digest as `input.sha256`. Retain the original export hash and transformation record as supporting evidence. Select `input.format` as `csv` or `json`.
4. Run:

```sh
npm run timetable:import -- \
  --input .prayer-review/authorized.csv \
  --manifest .prayer-review/authorized-manifest.json \
  --out .prayer-review/local-review.json \
  --compare-settings validation/settings.example.json
```

The example paths name files the operator must supply; no such authorized files were created in this task. `--compare-settings` is optional and uses only a diagnostic candidate. Output must be a new file directly under `.prayer-review/`; overwrites and a symlinked review directory are rejected. The artifact includes original manifest, normalized UTC rows/checksum, import instant, pending approval, freshness and optional comparisons. It has `purpose: 'review-only'`, a conspicuous review marker, and `hospitalFriday: null`; it is not a `PrayerCardData` payload and the production validator rejects it.

## Comparison status and unresolved discrepancies

| Required comparison                               | Current result                                                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Authorized As-Salam ↔ Diyanet Hamm across seasons | **Not performed: no authorized local file.**                                                                     |
| Authorized As-Salam ↔ Adhan diagnostics           | **Not performed: no authorized local file.**                                                                     |
| Ramadan Fajr and Maghrib/iftar                    | **Blocked:** obtain source dates, exact column meaning and Ramadan exceptions.                                   |
| Summer Fajr/Isha and after-midnight convention    | **Blocked:** obtain complete summer coverage and publisher policy.                                               |
| Mosque location → hospital applicability          | **Unresolved:** current address and local adoption need confirmation; do not shift source times algorithmically. |
| Acceptable tolerance                              | **Not defined.** No numerical acceptance rule is invented.                                                       |

The comparison module reports signed **local minus reference**, **calculated minus local**, and **calculated minus reference** minute differences on matching dates. It keeps reference source/context and the local source revision/hash/time semantics. Missing matches are explicit; no date interpolation or nearest-date comparison occurs. The existing twelve Task 08 samples include Diyanet and separately labeled VEZ NRW Ramadan references. Coverage gaps are listed. A failed calculation is recorded as an error with null diagnostic differences, never used to alter imported times. `acceptableTolerance` stays `null`; `assessment` stays `human-review-required`.

Adhan comparison settings still use the provisional hospital map center. They do not represent confirmed mosque coordinates or the mosque's method. Any difference may involve location, entry-versus-adhan meaning, source policy, offsets, rounding or seasonal handling. Task 08's reported discrepancies remain calculation-to-reference findings; **none is an As-Salam discrepancy**. Synthetic tests of signed differences are software checks only.

Once authorized samples are available, compare the same dates across winter/spring/summer/autumn, both DST boundaries and publisher-confirmed Ramadan dates, separately reviewing Fajr, Maghrib and Isha. The present reference set lacks an autumn DST pair and full-year coverage: obtain authorized matching references before claiming that comparison complete. Document each unresolved result and the responsible human decision. Matching values do not confer approval.

## Human approval checklist — currently entirely pending

- [ ] Confirm mosque identity, current location, operator and official timetable URL/ID; record evidence and who checked it.
- [ ] Confirm timetable year/revision, five daily columns, entry/adhan meaning, DST and midnight conventions, summer/Ramadan policies and applicability to the hospital. Do not equate adhan with entry without confirmation.
- [ ] Record permission grantor/authority, evidence reference, covered file/revision, local-review and public-display scopes, attribution, restrictions, grant date, expiry and correction/revocation process. Public-display permission is separately required for activation.
- [ ] Preserve original/canonical file hashes, mapping record, normalized output hash and exact coverage. Check no gaps or duplicates, both DST transitions and adjacent-day Isha/Fajr ordering.
- [ ] Complete authorized seasonal/Ramadan comparisons, record unresolved differences and the religious reviewer's acceptance decisions. Do not derive a tolerance from software tests.
- [ ] Record the exact **source ID, revision, reviewer, approval date/time and expiry**, plus the evidence/results approved. A changed file or revision needs a new review; permission is distinct from religious/data approval.
- [ ] Establish freshness/renewal ownership and expiry behavior. A static release must be renewed before coverage/permission expires; unavailable is the fallback.
- [ ] Review **hospital Friday sermon and iqama independently** with their own source, revision, reviewer and expiry. Never import mosque Jumu'a/iqama as hospital settings or infer them from Dhuhr.
- [ ] Obtain separate authorization for any future public activation/release. This task does not provide an approve/publish command, change the no-active-payload gate, merge main or deploy.

Stop at this gate. The deliverable is a tested importer and a documented evidence gap, not an approved local timetable. See [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) for the exact verification result. No homepage design/logo change or new browser rendering claim is included.
