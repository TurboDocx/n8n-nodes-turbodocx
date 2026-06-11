import {
	IExecuteFunctions,
	IHookFunctions,
	IDataObject,
	IHttpRequestMethods,
	IHttpRequestOptions,
	NodeOperationError,
} from 'n8n-workflow';

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
 * Build a human-friendly error message from a TurboDocx API error body.
 * Handles the three shapes the API emits:
 *   1. { data: { errors: [{ path, message }] } }  (Celebrate/Joi validation)
 *   2. { error: "..." }                            (simple string)
 *   3. { message: "...", type: "..." }             (standard format)
 */
export function buildApiErrorMessage(
	rawBody: unknown,
	statusCode: number,
	includePath = false,
): string {
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

	let errorMessage = 'Request failed';
	const errorCode = obj ? ((obj.type as string) || (obj.code as string) || '') : '';

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
	} else if (obj && obj.error) {
		errorMessage = obj.error as string;
	} else if (obj && obj.message) {
		errorMessage = obj.message as string;
	} else if (typeof errorBody === 'string' && errorBody) {
		errorMessage = errorBody;
	}

	return `${errorMessage}${errorCode ? ` [${errorCode}]` : ''}\n\nHTTP Status: ${statusCode}`;
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

	const requestOptions: IHttpRequestOptions = {
		method: options.method,
		url: `${baseUrl}${options.endpoint}`,
		ignoreHttpStatusErrors: true,
		returnFullResponse: true,
	};
	if (options.qs && Object.keys(options.qs).length > 0) requestOptions.qs = options.qs;
	if (options.body !== undefined) {
		requestOptions.body = options.body;
		if (!options.multipart) requestOptions.json = true;
	}

	const response = (await ctx.helpers.httpRequestWithAuthentication.call(
		ctx,
		credentialName,
		requestOptions,
	)) as FullResponse;

	if (response.statusCode >= 400) {
		throw new NodeOperationError(
			ctx.getNode(),
			buildApiErrorMessage(response.body, response.statusCode),
			{ itemIndex },
		);
	}

	return applyUnwrap((response.body ?? {}) as IDataObject, options.unwrap);
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
		throw new NodeOperationError(
			ctx.getNode(),
			buildApiErrorMessage(response.body, response.statusCode),
			{ itemIndex },
		);
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

	const apiErrorMessage = (backendResponse?.error as string) || (backendResponse?.message as string);
	const apiErrorCode = backendResponse?.code as string;

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
		message: `${errorMessage}${errorCode ? ` [${errorCode}]` : ''}\n\nHTTP Status: ${statusCode}`,
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
