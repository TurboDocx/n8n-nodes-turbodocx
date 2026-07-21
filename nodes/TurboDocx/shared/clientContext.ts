/**
 * Client-context headers for the TurboSign audit trail.
 *
 * The TurboDocx backend derives the signature audit trail's device + location from the
 * request's `User-Agent`, `X-Timezone` and `Accept-Language` headers. Without them, an
 * API-key request (which is how this node authenticates) is recorded with a generic
 * "API Client" device and "N/A" language.
 *
 * The backend only treats a request as a first-party client when the `User-Agent` begins with
 * the canonical `@turbodocx/sdk/<version>` token (`parseTurboDocxSdkUserAgent`), so this node
 * emits that prefix and identifies itself as n8n in the runtime segment. The backend then
 * labels the audit entry "TurboDocx n8n Node <version>" rather than "TurboDocx SDK".
 *
 * ---------------------------------------------------------------------------------------
 * WHY THIS REPORTS LESS THAN THE LANGUAGE SDKs
 *
 * The TurboDocx SDKs also send OS name/version, CPU arch, hostname and a device fingerprint.
 * This node deliberately does NOT, because n8n Cloud forbids community nodes from touching
 * the only APIs that expose them. `@n8n/eslint-plugin-community-nodes` allows exactly these
 * imports — n8n-workflow, lodash, moment, p-limit, luxon, zod, crypto — and bans the
 * `process` global outright. `os` is not on the allowlist, so hostname/platform/arch are
 * unreachable, and `process.version` is unavailable for the Node runtime string.
 *
 * Violating either rule fails `n8n-node lint`, which gates CI *and* npm publish, and blocks
 * n8n Cloud verification — i.e. it would cost the marketplace listing. `Intl` is a language
 * built-in rather than a restricted global, so timezone and locale still work and are the two
 * environment fields kept here.
 *
 * Net effect on the audit trail for an n8n-originated send: Client, Timezone and Language are
 * real; OS reads "Unknown" and Device reads "Server".
 * ---------------------------------------------------------------------------------------
 *
 * Everything here is best-effort and guarded: any detection failure degrades to a bare
 * User-Agent rather than throwing, so a request is never blocked by context detection.
 */

/**
 * Version reported in the User-Agent.
 *
 * Hardcoded because `require('../../../package.json')` is a `no-require-imports` violation
 * under the community-node lint config. It must be kept in sync with `package.json`'s
 * `version` — a stale value ships a wrong version into a compliance record.
 */
export const NODE_PACKAGE_VERSION = '1.2.0';

/**
 * Build the User-Agent, e.g. `@turbodocx/sdk/1.2.0 (n8n)`.
 *
 * The `@turbodocx/sdk/<version>` prefix is required for the backend to classify the call and
 * read the context headers; the parenthesised segment leads with `n8n` so the backend labels
 * the audit entry as the n8n node rather than a language SDK.
 */
export function buildUserAgent(): string {
	return `@turbodocx/sdk/${NODE_PACKAGE_VERSION} (n8n)`;
}

/** Host IANA timezone (e.g. "America/New_York"); "" if unavailable. */
export function detectTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
	} catch {
		return '';
	}
}

/** Host BCP-47 language tag (e.g. "en-US"); "" if unavailable. */
export function detectLocale(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().locale || '';
	} catch {
		return '';
	}
}

// Strip CR/LF and control chars so a timezone/locale can't corrupt the header value or be
// rejected by n8n's HTTP transport (which would throw on every request).
function sanitizeHeaderValue(value: string): string {
	// eslint-disable-next-line no-control-regex
	return value.replace(/[\r\n\x00-\x1f\x7f]/g, '').trim();
}

/**
 * Resolve the client-context headers to attach to every TurboDocx request. Only non-empty
 * values are included, so a header is never sent blank.
 *
 * No `X-Device-Fingerprint` is sent: it is a hash of hostname/platform/arch, none of which are
 * reachable here (see the file header). A fingerprint derived from anything else would not
 * identify the host — worse than omitting it.
 */
export function resolveClientContextHeaders(): Record<string, string> {
	const headers: Record<string, string> = {};

	headers['User-Agent'] = sanitizeHeaderValue(buildUserAgent());

	const timezone = sanitizeHeaderValue(detectTimezone());
	if (timezone) headers['X-Timezone'] = timezone;

	const language = sanitizeHeaderValue(detectLocale());
	if (language) headers['Accept-Language'] = language;

	return headers;
}
