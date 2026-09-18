import { NodeOperationError } from 'n8n-workflow';
import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/**
 * `POST /turbosign/documents/{id}/signing-url` mints a single-use embedded signing URL for one
 * recipient of an already-sent document. Two things are pinned here:
 *
 *  - The response is DOUBLE-enveloped `{ data: { results: { url, ... } } }` and must unwrap to
 *    `results` (mirrors the SDK's manual `response.results`), so a workflow reads `$json.url`
 *    rather than `$json.data.results.url`.
 *  - The API requires EXACTLY ONE of recipientId / externalId. The node offers a selector dropdown
 *    (structurally one) but still rejects a blank value, and rejects a non-https returnUrl before
 *    the round-trip.
 */
describe('TurboSign createSigningUrl', () => {
	const RESULTS = {
		url: 'https://app.turbodocx.com/e-signature/embed/doc-1?token=abc',
		expiresAt: null,
		recipientId: 'rec-1',
		identityVerificationMode: 'otp',
		pendingChecks: ['email_otp'],
	};

	function run(params: Record<string, unknown>, body: unknown = { data: { results: RESULTS } }) {
		const http = jest.fn().mockResolvedValue(okResponse(body));
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'turboSign', operation: 'createSigningUrl', ...params },
			http,
		});
		return { ctx, http };
	}

	it('POSTs recipientId to the signing-url endpoint and unwraps { data: { results } }', async () => {
		const { ctx, http } = run({
			documentId: 'doc-1',
			recipientSelector: 'recipientId',
			recipientSelectorValue: 'rec-1',
			signingUrlOptions: {},
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(http).toHaveBeenCalledTimes(1);
		const request = http.mock.calls[0][1];
		expect(request.method).toBe('POST');
		expect(request.url).toBe('https://api.example.com/turbosign/documents/doc-1/signing-url');
		expect(request.body).toEqual({ recipientId: 'rec-1' });
		// Unwrapped to results — url + pendingChecks reachable at the top level.
		expect(items[0].json).not.toHaveProperty('data');
		expect(items[0].json.url).toBe(RESULTS.url);
		expect(items[0].json.pendingChecks).toEqual(['email_otp']);
		expect(items[0].json.identityVerificationMode).toBe('otp');
	});

	it('maps the externalId selector onto the externalId body field', async () => {
		const { ctx, http } = run({
			documentId: 'doc-1',
			recipientSelector: 'externalId',
			recipientSelectorValue: 'crm_customer_42',
			signingUrlOptions: {},
		});

		await TurboDocx.prototype.execute.call(ctx);

		expect(http.mock.calls[0][1].body).toEqual({ externalId: 'crm_customer_42' });
	});

	it('forwards an https returnUrl and a parsed identityAssertion', async () => {
		const assertion = {
			provider: 'CAPA',
			verificationId: 'ver_1',
			verifiedAt: '2026-01-01T00:00:00.000Z',
			subjectEmail: 'john@example.com',
		};
		const { ctx, http } = run({
			documentId: 'doc-1',
			recipientSelector: 'recipientId',
			recipientSelectorValue: 'rec-1',
			signingUrlOptions: {
				returnUrl: 'https://app.example.com/done',
				identityAssertion: JSON.stringify(assertion),
			},
		});

		await TurboDocx.prototype.execute.call(ctx);

		expect(http.mock.calls[0][1].body).toEqual({
			recipientId: 'rec-1',
			returnUrl: 'https://app.example.com/done',
			identityAssertion: assertion,
		});
	});

	it('throws when the recipient identifier is blank (exactly-one selector)', async () => {
		const { ctx, http } = run({
			documentId: 'doc-1',
			recipientSelector: 'recipientId',
			recipientSelectorValue: '   ',
			signingUrlOptions: {},
		});

		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toThrow(NodeOperationError);
		expect(http).not.toHaveBeenCalled();
	});

	it('rejects a non-https returnUrl before the round-trip', async () => {
		const { ctx, http } = run({
			documentId: 'doc-1',
			recipientSelector: 'recipientId',
			recipientSelectorValue: 'rec-1',
			signingUrlOptions: { returnUrl: 'http://insecure.example.com' },
		});

		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toThrow(/https/);
		expect(http).not.toHaveBeenCalled();
	});
});
