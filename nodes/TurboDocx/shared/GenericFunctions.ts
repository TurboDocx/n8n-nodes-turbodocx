import {
	IExecuteFunctions,
	IHookFunctions,
	IDataObject,
	IHttpRequestMethods,
	IHttpRequestOptions,
	NodeOperationError,
} from 'n8n-workflow';

import { resolveClientContextHeaders } from './clientContext';

// Device/location headers for the TurboSign audit trail, describing the n8n host. Computed
// once — the host environment is stable for the lifetime of the process.
const CLIENT_CONTEXT_HEADERS = resolveClientContextHeaders();

/**
 * Shared TurboDocx request layer.
 *
 * The n8n node re-implements the TurboDocx SDK's HTTP calls directly (published
 * community nodes cannot bundle a first-party runtime dependency). These helpers
 * centralise auth, base-URL handling, error extraction and binary downloads so
 * every resource handler behaves identically.
 */

export const DEFAULT_BASE_URL = 'https://api.turbodocx.com';

/** Credential type names used by this node. */
export const CRED_STANDARD = 'turboDocxApi';
export const CRED_PARTNER = 'turboDocxPartnerApi';

interface FullResponse {
	statusCode: number;
	body: unknown;
	headers?: unknown;
}

/**
 * n8n's NodeError rewrites any message CONTAINING one of these tokens into a generic
 * connection/filesystem message (COMMON_ERRORS in n8n-workflow's node.error). A CamelCase
 * backend code can collide by accident — "TemplateNotFound" upper-cases to
 * "TEMPLAT|ENOTFOUND" — which would swallow the real message. Such codes are left off the
 * message rather than destroying it.
 */
const N8N_MANGLED_TOKENS = [
	'ECONNREFUSED',
	'ECONNRESET',
	'ENOTFOUND',
	'ETIMEDOUT',
	'ERRADDRINUSE',
	'EADDRNOTAVAIL',
	'ECONNABORTED',
	'EHOSTUNREACH',
	'EAI_AGAIN',
	'ENOENT',
	'EISDIR',
	'ENOTDIR',
	'EACCES',
	'EEXIST',
	'EPERM',
	'GETADDRINFO',
];

/** Render ` [Code]` for display, unless the code would be mangled by n8n (see above). */
function formatErrorCode(code: string): string {
	if (!code) return '';
	const upper = code.toUpperCase();
	if (N8N_MANGLED_TOKENS.some((token) => upper.includes(token))) return '';
	return ` [${code}]`;
}

/**
 * The backend's domain `ValidationError` serialises as `{ message, error: "<Code>", data }`
 * (ValidationErrorHandler / the TurboQuote routes) — the machine code lives in `error` as a
 * STRING beside a human `message`, not in `type`/`code`. Pull it out so codes like
 * `QuoteHasNoLineItems` or `SenderEmailRequired` reach the user. Only when a `message` is
 * present: with `{ error: "Forbidden" }` alone the string IS the message.
 */
function stringErrorCode(obj: Record<string, unknown> | null | undefined): string {
	if (!obj) return '';
	if (typeof obj.message !== 'string' || !obj.message) return '';
	return typeof obj.error === 'string' ? obj.error : '';
}

/**
 * Build a human-friendly error message from a TurboDocx API error body.
 * Handles the four shapes the API emits:
 *   1. { data: { errors: [{ path, message }] } }  (Celebrate/Joi validation)
 *   2. { error: "..." }                            (simple string)
 *   3. { message: "...", type: "..." }             (standard format)
 *   4. { message: "...", error: "<Code>", data }   (domain ValidationError)
 */
/** The parsed pieces of an API error, before they are rendered for display. */
export interface ApiErrorParts {
	/** The actionable reason, with the machine code appended when it is safe to show. */
	message: string;
	/** The machine-readable code (e.g. `QuoteHasNoLineItems`), or '' when the API sent none. */
	code: string;
	statusCode: number;
}

/**
 * Parse an API error body into its parts.
 *
 * Kept separate from the display string so `continueOnFail` output can carry `code` and
 * `statusCode` as real fields — a workflow branching on `QuoteHasNoLineItems` should use an
 * IF node on `code`, not substring-match a blob.
 */
export function buildApiError(
	rawBody: unknown,
	statusCode: number,
	includePath = false,
): ApiErrorParts {
	let errorBody: unknown = rawBody;

	if (Buffer.isBuffer(errorBody)) {
		errorBody = errorBody.toString('utf-8');
	}
	if (typeof errorBody === 'string') {
		try {
			errorBody = JSON.parse(errorBody);
		} catch {
			// keep as string
		}
	}

	const obj = typeof errorBody === 'object' && errorBody !== null
		? (errorBody as Record<string, unknown>)
		: null;

	// The `error` field may be a nested object `{ message, code }` (TurboQuote) rather
	// than a string. Capture it so we read its message instead of stringifying "[object Object]".
	const nestedError =
		obj && typeof obj.error === 'object' && obj.error !== null
			? (obj.error as Record<string, unknown>)
			: null;

	let errorMessage = 'Request failed';
	const errorCode = obj
		? ((obj.type as string) ||
			(obj.code as string) ||
			(nestedError?.code as string) ||
			stringErrorCode(obj) ||
			'')
		: '';

	if (
		obj &&
		obj.data &&
		typeof obj.data === 'object' &&
		Array.isArray((obj.data as { errors?: unknown[] }).errors)
	) {
		const errors = (obj.data as { errors: { path?: string[]; message?: string }[] }).errors;
		const errorDetails = errors
			.map((e) => {
				if (includePath && e.path?.length) {
					return `${e.path.join('.')}: ${e.message}`;
				}
				return e.message || JSON.stringify(e);
			})
			.join('; ');
		errorMessage = errorDetails || (obj.message as string) || 'Validation failed';
	} else if (nestedError) {
		errorMessage = (nestedError.message as string) || JSON.stringify(nestedError);
	} else if (obj && typeof obj.message === 'string' && obj.message) {
		// Prefer the human-readable message over a bare `error` code string. The code
		// (e.g. "TemplateNotFound") otherwise gets mangled by n8n's COMMON_ERRORS scan
		// (it contains "ENOTFOUND") into a bogus connection/host error.
		errorMessage = obj.message;
	} else if (obj && typeof obj.error === 'string' && obj.error) {
		errorMessage = obj.error;
	} else if (typeof errorBody === 'string' && errorBody) {
		errorMessage = errorBody;
	}

	return {
		message: `${errorMessage}${formatErrorCode(errorCode)}`,
		code: errorCode,
		statusCode,
	};
}

/**
 * Display string for an API error: the actionable reason plus the HTTP status.
 *
 * Retained for callers that only need a string. Prefer `buildApiError` where the structured
 * code/status are useful.
 */
export function buildApiErrorMessage(
	rawBody: unknown,
	statusCode: number,
	includePath = false,
): string {
	const parts = buildApiError(rawBody, statusCode, includePath);
	return `${parts.message}\n\nHTTP Status: ${parts.statusCode}`;
}

/**
 * Build the NodeOperationError for a failed API response.
 *
 * The actionable reason goes in the message and the HTTP status in `description` (n8n renders
 * it as a subtitle) rather than being concatenated into one blob. The parsed `code` and
 * `statusCode` are stashed on the error so the node's `continueOnFail` path can emit them as
 * real fields instead of re-parsing the string.
 */
export function createApiError(
	ctx: IExecuteFunctions,
	rawBody: unknown,
	statusCode: number,
	itemIndex: number,
	includePath = false,
): NodeOperationError {
	const parts = buildApiError(rawBody, statusCode, includePath);
	const error = new NodeOperationError(ctx.getNode(), parts.message, {
		itemIndex,
		description: `HTTP Status: ${parts.statusCode}`,
	});

	// Read back by TurboDocx.node.ts in continueOnFail mode.
	(error as NodeOperationError & ApiErrorParts).code = parts.code;
	(error as NodeOperationError & ApiErrorParts).statusCode = parts.statusCode;

	return error;
}

/**
 * Response envelope unwrapping. The TurboDocx backend wraps payloads in `{ data }`,
 * and TurboQuote single-entity endpoints add a second `{ result }` layer. These modes
 * mirror the SDK's `smartUnwrap` so n8n items carry the meaningful payload, not the envelope.
 *
 * - `none`   raw body (default — preserves the original TurboSign output shape)
 * - `smart`  strip `{ data }` only when it is the sole key (SDK smartUnwrap)
 * - `data`   take `.data` even alongside siblings like `message` (webhook POST/PATCH)
 * - `result` smart-unwrap, then take `.result` (TurboQuote single-entity double-unwrap)
 */
export type UnwrapMode = 'none' | 'smart' | 'data' | 'result';

export function applyUnwrap(body: IDataObject, mode: UnwrapMode = 'none'): IDataObject {
	if (mode === 'none') return body;
	if (!body || typeof body !== 'object' || Array.isArray(body)) return body;

	if (mode === 'data') {
		return ('data' in body ? (body.data as IDataObject) : body) ?? ({} as IDataObject);
	}

	// smart: only unwrap when `data` is the sole key
	let result = body;
	const keys = Object.keys(result);
	if (keys.length === 1 && keys[0] === 'data') {
		result = result.data as IDataObject;
	}

	if (mode === 'result' && result && typeof result === 'object' && !Array.isArray(result)) {
		if ('result' in result) return result.result as IDataObject;
	}

	return result;
}

async function getBaseUrl(
	ctx: IExecuteFunctions | IHookFunctions,
	credentialName: string,
): Promise<string> {
	const credentials = await ctx.getCredentials(credentialName);
	return (credentials.baseUrl as string) || DEFAULT_BASE_URL;
}

export interface TurboDocxRequestOptions {
	/** HTTP verb. */
	method: IHttpRequestMethods;
	/** API path beginning with `/` (base URL is prepended). */
	endpoint: string;
	/** JSON body. Pass an n8n multipart body (with a `file` key) for uploads. */
	body?: IDataObject;
	/** Query string parameters. */
	qs?: IDataObject;
	/** Credential type to authenticate with. Defaults to the standard API key. */
	credentialName?: string;
	/** Force multipart/form-data even without a binary `file` field. */
	multipart?: boolean;
	/** Response envelope unwrapping. Defaults to `none` (raw body). */
	unwrap?: UnwrapMode;
}

/**
 * Perform an authenticated JSON request and return the parsed body.
 * Throws a NodeOperationError with an extracted message on HTTP >= 400.
 */
export async function turboDocxApiRequest(
	ctx: IExecuteFunctions,
	options: TurboDocxRequestOptions,
	itemIndex = 0,
): Promise<IDataObject> {
	const credentialName = options.credentialName ?? CRED_STANDARD;
	const baseUrl = await getBaseUrl(ctx, credentialName);
	const url = `${baseUrl}${options.endpoint}`;

	let response: FullResponse;

	if (options.multipart && options.body !== undefined) {
		// Multipart uploads go through the legacy request helper's `formData` option.
		// Community nodes cannot bundle `form-data` (n8n Cloud bans dependencies), and
		// the modern httpRequest helper only emits multipart for a real FormData
		// instance. The legacy path serialises a plain `{ key: { value, options } }`
		// (and arrays of those under one key, e.g. `images`) into form parts itself.
		// The options object is typed inline: IRequestOptions is flagged deprecated for
		// direct import, but is what the legacy formData helper accepts.
		const requestOptions = {
			method: options.method,
			uri: url,
			formData: options.body,
			json: true,
			simple: false,
			resolveWithFullResponse: true,
			// Client-context headers so the audit trail records the real n8n host/OS/timezone
			// instead of the generic "API Client". Merged with the credential's auth headers.
			headers: { ...CLIENT_CONTEXT_HEADERS },
			...(options.qs && Object.keys(options.qs).length > 0 ? { qs: options.qs } : {}),
		};
		response = (await ctx.helpers.requestWithAuthentication.call(
			ctx,
			credentialName,
			requestOptions,
		)) as FullResponse;
	} else {
		const requestOptions: IHttpRequestOptions = {
			method: options.method,
			url,
			ignoreHttpStatusErrors: true,
			returnFullResponse: true,
			// Client-context headers so the audit trail records the real n8n host/OS/timezone
			// instead of the generic "API Client". Merged with the credential's auth headers.
			headers: { ...CLIENT_CONTEXT_HEADERS },
		};
		if (options.qs && Object.keys(options.qs).length > 0) requestOptions.qs = options.qs;
		if (options.body !== undefined) {
			requestOptions.body = options.body;
			requestOptions.json = true;
		}
		response = (await ctx.helpers.httpRequestWithAuthentication.call(
			ctx,
			credentialName,
			requestOptions,
		)) as FullResponse;
	}

	if (response.statusCode >= 400) {
		throw createApiError(ctx as IExecuteFunctions, response.body, response.statusCode, itemIndex);
	}

	return applyUnwrap((response.body ?? {}) as IDataObject, options.unwrap);
}

export interface PaginatedListOptions {
	/** API path beginning with `/`. */
	endpoint: string;
	/** Current input item index (for error attribution and param reads). */
	i: number;
	/** Extra query params merged into every page request. */
	baseQs?: IDataObject;
	/** Credential type to authenticate with. Defaults to the standard API key. */
	credentialName?: string;
	/** Envelope unwrapping for each page (default `smart`). */
	unwrap?: UnwrapMode;
	/** Page size used when Return All is enabled (default 100). */
	pageSize?: number;
}

/**
 * Walk a `{ results, totalRecords }` list endpoint, honouring the node's
 * `returnAll` / `limit` parameters. When Return All is on it pages by `offset`
 * until a short (< pageSize) or empty page — it does NOT rely on `totalRecords`,
 * so a missing/wrong count never truncates results to a single page.
 */
export async function paginatedList(
	ctx: IExecuteFunctions,
	options: PaginatedListOptions,
): Promise<IDataObject[]> {
	const { endpoint, i } = options;
	const pageSize = options.pageSize ?? 100;
	const baseQs = options.baseQs ?? {};
	const unwrap = options.unwrap ?? 'smart';
	const returnAll = ctx.getNodeParameter('returnAll', i, false) as boolean;
	const out: IDataObject[] = [];

	if (!returnAll) {
		const limit = ctx.getNodeParameter('limit', i, 50) as number;
		const page = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint, qs: { ...baseQs, limit, offset: 0 }, unwrap, credentialName: options.credentialName },
			i,
		);
		return ((page.results as IDataObject[]) ?? []).slice();
	}

	let offset = 0;
	let hasMore = true;
	while (hasMore) {
		const page = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint, qs: { ...baseQs, limit: pageSize, offset }, unwrap, credentialName: options.credentialName },
			i,
		);
		const results = (page.results as IDataObject[]) ?? [];
		out.push(...results);
		hasMore = results.length === pageSize;
		offset += results.length;
	}
	return out;
}

/**
 * Perform an authenticated request expecting a binary (arraybuffer) response,
 * e.g. PDF / source-file downloads. Returns the raw Buffer.
 * Throws a NodeOperationError with an extracted message on HTTP >= 400.
 */
export async function turboDocxApiRequestBinary(
	ctx: IExecuteFunctions,
	options: TurboDocxRequestOptions,
	itemIndex = 0,
): Promise<Buffer> {
	const credentialName = options.credentialName ?? CRED_STANDARD;
	const baseUrl = await getBaseUrl(ctx, credentialName);

	const requestOptions: IHttpRequestOptions = {
		method: options.method,
		url: `${baseUrl}${options.endpoint}`,
		encoding: 'arraybuffer',
		json: false,
		ignoreHttpStatusErrors: true,
		returnFullResponse: true,
		// Same client-context headers as the JSON path. Downloads hit TurboDocx directly, so
		// without these they are logged as an anonymous "API Client" while every other call
		// from the same workflow reports the real host/OS/timezone.
		headers: { ...CLIENT_CONTEXT_HEADERS },
	};
	if (options.qs && Object.keys(options.qs).length > 0) requestOptions.qs = options.qs;
	if (options.body !== undefined) {
		requestOptions.body = options.body;
	}

	const response = (await ctx.helpers.httpRequestWithAuthentication.call(
		ctx,
		credentialName,
		requestOptions,
	)) as FullResponse;

	if (response.statusCode >= 400) {
		throw createApiError(ctx as IExecuteFunctions, response.body, response.statusCode, itemIndex);
	}

	return response.body as Buffer;
}

/**
 * Fetch a presigned storage URL and return the bytes.
 *
 * Deliberately UNauthenticated: the signature is already carried in the URL's query
 * string, and S3 rejects a request that also sends an `Authorization` header
 * ("Only one auth mechanism allowed"). Mirrors the SDK, which does a bare `fetch`
 * on the download URL rather than routing it through its HTTP client.
 */
export async function fetchPresignedUrl(
	ctx: IExecuteFunctions,
	url: string,
	itemIndex = 0,
): Promise<Buffer> {
	const response = (await ctx.helpers.httpRequest({
		method: 'GET',
		url,
		encoding: 'arraybuffer',
		json: false,
		ignoreHttpStatusErrors: true,
		returnFullResponse: true,
	})) as FullResponse;

	if (response.statusCode >= 400) {
		throw createApiError(ctx as IExecuteFunctions, response.body, response.statusCode, itemIndex);
	}

	return response.body as Buffer;
}

/**
 * Translate an unexpected thrown error (network failure, n8n-wrapped API error)
 * into a NodeOperationError with the best message we can extract. Mirrors the
 * original monolith's outer-catch behaviour so error output stays stable.
 */
export function normalizeUnexpectedError(
	error: unknown,
): { message: string; code: string; statusCode: number } {
	const errorObj = error as {
		httpCode?: number;
		statusCode?: number;
		cause?: {
			httpCode?: number;
			statusCode?: number;
			error?: unknown;
			response?: { body?: unknown };
		};
		error?: unknown;
		response?: { body?: unknown };
		message?: string;
	};
	const statusCode =
		errorObj.httpCode ||
		errorObj.statusCode ||
		errorObj.cause?.httpCode ||
		errorObj.cause?.statusCode ||
		400;

	let backendResponse: Record<string, unknown> | null = null;
	if (errorObj.error && typeof errorObj.error === 'object') {
		backendResponse = errorObj.error as Record<string, unknown>;
	} else if (errorObj.cause?.error && typeof errorObj.cause.error === 'object') {
		backendResponse = errorObj.cause.error as Record<string, unknown>;
	} else if (errorObj.response?.body) {
		backendResponse = errorObj.response.body as Record<string, unknown>;
	} else if (errorObj.cause?.response?.body) {
		backendResponse = errorObj.cause.response.body as Record<string, unknown>;
	}

	// `error` may be a nested { message, code } object or a code string; prefer the
	// human-readable message (mirrors buildApiErrorMessage) so users don't see
	// "[object Object]" or a code that n8n mangles into a bogus connection error.
	const nestedError =
		backendResponse && typeof backendResponse.error === 'object' && backendResponse.error !== null
			? (backendResponse.error as Record<string, unknown>)
			: null;
	const apiErrorMessage = nestedError
		? ((nestedError.message as string) || JSON.stringify(nestedError))
		: ((backendResponse?.message as string) || (backendResponse?.error as string));
	const apiErrorCode =
		(backendResponse?.code as string) ||
		(nestedError?.code as string) ||
		stringErrorCode(backendResponse);

	let errorMessage = apiErrorMessage || errorObj.message || 'Request failed';
	const errorCode = (backendResponse?.type as string) || apiErrorCode || '';

	if (
		backendResponse?.data &&
		typeof backendResponse.data === 'object' &&
		Array.isArray((backendResponse.data as { errors?: unknown[] }).errors)
	) {
		const errorDetails = (
			backendResponse.data as { errors: { path?: string[]; message?: string }[] }
		).errors
			.map((e) => {
				const fieldPath = e.path?.join('.') || 'unknown';
				return `${fieldPath}: ${e.message}`;
			})
			.join('; ');
		if (errorDetails) errorMessage = errorDetails;
	}

	return {
		message: `${errorMessage}${formatErrorCode(errorCode)}\n\nHTTP Status: ${statusCode}`,
		code: apiErrorCode || 'UnknownError',
		statusCode,
	};
}

/**
 * Detect a downloaded file's type from its magic bytes, so binary outputs get a
 * sensible filename + MIME type. Mirrors the SDK's `detectFileType`.
 */
export function detectBinaryType(buffer: Buffer): { extension: string; mimeType: string } {
	if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
		return { extension: 'pdf', mimeType: 'application/pdf' };
	}
	if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
		const head = buffer.toString('utf8', 0, Math.min(buffer.length, 2000));
		if (head.includes('ppt/')) {
			return {
				extension: 'pptx',
				mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			};
		}
		return {
			extension: 'docx',
			mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		};
	}
	return { extension: 'bin', mimeType: 'application/octet-stream' };
}

/** Tiny helper: parse a JSON-string node parameter, throwing a clean error. */
export function parseJsonParameter(
	ctx: IExecuteFunctions,
	value: string,
	parameterName: string,
	itemIndex: number,
): unknown {
	if (value === undefined || value === null || value === '') return undefined;
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value);
	} catch (parseError) {
		throw new NodeOperationError(
			ctx.getNode(),
			`Invalid JSON in ${parameterName}: ${(parseError as Error).message}\n\nHTTP Status: 400`,
			{ itemIndex },
		);
	}
}
