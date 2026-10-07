# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.1]

### Fixed

- **n8n community-node review findings.** Re-thrown node errors are now wrapped in
  `NodeOperationError`; the HMAC contract test generates its secret at runtime instead of
  hardcoding one; test files are excluded from the published `dist/`; node and credential icons
  provide themed `{ light, dark }` variants; and the codex `nodeVersion` is pinned to `"1.0"`
  (a fixed schema value, per n8n review).

## [1.4.0]

### Changed

- **Quote Decline now supports draft quotes, and the decline reason is conditional.** The Decline
  operation previously always required a reason. A quote can now be declined while still in
  **draft**, in which case the reason is **optional**; once the quote has been **sent**, a reason
  remains **required**. The Void operation's reason requirement is unchanged.

## [1.3.2]

### Fixed

- **Non-2xx API responses on multipart operations no longer report success (#20, #22).** The
  status guard only rejected `>= 400`, so a 3xx redirect — which the legacy multipart helper does
  not follow on a POST — or a response with no status code fell through to the success path and
  emitted an empty `{}`. The node reported success for a document that was never created, and a
  downstream row could be marked "sent for signature" for a signature request that did not exist.
  All request paths now treat anything outside 200–299, or a missing status code, as an error
  wrapped in `NodeOperationError`, so failures surface loudly and route to the error output.

### Changed

- **n8n community-node verification fixes (#21).** Use `NodeConnectionTypes.Main` instead of the
  `'main'` string literal on both nodes; stop advertising the trigger as an AI tool (a trigger
  cannot be one); and remove the npm `overrides` block, which is npm-only and ignored by anyone
  installing the node. See #23 for the dev-scope `npm audit` trade-off that removal records. The
  main node deliberately keeps `usableAsTool` — that one is intentional and stays.

## [1.3.1]

### Fixed

- **The signature trigger never fired.** n8n builds a webhook path from the trigger node's name,
  and the default was `TurboDocx Trigger` — with a space. The space was stored percent-encoded but
  matched decoded on the way in, so n8n returned 404 for a URL it had registered itself and every
  delivery was silently dropped. Nothing surfaced it: the workflow read as active and the
  subscription read as healthy. The default is now `TurboDocxTrigger`, with a regression test.

  Existing workflows keep the name they already have. If your trigger is named with a space,
  rename it and re-activate. The old URL also stays registered on the org webhook, so remove it or
  every event fires one good delivery and one 404.

### Added

- **Codex metadata for both nodes.** They now carry categories (Productivity, Sales,
  Miscellaneous), documentation links, and search aliases, so the node is findable by terms like
  "esignature", "contract", "NDA", "PDF" and "quote" rather than only by name. Previously n8n
  logged `No codex available` and fell back to no categories and no links.

## [1.3.0]

### Added

- **TurboSign → Send Reminder.** Nudges a document's outstanding signers on demand, without
  waiting on the configured cadence. It works when reminders are disabled or the per-signer cap
  is spent, and does not consume that cap. Only signers at the current signing order are
  emailed; later-order or already-signed recipients come back as a `skipped_*` result rather
  than being dropped, so a workflow can branch on whether anyone was actually emailed.

  The Recipient IDs field is optional: leave it empty to remind everyone whose turn it is. The
  key is omitted from the request entirely for a blank, absent, or explicitly empty value, since
  the API requires at least one id whenever `recipientIds` is present.

- **TurboSign → Get Recipients.** Lists a signature document's recipients with their current
  status.

### Security

- Cleared all 42 open Dependabot advisories (dev-scope dependencies).

## [1.2.1]

### Changed

- Releases are now published to npm with a [provenance attestation](https://docs.npmjs.com/generating-provenance-statements).
  The publish job requests an OIDC token (`id-token: write`) and passes `--provenance`.
  Required by the n8n community-node submission check.
- `publishConfig.provenance` is also set, so a bare `npm publish` run outside CI fails rather
  than silently shipping an unattested tarball. This is a guardrail against accident, not an
  enforcement boundary: npm gives CLI flags precedence over `publishConfig`, so an explicit
  `npm publish --provenance=false` with a valid token would still succeed. Real enforcement
  would be npm trusted publishing or a required-provenance setting on the package.
- `repository.url` casing now matches the GitHub repo (`TurboDocx`), and the lockfile
  version field is back in sync with `package.json`.

### Fixed

- `NODE_PACKAGE_VERSION` (the version reported in the `User-Agent`) is bumped in step with
  `package.json`. It is a hardcoded constant, and left stale a 1.2.1 install would have
  reported `@turbodocx/sdk/1.2.0 (n8n)`, writing the wrong version into the TurboSign
  signature audit trail.

## [1.2.0]

### Added

- **TurboQuote: Quote Number Config** resource with **Get** and **Update** operations,
  wrapping GET/PATCH `/v1/quotes/number-config` (org-wide quote numbering format:
  prefix, year/month tokens, separator, pad width, suffix, start number, reset cadence).
- **Bulk Create** operation for six TurboQuote resources — Product, Price Book, Bundle,
  Company, Contact, and Quote Type — POSTing `{ rows }` to `/v1/<resource>/bulk`. Each row
  uses the same shape as Create (max 500 rows); the response is a single partial-success
  `BulkImportResult` (`{ imported, failed, adjusted }`) rather than a fan-out — a failed
  row is reported in `failed`, not thrown.
- **TurboSign: Get Audit Trail** documented in the README operations table (the operation
  already shipped; the table row was missing).

### Notes

- The new `/bulk` and `/number-config` endpoints return a plural `{ results: … }` envelope,
  so their handlers use `unwrap: 'smart'` and read `.results` manually (the singular
  `unwrap: 'result'` mode does not apply here).
