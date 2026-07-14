import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/**
 * GET /v1/quotes/:id returns `{ data: { result, statusInfo } }` — `statusInfo` (expiry and
 * derived-status flags) is a SIBLING of `result`, not nested inside it
 * (RapidDocxBackend src/routes/TurboQuotes/QuoteRoutes.ts → `res.send({ data: { result: quote, statusInfo } })`).
 *
 * The handler used `unwrap: 'result'`, which peels `data` and then takes `.result` — silently
 * discarding statusInfo, so workflows could not branch on whether a quote had expired. The SDK
 * merges it onto the quote (js-sdk/src/modules/quote.ts → getQuote), and the node now does too.
 */
describe('Quote get — statusInfo', () => {
	it('merges statusInfo onto the quote instead of dropping it', async () => {
		const http = jest.fn().mockResolvedValue(
			okResponse({
				data: {
					result: { id: 'q-1', name: 'Acme Renewal', status: 'sent' },
					statusInfo: { isExpired: true, daysUntilExpiry: -3 },
				},
			}),
		);
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'quote', operation: 'get', quoteId: 'q-1' },
			http,
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		// The quote itself is still flat at the top level.
		expect(items[0].json.id).toBe('q-1');
		expect(items[0].json.status).toBe('sent');
		// ...and the sibling statusInfo survived.
		expect(items[0].json.statusInfo).toEqual({ isExpired: true, daysUntilExpiry: -3 });
	});

	it('still returns a flat quote when the API sends no statusInfo', async () => {
		const http = jest
			.fn()
			.mockResolvedValue(okResponse({ data: { result: { id: 'q-2', name: 'No Status' } } }));
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'quote', operation: 'get', quoteId: 'q-2' },
			http,
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(items[0].json).toEqual({ id: 'q-2', name: 'No Status' });
		expect(items[0].json.statusInfo).toBeUndefined();
	});
});
