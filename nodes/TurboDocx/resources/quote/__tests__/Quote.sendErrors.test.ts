import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx } from '../../../__tests__/helpers';

/**
 * End-to-end check that a typed backend refusal survives the node's error layer.
 *
 * POST /v1/quotes/:id/send answers a domain ValidationError as
 * `{ message, error: "<Code>", data }` (RapidDocxBackend src/handlers/Error/ValidationErrorHandler.ts).
 * The code lives in `error` as a string — the node used to keep only `message`, so the user saw
 * "Quote must have at least one line item" with no machine code to branch on.
 */
describe('Quote send — typed backend error codes reach the user', () => {
	it('surfaces QuoteHasNoLineItems in the thrown node error', async () => {
		const http = jest.fn().mockResolvedValue({
			statusCode: 400,
			body: {
				message: 'Quote must have at least one line item before sending',
				error: 'QuoteHasNoLineItems',
				data: { quoteId: 'q-1' },
			},
		});
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'quote', operation: 'send', quoteId: 'q-1', sendOptions: {} },
			http,
		});

		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toThrow(
			/at least one line item.*\[QuoteHasNoLineItems\]/s,
		);
	});
});
