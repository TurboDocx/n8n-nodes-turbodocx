# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
