# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1]

### Changed

- Releases are now published to npm with a [provenance attestation](https://docs.npmjs.com/generating-provenance-statements).
  The publish job requests an OIDC token (`id-token: write`) and `publishConfig.provenance`
  is set, so a publish from anywhere other than the GitHub Actions workflow fails instead of
  shipping an unattested tarball. Required by the n8n community-node submission check.
- `repository.url` casing now matches the GitHub repo (`TurboDocx`), and the lockfile
  version field is back in sync with `package.json`.

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
