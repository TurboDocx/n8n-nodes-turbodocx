import { IExecuteFunctions, IHookFunctions } from 'n8n-workflow';
import {
	buildUserAgent,
	detectTimezone,
	NODE_PACKAGE_VERSION,
	resolveClientContextHeaders,
} from '../clientContext';
import { turboDocxApiRequest, turboDocxApiRequestBinary } from '../GenericFunctions';
import { TurboDocxTrigger } from '../../../TurboDocxTrigger/TurboDocxTrigger.node';

/**
 * The n8n node authenticates with an API key, which the TurboDocx backend would otherwise
 * record in the signature audit trail as a generic "API Client" device. These headers identify
 * the call as the n8n node and carry the host timezone/locale. The backend only reads them when
 * the User-Agent starts with the canonical `@turbodocx/sdk/<version>` token
 * (parseTurboDocxSdkUserAgent), so that prefix is asserted here.
 *
 * NOTE: unlike the language SDKs there is no OS/arch/hostname or device fingerprint — n8n Cloud
 * bans `os` and the `process` global in community nodes, so they are unreachable. See the
 * clientContext source header.
 */
describe('clientContext', () => {
	describe('buildUserAgent', () => {
		it('starts with the canonical @turbodocx/sdk/<version> token the backend keys on', () => {
			expect(buildUserAgent()).toMatch(/^@turbodocx\/sdk\/[\w.+-]+/);
		});

		it('identifies the call as n8n in the runtime segment', () => {
			// The backend surfaces the first parenthesised segment as the audit "device client";
			// leading with n8n makes the audit trail show the call came from the n8n node.
			expect(buildUserAgent()).toContain('n8n');
		});

		it('parses cleanly under the backend User-Agent grammar (prefix + parenthesised env)', () => {
			// Mirror of the backend's parseTurboDocxSdkUserAgent regex — a malformed UA would be
			// rejected there and the call would fall back to the generic "API Client".
			const backendRegex = /^@turbodocx\/sdk\/([\w.+-]+)(?:\s*\((.*)\))?\s*$/i;
			expect(buildUserAgent()).toMatch(backendRegex);
		});
	});

	describe('detectTimezone', () => {
		it('returns a string (the host IANA timezone, or empty if unavailable)', () => {
			expect(typeof detectTimezone()).toBe('string');
		});
	});

	describe('n8n Cloud restrictions', () => {
		it('reports a semver-shaped version in the User-Agent', () => {
			// NODE_PACKAGE_VERSION is hardcoded — require()/JSON import is banned by the
			// community-node lint, so it cannot be read from package.json even in a test.
			// Keeping the two in sync is a release-checklist step, not something asserted here.
			expect(NODE_PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+/);
			expect(buildUserAgent()).toContain(NODE_PACKAGE_VERSION);
		});

		it('sends no device fingerprint, since hostname/platform/arch are unreachable', () => {
			// A fingerprint not derived from host identity would be misleading, so it is omitted
			// rather than faked.
			expect(resolveClientContextHeaders()).not.toHaveProperty('X-Device-Fingerprint');
		});
	});

	describe('resolveClientContextHeaders', () => {
		it('always includes a User-Agent and never emits a blank header value', () => {
			const headers = resolveClientContextHeaders();
			expect(headers['User-Agent']).toBeTruthy();
			for (const value of Object.values(headers)) {
				expect(value).not.toBe('');
				// No CR/LF/control chars that would corrupt the header or be rejected by the transport.
				// eslint-disable-next-line no-control-regex -- control chars are exactly what we assert against
				expect(value).not.toMatch(/[\r\n\x00-\x1f\x7f]/);
			}
		});
	});
});

describe('turboDocxApiRequest attaches client-context headers', () => {
	function mockCtx(captured: { options?: Record<string, unknown> }): IExecuteFunctions {
		return {
			getCredentials: jest.fn(async () => ({ baseUrl: 'https://api.example.com' })),
			getNode: jest.fn(() => ({ name: 'TurboDocx' })),
			helpers: {
				requestWithAuthentication: jest.fn(async (_cred: string, options: Record<string, unknown>) => {
					captured.options = options;
					return { statusCode: 200, body: { ok: true } };
				}),
				httpRequestWithAuthentication: jest.fn(
					async (_cred: string, options: Record<string, unknown>) => {
						captured.options = options;
						return { statusCode: 200, body: { ok: true } };
					},
				),
			},
		} as unknown as IExecuteFunctions;
	}

	it('sends the audit User-Agent on a JSON request (modern helper)', async () => {
		const captured: { options?: Record<string, unknown> } = {};
		await turboDocxApiRequest(mockCtx(captured), { method: 'POST', endpoint: '/x', body: { a: 1 } });

		const headers = captured.options?.headers as Record<string, string>;
		expect(headers['User-Agent']).toMatch(/^@turbodocx\/sdk\//);
	});

	it('sends the audit User-Agent on a multipart request (legacy helper)', async () => {
		const captured: { options?: Record<string, unknown> } = {};
		await turboDocxApiRequest(mockCtx(captured), {
			method: 'POST',
			endpoint: '/turbosign/single/prepare-for-signing',
			multipart: true,
			body: { recipients: '[]', fields: '[]' },
		});

		const headers = captured.options?.headers as Record<string, string>;
		expect(headers['User-Agent']).toMatch(/^@turbodocx\/sdk\//);
	});

	// Downloads (quote PDF, signed document, deliverable source file) hit TurboDocx directly.
	// Without these headers they are audited as an anonymous "API Client" while every other
	// call from the same workflow reports the real host.
	it('sends the audit User-Agent on a binary download', async () => {
		const captured: { options?: Record<string, unknown> } = {};
		await turboDocxApiRequestBinary(mockCtx(captured), {
			method: 'GET',
			endpoint: '/v1/quotes/q-1/pdf',
		});

		const headers = captured.options?.headers as Record<string, string>;
		expect(headers['User-Agent']).toMatch(/^@turbodocx\/sdk\//);
	});
});

/**
 * The trigger's webhook-management calls (checkExists / create / delete) go through their own
 * request helper inside TurboDocxTrigger, not the shared one — so they need their own coverage
 * or they silently regress to the anonymous "API Client" identity.
 */
describe('TurboDocxTrigger webhook management attaches client-context headers', () => {
	it('sends the audit User-Agent on the checkExists lookup', async () => {
		const captured: { options?: Record<string, unknown> } = {};
		const ctx = {
			getCredentials: jest.fn(async () => ({ baseUrl: 'https://api.example.com' })),
			getNode: jest.fn(() => ({ name: 'TurboDocx Trigger' })),
			getNodeWebhookUrl: jest.fn(() => 'https://n8n.example.com/webhook/abc'),
			helpers: {
				httpRequestWithAuthentication: jest.fn(
					async (_cred: string, options: Record<string, unknown>) => {
						captured.options = options;
						return { statusCode: 200, body: { data: { urls: [] } } };
					},
				),
			},
		} as unknown as IHookFunctions;

		// webhookMethods is an instance field, not on the prototype.
		await new TurboDocxTrigger().webhookMethods.default.checkExists.call(ctx);

		const headers = captured.options?.headers as Record<string, string>;
		expect(headers['User-Agent']).toMatch(/^@turbodocx\/sdk\//);
	});
});
