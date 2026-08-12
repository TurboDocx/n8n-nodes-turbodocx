import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';
import { quoteFields } from '../Quote.description';

/**
 * POST /v1/quotes/:id/decline used to require a `reason`. A DRAFT quote can now be declined —
 * a deal can die before the quote is ever sent — and a draft never reached the customer, so
 * there is nothing to justify and the backend made `reason` optional for it
 * (RapidDocxBackend src/routes/TurboQuotes/QuoteRoutes.ts → `Joi.string().max(190).allow('').optional()`).
 *
 * VOID is unchanged and still requires a reason, so the two operations can no longer share one
 * required field — decline and void now have their own.
 */
// The auth helper is called as (credentialName, options), so the request body is the SECOND arg.
function captureBody(params: Record<string, unknown>, result: Record<string, unknown>) {
	const capture: { body?: Record<string, unknown> } = {};
	const http = jest.fn(async (_cred: string, opts: { body?: Record<string, unknown> }) => {
		capture.body = opts.body;
		return okResponse({ data: { result } });
	});
	const ctx = makeExecuteCtx({ itemCount: 1, params, http });
	return { ctx, capture };
}

describe('Quote decline — optional reason', () => {
	it('sends the decline without a reason when none is given', async () => {
		const { ctx, capture } = captureBody(
			{ resource: 'quote', operation: 'decline', quoteId: 'q-1', reason: '' },
			{ id: 'q-1', status: 'declined' },
		);

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(items[0].json.status).toBe('declined');
		// An empty reason must be omitted entirely rather than sent as "" — the draft simply has none.
		expect(capture.body).toEqual({});
	});

	it('still forwards the reason when the user supplies one', async () => {
		const { ctx, capture } = captureBody(
			{
				resource: 'quote',
				operation: 'decline',
				quoteId: 'q-2',
				reason: 'Budget cut for this quarter',
			},
			{ id: 'q-2', status: 'declined' },
		);

		await TurboDocx.prototype.execute.call(ctx);

		expect(capture.body).toEqual({ reason: 'Budget cut for this quarter' });
	});

	it('still sends the reason on a void', async () => {
		const { ctx, capture } = captureBody(
			{ resource: 'quote', operation: 'void', quoteId: 'q-3', voidReason: 'Pulled internally' },
			{ id: 'q-3', status: 'voided' },
		);

		await TurboDocx.prototype.execute.call(ctx);

		expect(capture.body).toEqual({ reason: 'Pulled internally' });
	});

	it('marks the decline reason optional and the void reason required in the node UI', () => {
		const declineReason = quoteFields.find(
			field =>
				field.name === 'reason' &&
				(field.displayOptions?.show?.operation as string[] | undefined)?.includes('decline'),
		);
		const voidReason = quoteFields.find(
			field =>
				field.name === 'voidReason' &&
				(field.displayOptions?.show?.operation as string[] | undefined)?.includes('void'),
		);

		// A draft has no reason to give, so n8n must not block the node on it.
		expect(declineReason?.required).toBeFalsy();
		// Void is only reachable from `sent`, where the backend still demands a reason.
		expect(voidReason?.required).toBe(true);
	});
});
