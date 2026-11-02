# Automatic first-sermon publishing

**Current status: implemented for review, not active.** No main merge, Pages configuration change, secret upload, activation variable or deployment is performed by this task. Content approval and the owner-approved approximate duration are complete. The exact release remains sermon `learn-our-religion/r1` and study `learn-our-religion-study/r2`, no earlier than **2026-11-06T07:00:00Z = Friday 08:00 Europe/Berlin**.

## Current owner summary

| Item                                    | Verified current state                                 |
| --------------------------------------- | ------------------------------------------------------ |
| Exact r1/r2 content and duration policy | Approved and ready; source hashes unchanged            |
| Encrypted package                       | Prepared locally, not uploaded                         |
| Release workflow                        | Working branch only; not scheduled from default branch |
| `sermon-release` environment            | Not configured                                         |
| Activation variable                     | Absent; defaults to disabled                           |
| Live Pages source                       | Legacy `main:/`, unchanged                             |
| Automatic publication                   | **Inactive**                                           |

## Selected design and sources

Use GitHub Actions, Pages and two **environment secrets** in `sermon-release`: `NUR_RELEASE_PAYLOAD` (authenticated encrypted compressed public catalog) and `NUR_RELEASE_KEY` (random 256-bit key). The approved catalog compresses to about 8 KB; its encrypted envelope fits below the 48 KB per-secret limit. Environment secrets and branch restrictions are available for this public repository without a paid storage service. [GitHub secret limits](https://docs.github.com/en/actions/reference/security/secrets), [environment protection](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

The local packager validates the existing immutable public catalog digest before encryption. It uses Node's AES-256-GCM with a fresh 96-bit nonce, authenticated repository/catalog/deadline context, and HKDF-separated encryption and receipt-authentication keys. Gzip decompression is bounded. Ciphertext corruption, the wrong key, wrong context or a changed catalog fails closed. No private review wrappers are packaged. [Node authenticated encryption](https://nodejs.org/api/crypto.html#class-decipher).

The key and encrypted payload remain in ignored mode-0600 files until uploaded through standard GitHub secret input. Neither belongs in Git, Actions artifacts or logs. Both secrets are restricted to `main` through the release environment. This design trusts GitHub and the owner-approved main-branch workflow; it does not claim to hide data from an administrator who can change that trusted workflow.

The workflow uses UTC polling at minutes **07, 22, 37 and 52 on November 6–8**. A separate year/deadline check enforces the authorized 2026 instant. Automatic retries end at **2026-11-09T00:00:00Z**; manual release dispatch remains available afterward. No exact-minute promise is made: GitHub schedules can be delayed or dropped, and only operate from the default branch. A later run safely retries. [GitHub schedule limitations](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows).

Deployment uses the official Pages artifact/deployment actions rather than a personal token or branch write. Build and verification jobs have `contents: read`; only deployment has `pages: write` and `id-token: write`. No workflow has repository-content write access. [Pages workflow requirements](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Thursday preparation

The existing r1/r2 approval was recorded earlier; Thursday preparation must not invent a new religious review or backdate anything.

1. Confirm the exact approved pair and run `npm run verify`. Keep the original sources and approval records local. The public-shaped catalog is `.sermon-review/task27-public-catalog.json`, digest `04fe4d7bbc54913d791197ab385493e290c0d1657c637e4397f77ca3472794e9`.
2. Run `npm run sermon:package` once. It validates the pinned catalog and performs an authenticated encryption/decryption round trip. It exclusively creates `.sermon-review/task28-release-key.txt` and `.sermon-review/task28-release-payload.txt`. Existing outputs are never overwritten. Reuse a matching existing pair for this exact release; do not rotate only one secret.
3. Complete the security review below before authorizing configuration/main merge. Keep repository variable `NUR_SERMON_AUTO_ENABLED` absent or `false` during setup.
4. Create the `sermon-release` environment with **Selected branches and tags → Branch → main only**, no tag rule. Configure `github-pages` with the same branch restriction. For unattended operation, do not require per-run reviewer approval or a waiting timer on these environments; final owner approval happens before activation. Protect changes to main, workflows, release policy, dependencies and release scripts through owner review.
5. Upload the two files without printing their values:

```sh
gh secret set NUR_RELEASE_KEY --env sermon-release \
  --repo nurundhuda-hub/nur-und-huda < .sermon-review/task28-release-key.txt
gh secret set NUR_RELEASE_PAYLOAD --env sermon-release \
  --repo nurundhuda-hub/nur-und-huda < .sermon-review/task28-release-payload.txt
```

6. **After explicit final security confirmation**, change Pages publishing source from legacy `main:/` to **GitHub Actions**, then merge only the reviewed safe implementation into `main`. This order avoids an incidental legacy branch deployment during merge. The existing public site should remain served until a new Pages deployment; do not run the older Task 27 branch publisher concurrently.
7. Run `Automatic first sermon release` manually from `main` with **mode `preflight`**. This mode runs verification but never accesses the content secrets, decrypts, uploads or deploys. The independent `Sermon release security checks` workflow also tests the safe branch without secrets or deployment permissions.
8. Confirm both environment restrictions, secret names, successful security/preflight runs, Pages workflow mode and reviewed default-branch commit. Only then set repository variable `NUR_SERMON_AUTO_ENABLED=true`. No API token or secret is added to the repository. Activating before Friday still cannot pass the UTC embargo.

Secret values cannot be read back from GitHub. Their exact pairing is tested locally; the first eligible runner authenticates them before building. Do not enable debug output, print environment variables or upload runner directories as diagnostic artifacts.

## Friday operation

1. A scheduled run checks repository, `refs/heads/main`, activation, UTC time and retry window. Before the instant it reports `embargo`; disabled or preflight runs never start secret-bearing jobs.
2. The build job verifies safe code before assigning secrets to the preparation step. That step independently checks the guard again **before reading/decrypting secrets** and validates the exact catalog, approvals, revisions, owner-estimated duration and matching publication times.
3. It probes `sermon-release-status.json`. A valid HMAC-authenticated receipt plus matching live pages, download and assets returns **already live and verified**, with no upload or deployment. A signed incomplete release may be repaired. Network errors are retried later rather than treated as proof of absence; an unrecognized receipt blocks overwriting another release.
4. A due release builds only the approved public catalog on the ephemeral runner. Logs from content-bearing build/validation subprocesses are captured, not printed. The original source store is restored afterward. Only checked `dist/` is eligible for upload; no private review directory, source wrapper, key or payload is uploaded or cached.
5. The clock is checked again immediately before uploading the Pages artifact and independently before deploying it. The artifact name includes run ID and attempt, avoiding collisions on retries; retention is one day. Build/deploy permissions and environments remain separate.
6. The verifier checks the actual signed live receipt and SHA-256 bytes of both pages, overview, offline download and JS/CSS/font/image assets. Only that verification, or an already-live check, reports publication success. Deploy acceptance alone is insufficient.

Concurrency groups serialize scheduled and manual release runs without cancelling an active deployment. A crash before upload leaves nothing public; failure after deployment may mean content is live but unverified. A later run rechecks live state and either verifies/skips or safely retries the same approved pair. The receipt contains only release identity, catalog digest, public file hashes and source commit; no private approval record or content text.

## Owner-facing status and fallback

Use the workflow summary:

| Status                                    | Meaning/action                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `disabled` / `preflight-only`             | Publication is not enabled; no content secrets accessed.                                           |
| `embargo`                                 | Waiting for Friday 07:00 UTC.                                                                      |
| Validated for deployment                  | Build passed; public availability is not yet confirmed.                                            |
| Already live and verified / Verified live | The exact approved release and all checked files are publicly served.                              |
| Failed phase / red workflow               | Not verified. Fix configuration if needed, then allow the next run or dispatch `release` manually. |
| `retry-window-ended`                      | Automatic attempts have stopped. Inspect the last result and use manual `release` dispatch.        |

Manual fallback after the deadline:

```sh
gh workflow run automatic-sermon-release.yml --ref main \
  --repo nurundhuda-hub/nur-und-huda -f mode=release
```

Do not use `gh workflow run` success as evidence of publication. Monitor the complete run and verifier. After verified success, the owner may set `NUR_SERMON_AUTO_ENABLED=false` to stop further attempts. Disabling affects new runs; cancel any already-running release explicitly if necessary. Never change the deadline or force approval merely to recover from a failure.

Release targets (not a claim that they are live now):

- https://nurundhuda-hub.github.io/nur-und-huda/sermons.html
- https://nurundhuda-hub.github.io/nur-und-huda/sermons/learn-our-religion/r1.html
- https://nurundhuda-hub.github.io/nur-und-huda/studies/learn-our-religion-study/r2.html
- https://nurundhuda-hub.github.io/nur-und-huda/downloads/sermons/learn-our-religion/r1.html

## Final security checks before activation

- Existing content/release approvals and original source hashes remain unchanged; the catalog digest and r1/r2 identities are pinned.
- No unreleased plaintext, private review file, key or encrypted secret value is staged in Git. No pre-release public content artifact is produced.
- `npm run verify` and the GitHub safe-code security workflow pass. Synthetic end-to-end tests cover the actual preparation script, Astro build, output validation, authenticated receipt, live verification and duplicate skip without network disclosure.
- Tests reject early dates, wrong repo/ref, missing activation, malformed ciphertext, mismatched keys/context, stale bytes, bad receipt signatures and workflow permission/guard regressions. Existing timezone/DST, source integrity, reader and offline tests remain in force.
- Official actions use reviewed versions; resolve and pin their actual commit SHAs from this repository's safe CI preparation logs before final activation review. Disabled bootstrap action-resolution steps never upload or deploy.
- GitHub configuration and actual default-branch preflight must be checked separately. Local tests cannot prove that the live environment, secrets or Pages settings have been configured correctly.

For a later sermon, repeat human content approval and private preparation, update the reviewed exact release identity/digest/date and retry window, and create a new matching encrypted package. This first implementation intentionally accepts only the authorized r1/r2 pair; it never approves or publishes the next lesson automatically.
