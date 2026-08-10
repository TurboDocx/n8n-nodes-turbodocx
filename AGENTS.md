# AGENTS.md

## Change Management (hard requirement)

This is a public OSS repo, so **blank issues are enabled** for outside contributors. But any
change **an agent or maintainer** makes must have a Change Request recorded **somewhere** before
it merges — either a **Change Request** issue here
(`.github/ISSUE_TEMPLATE/change-request.yml`) or the linked tracking issue in the internal
tracker. **Never merge a change without a change-request ticket.** Bugs use the **Bug Report**
form. Do not reference internal repos or PRs in this public repo.

## Releasing

**Releases only happen through GitHub Actions.** Never `npm publish` from a laptop and never run
`npm run release` (it wraps release-it, which publishes locally by default). The workflow is
`.github/workflows/npm-publish.yml`, triggered when a GitHub release is **created**.

npm publishes with a **provenance attestation** — the n8n community-node submission rejects any
version published without one. That needs `id-token: write` on the publish job and `--provenance`
on the publish command. Both are in place; don't remove them.

### Bumping the version — all four, or the release is wrong

1. `package.json` → `version`
2. `package-lock.json` → both root `version` fields
3. **`nodes/TurboDocx/shared/clientContext.ts` → `NODE_PACKAGE_VERSION`**
4. `CHANGELOG.md` → new section

Number 3 is the trap and it has already bitten once. It is a hardcoded copy of the version because
the community-node lint bans reading `package.json` from the node source. Leave it stale and the
node sends `@turbodocx/sdk/<old> (n8n)`, and the backend writes that wrong version into the
**TurboSign signature audit trail** — an immutable compliance record. Nothing catches it: no test
asserts the sync, and the publish workflow runs `lint` + `build` but never `npm test`.

A test *cannot* currently enforce it. Reading `package.json` needs `node:fs` / `node:path` /
`__dirname`, all banned **repo-wide** by `@n8n/community-nodes/no-restricted-imports` — moving the
test outside `nodes/` does not escape it. Enforcing it means excluding test files from the
cloud-compatibility lint, which gates n8n Cloud verification. Ask before making that trade.

### Before opening a release PR

`npm ci && npm run lint && npm run build && npx jest`. Run jest explicitly — `ci.yml` runs only
lint and build, so a failing test will not block the PR or the publish.

### After cutting the release

```
npm view @turbodocx/n8n-nodes-turbodocx@<version> dist.attestations
```

Non-empty, showing `provenance.predicateType: https://slsa.dev/provenance/v1`, means the
attestation landed. Empty means the package shipped unattested and n8n will reject it.

### When a release run fails

- **A provenance/OIDC failure is non-destructive.** npm generates the attestation *before* the
  registry upload, so a bad config aborts before anything is published and the version number
  stays free to retry. A version is only consumed once the upload succeeds.
- **`NPM_TOKEN` is the usual suspect** — an expired or under-scoped token is what killed the 1.1.0
  release. It surfaces as a 401/404 on the upload. Rotate it and re-cut.
- **`gh run rerun` replays the same commit**, so it can never pick up a fix to the workflow file.
  Delete the tag and release, merge the fix, then cut a new release.
- **`npm publish --dry-run` cannot test any of this** — npm short-circuits before the publish
  code path, so dry-run never exercises provenance. Only a real release run does.

`publishConfig.provenance` in `package.json` makes a bare `npm publish` fail outside CI. Treat it
as a guardrail against accident, not a security boundary: npm gives CLI flags precedence over
`publishConfig`, so an explicit `--provenance=false` still publishes unattested.
