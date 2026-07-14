import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/**
 * The backend marks both webhook arrays `.min(1).required()` inside the update schema
 * (RapidDocxBackend src/models/Webhook/IWebhook.ts — webhookUrlsSchema / webhookEventsSchema),
 * so an EMPTY array is a 400 ("At least one webhook URL is required"), not a no-op.
 *
 * The Update Fields collection defaults `urls` to '[]' and `events` to [], so simply ADDING the
 * field in the UI and not touching it used to forward an empty array and fail the request. An
 * untouched field must mean "leave this alone".
 */
describe('Webhook update — empty arrays', () => {
	function run(updateFields: Record<string, unknown>) {
		const http = jest.fn().mockResolvedValue(okResponse({ data: { name: 'signature' } }));
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'webhook', operation: 'update', updateFields },
			http,
		});
		return { ctx, http };
	}

	const sentBody = (http: jest.Mock) => http.mock.calls[0][1].body;

	it('omits an untouched (empty) urls array instead of sending []', async () => {
		const { ctx, http } = run({ urls: '[]', isActive: true });

		await TurboDocx.prototype.execute.call(ctx);

		expect(sentBody(http)).toEqual({ isActive: true });
		expect(sentBody(http).urls).toBeUndefined();
	});

	it('omits an untouched (empty) events array instead of sending []', async () => {
		const { ctx, http } = run({ events: [], isActive: false });

		await TurboDocx.prototype.execute.call(ctx);

		expect(sentBody(http)).toEqual({ isActive: false });
		expect(sentBody(http).events).toBeUndefined();
	});

	it('still sends both when they are actually populated', async () => {
		const { ctx, http } = run({
			urls: '["https://example.com/hook"]',
			events: ['signature.document.completed'],
		});

		await TurboDocx.prototype.execute.call(ctx);

		expect(sentBody(http)).toEqual({
			urls: ['https://example.com/hook'],
			events: ['signature.document.completed'],
		});
	});
});
