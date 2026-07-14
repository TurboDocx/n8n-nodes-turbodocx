import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/**
 * The TurboSign read/action endpoints wrap their payload in a sole-key `{ data: … }`
 * envelope (RapidDocxBackend src/routes/TurboSign/index.ts — the status, void,
 * resend-email and audit-trail routes all `res.status(200).json({ data: { … } })`).
 *
 * These four ops used to run with the default `unwrap: 'none'`, so the node emitted the
 * envelope itself: `{{ $json.status }}` came back undefined because the value actually sat
 * at `$json.data.status`, which silently broke any downstream IF/branch on document status.
 *
 * The single-step prepare routes are the exception — they return a FLAT body with no `data`
 * key (SingleStepRoutes.ts), so they must stay unwrapped-as-is. Pinned here too, because
 * "fixing" them the same way would break them.
 */
describe('TurboSign response envelopes', () => {
	function run(params: Record<string, unknown>, body: unknown) {
		const http = jest.fn().mockResolvedValue(okResponse(body));
		const ctx = makeExecuteCtx({ itemCount: 1, params: { resource: 'turboSign', ...params }, http });
		return { ctx, http };
	}

	it('getStatus returns the status flat, not wrapped in data', async () => {
		const { ctx } = run(
			{ operation: 'getStatus', documentId: 'doc-1' },
			{ data: { status: 'completed' } },
		);

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(items[0].json).toEqual({ status: 'completed' });
		expect(items[0].json.data).toBeUndefined();
	});

	it('voidDocument returns the document fields flat', async () => {
		const { ctx } = run(
			{ operation: 'voidDocument', documentId: 'doc-1', voidReason: 'test' },
			{ data: { id: 'doc-1', name: 'NDA', status: 'voided', voidReason: 'test' } },
		);

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(items[0].json.id).toBe('doc-1');
		expect(items[0].json.status).toBe('voided');
	});

	it('resendEmail returns the result flat', async () => {
		const { ctx } = run(
			{ operation: 'resendEmail', documentId: 'doc-1', recipientIds: '["r-1"]' },
			{ data: { success: true, recipientCount: 1 } },
		);

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(items[0].json).toEqual({ success: true, recipientCount: 1 });
	});

	it('getAuditTrail exposes auditTrail at the top level', async () => {
		const { ctx } = run(
			{ operation: 'getAuditTrail', documentId: 'doc-1' },
			{ data: { document: { id: 'doc-1' }, auditTrail: [{ event: 'signed' }] } },
		);

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(items[0].json.auditTrail).toEqual([{ event: 'signed' }]);
	});

	it('prepareForReview is left alone — its body is already flat', async () => {
		const { ctx } = run(
			{
				operation: 'prepareForReview',
				fileInputMethod: 'url',
				fileLink: 'https://example.com/a.pdf',
				recipients: '[]',
				fields: '[]',
			},
			{ success: true, documentId: 'doc-9', status: 'draft', previewUrl: 'https://x' },
		);

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		// documentId must stay reachable at the top level for downstream chaining.
		expect(items[0].json.documentId).toBe('doc-9');
	});
});
