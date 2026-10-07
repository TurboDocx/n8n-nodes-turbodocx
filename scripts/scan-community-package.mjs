#!/usr/bin/env node
/**
 * Runs n8n's official community-node scanner ruleset against the LOCAL working
 * tree, so CI and the pre-commit hook gate on the current code instead of the
 * already-published npm version.
 *
 * Why a wrapper instead of the scanner's own CLI:
 *   `npx @n8n/scan-community-package <pkg>` only accepts a *published* package
 *   name. It checks the package's npm provenance, downloads the attested GitHub
 *   source commit, and downloads the npm tarball — all from the registry. There
 *   is no CLI path to point it at a local directory or a local tarball, so it
 *   can only ever scan code that is already released. This wrapper imports the
 *   two functions the scanner uses to do the actual linting and drives them
 *   against local files, reproducing exactly what `analyzePackageByName` does:
 *     - source leg: real `.ts` sources under nodes/ + credentials/ + package.json
 *     - dist leg:   the packed tarball's compiled `.js` + published package.json
 *   Only the provenance / registry fetch is skipped — that concerns the
 *   *published* artifact, which does not exist for uncommitted local code.
 *
 * Second reason a wrapper is required: the scanner's CLI exits 0 even when a
 * package FAILS its checks (it prints ❌ and returns). This wrapper sets a
 * non-zero exit code on any violation, so CI and husky actually block.
 *
 * Usage:
 *   node scripts/scan-community-package.mjs                # full scan: source + dist (run `npm run build` first)
 *   node scripts/scan-community-package.mjs --source-only  # source leg only; no build/pack needed (used by pre-commit)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceOnly = process.argv.includes('--source-only');

// analyzePackage + SOURCE_FILE_PATTERNS are exported by the scanner; the dist
// file patterns below are NOT exported — they are inlined inside the scanner's
// analyzePackageByName(). Keep them in sync on a scanner version bump.
const DIST_FILE_PATTERNS = ['**/*.js', 'package.json'];

const { analyzePackage, SOURCE_FILE_PATTERNS } = await import(
	'@n8n/scan-community-package/scanner/scanner.mjs'
);

function report(label, result) {
	if (result.passed) {
		console.log(`✅ ${label}: passed`);
		return true;
	}
	console.log(`❌ ${label}: ${result.message ?? 'failed'}`);
	if (result.details) console.log(result.details);
	return false;
}

// --- Source leg: lint the real .ts sources (nodes/, credentials/, package.json) ---
const sourceResult = await analyzePackage(repoRoot, SOURCE_FILE_PATTERNS);
let passed = report('Source scan (nodes/ + credentials/ + package.json)', sourceResult);

// --- Dist leg: pack the package exactly as npm publish would, then lint the
//     compiled output + the published package.json ---
if (!sourceOnly) {
	if (!fs.existsSync(path.join(repoRoot, 'dist'))) {
		console.error(
			'\n❌ dist/ not found. Run `npm run build` before the full scan, or pass --source-only.',
		);
		process.exit(1);
	}

	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'n8n-scan-'));
	const packResult = spawnSync('npm', ['pack', '--pack-destination', tmpDir], {
		cwd: repoRoot,
		stdio: 'pipe',
		encoding: 'utf8',
	});
	if (packResult.status !== 0) {
		console.error(`\n❌ npm pack failed:\n${packResult.stderr}`);
		process.exit(1);
	}

	const tarball = fs.readdirSync(tmpDir).find((f) => f.endsWith('.tgz'));
	if (!tarball) {
		console.error('\n❌ npm pack produced no tarball.');
		process.exit(1);
	}

	const extractDir = path.join(tmpDir, 'extracted');
	fs.mkdirSync(extractDir, { recursive: true });
	const tarResult = spawnSync(
		'tar',
		['-xzf', path.join(tmpDir, tarball), '-C', extractDir, '--strip-components=1'],
		{ stdio: 'pipe', encoding: 'utf8' },
	);
	if (tarResult.status !== 0) {
		console.error(`\n❌ tar extraction failed:\n${tarResult.stderr}`);
		process.exit(1);
	}

	const distResult = await analyzePackage(extractDir, DIST_FILE_PATTERNS);
	passed = report('Dist scan (packed tarball)', distResult) && passed;

	fs.rmSync(tmpDir, { recursive: true, force: true });
} else {
	console.log('ℹ️  --source-only: skipping the packed-dist leg (run the full scan in CI).');
}

if (!passed) {
	console.error('\n❌ Community-node scan found violations. See details above.');
	process.exit(1);
}
console.log('\n✅ Community-node scan passed.');
