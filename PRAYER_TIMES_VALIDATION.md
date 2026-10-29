# Prayer times: research, validation and approval gate

Task 08 · Research date: 2026-10-29 · Branch: `codex/audit-and-rebuild`

**Status: calculation software implemented; worship guidance NOT approved.** `prayerData`, `prayerSettings` and `fridaySettings` remain `null`. The public website retains its unavailable state. No provider requests, private endpoints, embeds, backend, publication workflow or deployment have been added. Homepage markup, layout, Arabic content and original logo are unchanged.

## 1. Location and evidence

The hospital's [official imprint](https://www.barbaraklinik.de/impressum.html) identifies St. Barbara-Klinik Hamm GmbH at **Am Heessener Wald 1, 59073 Hamm**. Its [contact page](https://www.barbaraklinik.de/kontaktdatenschutz/kontaktformular.html) identifies the Hamm-Heessen site. The [official directions page](https://www.barbaraklinik.de/kontaktdatenschutz/so-erreichen-sie-uns.html) supplies an embedded map whose center parameters are latitude **51.708264177437265**, longitude **7.841347457672773**.

`src/data/prayer-settings.ts` records that point and its source as **provisional**. Those decimal places reproduce map parameters; they do not establish survey accuracy. The address is verified, but the exact prayer-room point, elevation and local horizon are not. The operator must confirm them before approval. The map is research evidence only; it is not embedded in the website and visitors make no map-provider requests.

## 2. Library choice and licenses

| Library  | Evidence checked                                                                                                                                                                                                                                                                    | Decision                                                                                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adhan JS | [Maintainer repository](https://github.com/batoulapps/adhan-js), [method documentation](https://github.com/batoulapps/adhan-js/blob/develop/METHODS.md), npm release metadata and installed package source/license. Version 4.4.6 published 2026-08-31; MIT, copyright Batoul Apps. | Pin `adhan@4.4.6`. Typed API, explicit calculation parameters, UTC result instants and no network dependency. Wrapped behind our adapter.                                           |
| PrayTime | [Official code](https://praytimes.org/docs/code), [changelog](https://praytimes.org/docs/changelog), [calculation documentation](https://praytimes.org/docs/calculation). Version 3.2.0 dated 2025-07-18; v3 changed to MIT and supports IANA timezones.                            | Credible alternative. Not installed; a second calculation engine would not resolve the missing local religious policy. Do not confuse its current license with older LGPL releases. |

Neither library provides approval for this location. Maintenance evidence is a dated check, not a promise of future maintenance. Changes to the dependency require rerunning comparisons and reviewing numerical changes. The installed Adhan MIT copyright and permission notice is copied unchanged to `dist/licenses/adhan-MIT.txt` and checked during verification. No library assets or licenses were modified.

The following parameter behavior was checked against the pinned package's `lib/esm` implementation and TypeScript declarations, rather than assuming a preset name completely describes its output.

## 3. German practice and Mawaqit

There is no verified single calculation policy shared by all German mosques. [DITIB's published explanation](https://ditib.de/detail2.php?id=424&lang=en) discusses Fajr 18° and Isha 17° and the absence of twilight signs at northern latitudes in summer. It is a historical policy explanation, not proof of the present Hamm prayer-room settings. [Moschee Al-Ummah's own prayer page](https://moschee-al-ummah.de/gebetszeiten) identifies Muslim World League 18°/17°; that mosque is in Munich, so its policy is contextual evidence, not local authorization.

[Mawaqit's explanation of differing mosque times](https://help.mawaqit.net/en/articles/9047426-why-are-prayer-times-different-from-one-mosque-to-another) describes uploaded calendars, selectable calculation methods/custom angles and Asr choices. A Mawaqit timetable can therefore reflect a mosque's own calendar and adjustments. Its presence on that service does not identify an underlying calculation method. No Hamm mosque's complete current settings or hospital-approved timetable were obtained.

[Mawaqit's official integration answer](https://help.mawaqit.net/fr/articles/11991838-puis-je-utiliser-votre-api) says its API is private and directs integrators to support for a mosque URL or horizontal/vertical iframe integration. This establishes an official integration route, not blanket permission to call undocumented endpoints or redistribute data. A future widget requires a mosque-specific official embed, confirmation of its terms and a privacy review before activation. No widget URL was guessed and no contact message was sent.

[Mawaqit's official export instructions](https://help.mawaqit.net/en/articles/8999582-how-to-download-the-prayer-times-of-my-mosque) describe calendar downloads and administrator CSV/PDF exports. An operator-provided authorized export is a suitable future comparison input. The software does not scrape Mawaqit or connect to private APIs.

## 4. Configuration and calculation contract

`src/lib/prayer-calculation/` separates configuration validation, civil-date conversion, calculation and reference comparison. `adapter.ts` emits the existing `PrayerCardData` contract with **pending** approvals. The library runs offline for review/generation; it is not imported into the current public page bundle. The existing card consumes reviewed absolute timestamps if a future activation is authorized.

| Setting                            | Behavior requiring review                                                                                                                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `location`                         | Explicit latitude/longitude, evidence URL and provisional/confirmed status; no geolocation request.                                                                                           |
| `timezone`                         | Restricted to `Europe/Berlin` for this site. UTC instants are displayed using `Intl`, including CET/CEST.                                                                                     |
| `preset`                           | Explicit Adhan method identifier. Some presets have special seasonal algorithms in addition to angles.                                                                                        |
| `fajrAngle`, `isha`                | Explicit angles, or an Isha interval in minutes after the modeled **sunset**. The interval is not anchored to adjusted Maghrib.                                                               |
| `isha.dateOverrides`               | Explicit inclusive Gregorian ranges for interval changes, with reasons. No automatic Ramadan/moonsighting assumption; overlapping ranges are rejected.                                        |
| `maghribAngle`                     | Zero uses modeled sunset; a positive angle requests the library's angle calculation. Unresolved angle calculations fail rather than silently reverting to sunset.                             |
| `madhab`                           | `shafi` uses shadow factor 1; `hanafi` uses factor 2. The operator must choose.                                                                                                               |
| `highLatitudeRule`                 | `middleofthenight`, `seventhofthenight` or `twilightangle`. These can cap otherwise calculable twilight times, not merely fill missing values. No rule is approved here.                      |
| `polarCircleResolution`            | Explicit `Unresolved`, `AqrabYaum` or `AqrabBalad`; the example fails on unresolved solar events instead of inventing a time.                                                                 |
| `shafaq`                           | General/red/white twilight policy for methods that use it. Moonsighting Committee has special seasonal handling; its behavior cannot be described by the generic high-latitude setting alone. |
| `adjustments`, `methodAdjustments` | Every Fajr, sunrise, Dhuhr, Asr, Maghrib and Isha offset is explicit, in minutes; the two sets add together. No hidden local tuning.                                                          |
| `rounding`                         | `none`, `nearest` or `up`, applied after offsets. The adapter rounds once and does not advance an already exact minute under `up`.                                                            |
| `revision` / freshness             | Revision is bound to human approval. `updatedAt`, `validFrom`, `expiresAt` are explicit UTC instants chosen by the operator; no invented freshness period.                                    |

For example, Adhan's MWL preset has a +1 minute Dhuhr method adjustment. Its Turkey preset has sunrise −7, Dhuhr +5, Asr +4 and Maghrib +7. Both use 18°/17° angles. Those presets are software behavior, not evidence that a specific mosque uses those complete settings. The example JSON exposes all offsets for review.

The solar model uses the library's fixed sunrise/sunset altitude/refraction convention. It does not accept this hospital's elevation, actual atmospheric conditions or an obstructed horizon. These physical limitations are unresolved for worship/iftar approval. Supported adapter civil dates are 1900–2199 as an engineering input boundary, not a claim of astronomical accuracy throughout that range.

Civil dates, rather than UTC day labels, select calculations. The adapter accommodates the library's host-local calendar API and tests results under four machine timezones. Berlin wall-clock inputs reject nonexistent or ambiguous DST times instead of selecting an offset silently. Calculated instants remain unambiguous across DST. Isha may fall after midnight, but must precede the following supplied Fajr; invalid ordering fails closed.

`calculateAroundInstant` selects yesterday/today/tomorrow by the Berlin date. Generated ranges include the dates explicitly requested; the card never silently recalculates or reuses an expired day's data. Include adjacent days when reviewing a range so delayed Isha and tomorrow's Fajr are available. Missing current-day records, absent tomorrow coverage, invalid metadata, unapproved data and expired data have explicit safe states.

The existing countdown uses absolute `Date.now()` instants each tick, not repeated subtraction. It handles active forward/backward clock changes, midnight, page visibility, back/forward restoration and timer cleanup. After a clock jump expires a schedule, timers stop; restoring the clock is rechecked on visibility/pageshow or reload. There is no trusted time server: a consistently wrong device clock or outdated timezone database cannot be detected reliably offline.

Friday has its own revision, source, explicit Friday date, nullable sermon/iqama fields, freshness and approval. It is never derived from Dhuhr. The local-time adapter converts supplied `HH:mm` values with Berlin DST rules. No Friday schedule has been entered.

## 5. Reference samples and comparison results

`validation/prayer-references.json` contains twelve manually transcribed, attributed factual samples, marked **REFERENCE_SAMPLES_NOT_AN_APPROVED_TIMETABLE**. They are comparison inputs, not production guidance. Source pages and PDF text were inspected; PDF screenshot rendering was unavailable. No provider scraper was built.

| Reference ID   | Verified publisher and scope                                                                                                                                                                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diyanet-hamm` | [Diyanet's official Hamm calendar](https://namazvakitleri.diyanet.gov.tr/de-DE/11127/gebetszeit-fur-hamm), city ID 11127: eight published dates spanning autumn 2026 and winter, Ramadan, spring DST, summer and autumn 2027. Future dates are a published calendar, not observations. |
| `vez-2026`     | [Hamm Ramadan 2026 PDF](https://ramadan-nrw.de/wp-content/uploads/2026/02/Hamm.pdf), page 1, published by Ramadan-NRW/VEZ NRW: February 19 and March 19.                                                                                                                               |
| `vez-2025`     | [Hamm Ramadan 2025 PDF](https://www.ramadan-nrw.de/wp-content/uploads/2025/01/ramadankalender_hamm_2025.pdf), page 1, same publisher: March 1 and March 29.                                                                                                                            |

Ramadan labels follow the respective publishers, not a newly asserted religious calendar. These are verified **Hamm city** references. Their exact calculation coordinates, complete high-latitude policy, offsets and adoption by the hospital have not been established. No open license for republishing their complete calendars was identified. Only a small attributed validation sample is retained; no PDF, full calendar or provider dataset is shipped in `dist/`. Broader copying/reuse needs separate permission review; non-commercial use is not a redistribution license.

Run `npm run prayer:compare` to reproduce all four candidate comparisons. Values below are **calculated minus reference, in minutes**: positive means later. They report differences, not acceptable errors. `acceptableTolerance` is always `null`; matching a reference never sets approval.

First candidate: provisional hospital coordinates, MWL 18°/17°, factor-1 Asr, seventh-of-night, nearest-minute rounding, preset offsets. This is a trial configuration, not a recommended local religious policy.

| Date       | Context / reference            | Fajr | Dhuhr | Asr | Maghrib | Isha |
| ---------- | ------------------------------ | ---: | ----: | --: | ------: | ---: |
| 2026-10-29 | Autumn / Diyanet               |    0 |    −5 |  −6 |      −8 |   +5 |
| 2027-01-16 | Winter / Diyanet               |    0 |    −4 |  −2 |      −6 |   +7 |
| 2027-02-08 | Published Ramadan 1 / Diyanet  |   −1 |    −4 |  −2 |      −6 |   +8 |
| 2027-03-27 | Before spring DST / Diyanet    |  +19 |    −4 |  −3 |      −6 |   −4 |
| 2027-03-28 | After spring DST / Diyanet     |  +19 |    −4 |  −3 |      −6 |   −4 |
| 2027-06-21 | Summer / Diyanet               |  +26 |    −4 |  −4 |      −7 |  −17 |
| 2027-09-22 | Autumn / Diyanet               |  +14 |    −5 |  −6 |      −9 |   −1 |
| 2027-12-21 | Winter / Diyanet               |    0 |    −3 |  −4 |      −7 |   +7 |
| 2026-02-19 | Published Ramadan 1 / VEZ NRW  |   −1 |    −5 |  −3 |      −6 |   +7 |
| 2026-03-19 | Published Ramadan 29 / VEZ NRW |  +11 |    −5 |  −3 |      −6 |   +3 |
| 2025-03-01 | Published Ramadan 1 / VEZ NRW  |   −1 |    −4 |  −2 |      −6 |   +8 |
| 2025-03-29 | Published Ramadan 29 / VEZ NRW |  +22 |    −5 |  −3 |      −6 |   −6 |

With the Turkey preset and the same seventh-of-night rule, Fajr/Isha differences are unchanged; Dhuhr is four minutes later than the MWL candidate, Asr four later, and Maghrib seven later because of the exposed preset offsets. Thus the four VEZ NRW Ramadan samples have Maghrib **+1 minute**, whereas MWL has **−6 minutes**. Neither result establishes iftar accuracy or an acceptable tolerance. Ramadan Fajr discrepancies still include **+11 and +22 minutes**. No adjustment was fitted to conceal these differences.

The summer reference makes the policy dependency particularly clear:

| Candidate on 2027-06-21      | Fajr difference | Isha difference |
| ---------------------------- | --------------: | --------------: |
| MWL / seventh-of-night       |             +26 |             −17 |
| Turkey / seventh-of-night    |             +26 |             −17 |
| MWL / middle-of-night        |            −131 |            +140 |
| MWL / twilight-angle portion |             −43 |             +44 |

The middle-of-night candidate's Isha occurs on the following civil date. Per-day diagnostic comparison does not prove that an entire consecutive timetable has valid Isha-to-Fajr ordering; draft generation also checks that boundary. A close individual match cannot select a method. The location difference, high-latitude policy, source conventions and physical sunset assumptions require local review.

## 6. Reproducible review workflow

1. Keep all three production settings/data exports `null`. Copy `validation/settings.example.json` into ignored `.prayer-review/` and edit the copy. The example deliberately says **REVIEW_ONLY_NOT_FOR_WORSHIP**. Do not interpret its MWL/seventh-of-night values as approval.
2. Confirm the location with the hospital operator and obtain the intended religious policy from the responsible imam/local authority. Enter the agreed angles or interval, Asr, high-latitude/polar rules, rounding, every adjustment and any explicit Ramadan interval ranges. Confirm how the physical sunset limitations will be handled. Give the settings a unique revision and record the policy evidence.
3. Generate a review artifact, using explicit dates and an operator-chosen validity window. This example exercises software only; its dates/window confer no approval:

```sh
npm run prayer:draft -- \
  --settings validation/settings.example.json \
  --from 2027-06-20 --through 2027-06-22 \
  --updated-at 2027-06-19T12:00:00Z \
  --valid-from 2027-06-20T22:00:00Z \
  --expires-at 2027-06-21T22:00:00Z \
  --out .prayer-review/summer-review.json
```

The command writes only inside `.prayer-review/`, refuses overwrites, prints settings/payload SHA-256 hashes and always leaves daily and Friday approvals pending. The artifact includes complete settings, UTC results, sunrise/modeled-sunset diagnostics and method description. It never edits `src/data/prayer-data.ts`. Hashes identify the reviewed artifact; they are not signatures or authorization.

4. If Friday arrangements are supplied, create a separate JSON file with `revision`, `source: {id, label}`, `date` (an actual Friday), and `sermon`/`iqama` (`HH:mm` or `null`); at least one field must exist. Pass it with `--friday path/to/file.json`. Use real operator-provided values only. Review/approve Friday independently.
5. Compare the selected settings over a complete intended date range against an authorized local reference, including Ramadan and summer boundaries. The existing comparison CLI shows the four research candidates; `compareReference(settings, sample)` supports the reviewed configuration. Add attributed reference samples and document discrepancies. No acceptable threshold exists in this task: the responsible human authority must define any acceptance policy and resolve Fajr, Isha and Maghrib differences explicitly.
6. Record reviewer identity (a public-safe identifier), review instant, exact revision, dependency version, settings/payload hashes, reference permissions, resolved discrepancies and validity/renewal policy. Any change to settings/results invalidates that review and needs a new revision. Calendar agreement alone never authorizes publication.
7. **Stop here for this task.** A separately authorized activation change would enter the approved settings, assign matching `approval: {status: 'approved', revision, reviewedBy, reviewedAt}` to the actual reviewed daily payload and independently reviewed Friday payload, and replace `prayerData: null` with that payload. `reviewedAt` must be at least as recent as `updatedAt`. It must also intentionally revise the current no-active-payload build gate, preserve test/reference leakage checks and test expiry/renewal. Do not remove the gate merely to make a draft build pass. On GitHub Pages the published static date range must be renewed through a later reviewed release before expiry; no backend or automatic deployment is provided.

## 7. Verification and unresolved approval dependencies

Automated coverage includes configuration failures, seasonal calculations, a complete leap year, century non-leap rejection, four host timezones, both Berlin DST transitions, ambiguous/skipped local times, midnight/year rollover, after-midnight Isha handling in the existing validator, next-prayer/countdown integration, forward/backward device-clock changes, stale/missing/unapproved states, separate Friday fields and cleanup. Synthetic approval tests have an explicit test-only purpose/marker and cannot be activated by the production initializer. Public-output checks reject reference/draft/test markers and any active prayer payload.

The reference comparisons are reproducible diagnostics, **not passed religious-accuracy tests**. Pending approval items are the exact operational location/horizon, complete local method and seasonal policy, unresolved Fajr/Isha differences, Ramadan Maghrib convention, authorized reference/reuse scope, acceptable comparison policy (if any), freshness/renewal ownership and separate Friday arrangements. No human approval has been recorded.

The full verification result is recorded in [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md). Browser rendering was unavailable in the connected tool inventory; no Safari/device, visual-layout, font-shaping or screen-reader results are claimed. Existing homepage source and logo remain unchanged. Software/DOM checks cannot replace local religious review or browser acceptance.
