import { NodeOperationError } from 'n8n-workflow';
import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/**
 * Create Embedded Signature is the n8n counterpart of the SDK's TurboSign.createEmbeddedSignature:
 * one operation that (1) sends a document via prepare-for-signing, then (2) mints a per-recipient
 * embedded signing URL. These tests pin the mapping and the turn-aware degradation:
 *
 *  - The per-recipient identity/OTP dropdown maps to the API's `identityVerification` block
 *    (emailOtp → { mode:'otp', channel:'email' }; smsOtp → { mode:'otp', channel:'sms' } + phone),
 *    and SMS-without-phone fails fast (mirrors the SDK's validateRecipientsIdentity).
 *  - The send suppresses recipient emails by default (`sendEmail:false`) so the host owns the UX.
 *  - When the backend refuses to mint a URL for a signer whose turn hasn't come
 *    (`RecipientNotInTurn` / 409), that recipient is returned with `embedUrl:null` +
 *    `status:'pending'` rather than the whole operation throwing.
 */
describe('TurboSign createEmbeddedSignature', () => {
	/** Dispatch the two request kinds (send vs mint) by URL, capturing what was sent. */
	function makeHttp(mintResponders: Record<string, unknown>) {
		const capture: { sendBody?: Record<string, unknown>; mintBodies: Record<string, unknown>[] } = {
			mintBodies: [],
		};
		const http = jest.fn(
			async (_cred: string, opts: { url: string; body?: Record<string, unknown> }) => {
				if (opts.url.endsWith('/prepare-for-signing')) {
					capture.sendBody = opts.body;
					return okResponse({
						success: true,
						documentId: 'doc-9',
						status: 'under_review',
						recipients: [
							{ id: 'rec-1', email: 'john@example.com', name: 'John Doe' },
							{ id: 'rec-2', email: 'jane@example.com', name: 'Jane Smith' },
						],
					});
				}
				// signing-url mint — respond per recipientId
				const recipientId = opts.body?.recipientId as string;
				capture.mintBodies.push(opts.body ?? {});
				return mintResponders[recipientId];
			},
		);
		return { http, capture };
	}

	const readyMint = (url: string, mode = 'otp', pendingChecks: string[] = ['email_otp']) =>
		okResponse({
			data: { results: { url, recipientId: 'x', identityVerificationMode: mode, pendingChecks } },
		});

	it('sends a single email-OTP recipient (sendEmail:false) and returns a ready embed URL', async () => {
		const { http, capture } = makeHttp({
			'rec-1': readyMint('https://embed/rec1'),
		});
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'turboSign',
				operation: 'createEmbeddedSignature',
				fileInputMethod: 'url',
				fileLink: 'https://example.com/contract.pdf',
				embeddedRecipients: {
					recipient: [
						{
							name: 'John Doe',
							email: 'john@example.com',
							identityVerification: 'emailOtp',
							signingOrder: 0,
							signature: '{signature1}',
							date: '{date1}',
						},
					],
				},
				additionalFields: { senderEmail: 'sales@acme.com' },
			},
			http,
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		// Send body: sendEmail false, recipients carry the mapped identityVerification, fields expanded.
		const recipients = JSON.parse(capture.sendBody!.recipients as string);
		expect(capture.sendBody!.sendEmail).toBe(false);
		expect(capture.sendBody!.senderEmail).toBe('sales@acme.com');
		expect(recipients[0]).toEqual({
			name: 'John Doe',
			email: 'john@example.com',
			signingOrder: 1,
			identityVerification: { mode: 'otp', channel: 'email' },
		});
		const fields = JSON.parse(capture.sendBody!.fields as string);
		expect(fields).toEqual([
			{
				type: 'signature',
				recipientEmail: 'john@example.com',
				template: {
					anchor: '{signature1}',
					placement: 'replace',
					size: { width: 100, height: 30 },
				},
			},
			{
				type: 'date',
				recipientEmail: 'john@example.com',
				template: { anchor: '{date1}', placement: 'replace', size: { width: 75, height: 30 } },
			},
		]);

		// Result: documentId + one ready recipient carrying the embed URL and pending OTP step.
		expect(items[0].json.documentId).toBe('doc-9');
		const out = items[0].json.recipients as Array<Record<string, unknown>>;
		expect(out).toHaveLength(1);
		expect(out[0]).toEqual({
			recipientId: 'rec-1',
			name: 'John Doe',
			email: 'john@example.com',
			embedUrl: 'https://embed/rec1',
			status: 'ready',
			identityVerificationMode: 'otp',
			pendingChecks: ['email_otp'],
		});
	});

	it('maps SMS OTP to channel:sms plus the recipient phone', async () => {
		const { http, capture } = makeHttp({
			'rec-1': readyMint('https://embed/rec1', 'otp', ['sms_otp']),
		});
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'turboSign',
				operation: 'createEmbeddedSignature',
				fileInputMethod: 'url',
				fileLink: 'https://example.com/contract.pdf',
				embeddedRecipients: {
					recipient: [
						{
							name: 'John Doe',
							email: 'john@example.com',
							identityVerification: 'smsOtp',
							phone: '+13055551234',
							signature: '{signature1}',
						},
					],
				},
			},
			http,
		});

		await TurboDocx.prototype.execute.call(ctx);

		const recipients = JSON.parse(capture.sendBody!.recipients as string);
		expect(recipients[0].phone).toBe('+13055551234');
		expect(recipients[0].identityVerification).toEqual({ mode: 'otp', channel: 'sms' });
	});

	it('fails fast when SMS OTP is chosen without a phone number', async () => {
		const { http } = makeHttp({});
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'turboSign',
				operation: 'createEmbeddedSignature',
				fileInputMethod: 'url',
				fileLink: 'https://example.com/contract.pdf',
				embeddedRecipients: {
					recipient: [
						{
							name: 'John',
							email: 'john@example.com',
							identityVerification: 'smsOtp',
							signature: '{s1}',
						},
					],
				},
			},
			http,
		});

		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toThrow(NodeOperationError);
		// Nothing sent — validation runs before the send.
		expect(http).not.toHaveBeenCalled();
	});

	it('degrades a not-in-turn signer to embedUrl:null + status pending instead of throwing', async () => {
		const { http } = makeHttp({
			'rec-1': readyMint('https://embed/rec1'),
			'rec-2': {
				statusCode: 409,
				body: { message: "It is not this signer's turn", type: 'RecipientNotInTurn' },
			},
		});
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'turboSign',
				operation: 'createEmbeddedSignature',
				fileInputMethod: 'url',
				fileLink: 'https://example.com/contract.pdf',
				embeddedRecipients: {
					recipient: [
						{
							name: 'John Doe',
							email: 'john@example.com',
							identityVerification: 'none',
							signingOrder: 1,
							signature: '{s1}',
						},
						{
							name: 'Jane Smith',
							email: 'jane@example.com',
							identityVerification: 'none',
							signingOrder: 2,
							signature: '{s2}',
						},
					],
				},
			},
			http,
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		const out = items[0].json.recipients as Array<Record<string, unknown>>;
		expect(out).toHaveLength(2);
		// First signer: it's their turn.
		expect(out[0]).toMatchObject({
			email: 'john@example.com',
			status: 'ready',
			embedUrl: 'https://embed/rec1',
		});
		// Second signer: not their turn yet — degraded, not thrown.
		expect(out[1]).toMatchObject({ email: 'jane@example.com', status: 'pending', embedUrl: null });
	});

	it('degrades an already-signed signer to status completed (embedUrl:null)', async () => {
		const { http } = makeHttp({
			'rec-1': readyMint('https://embed/rec1'),
			'rec-2': {
				statusCode: 409,
				body: { message: 'Already signed', type: 'RecipientAlreadySigned' },
			},
		});
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'turboSign',
				operation: 'createEmbeddedSignature',
				fileInputMethod: 'url',
				fileLink: 'https://example.com/contract.pdf',
				embeddedRecipients: {
					recipient: [
						{
							name: 'John Doe',
							email: 'john@example.com',
							identityVerification: 'none',
							signingOrder: 1,
							signature: '{s1}',
						},
						{
							name: 'Jane Smith',
							email: 'jane@example.com',
							identityVerification: 'none',
							signingOrder: 2,
							signature: '{s2}',
						},
					],
				},
			},
			http,
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		const out = items[0].json.recipients as Array<Record<string, unknown>>;
		expect(out[1]).toMatchObject({
			email: 'jane@example.com',
			status: 'completed',
			embedUrl: null,
		});
	});

	it('surfaces the documentId when a genuine (non-degradable) mint error occurs after the send', async () => {
		const { http } = makeHttp({
			'rec-1': {
				statusCode: 403,
				body: { message: 'Embedded signing is not enabled', type: 'EmbeddedSigningNotEnabled' },
			},
		});
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'turboSign',
				operation: 'createEmbeddedSignature',
				fileInputMethod: 'url',
				fileLink: 'https://example.com/contract.pdf',
				embeddedRecipients: {
					recipient: [
						{
							name: 'John Doe',
							email: 'john@example.com',
							identityVerification: 'emailOtp',
							signingOrder: 1,
							signature: '{s1}',
						},
					],
				},
			},
			http,
		});

		// The document was already sent — the error must name the documentId so it isn't lost.
		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toThrow(/documentId doc-9/);
	});
});
