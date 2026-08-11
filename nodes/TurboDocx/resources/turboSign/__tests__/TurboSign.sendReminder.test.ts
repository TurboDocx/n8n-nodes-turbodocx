import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/**
 * `POST /turbosign/documents/{id}/send-reminder` nudges a document's outstanding signers.
 *
 * The subtle part is the optional filter. `recipientIds` must contain at least one id WHEN THE
 * KEY IS PRESENT, so an empty array is rejected with a 400 — but leaving the node's field blank
 * is how a user says "remind everyone whose turn it is". The handler therefore has to omit the
 * key entirely rather than send `[]`, which is what these tests pin.
 */
describe('TurboSign sendReminder', () => {
	function run(reminderRecipientIds?: string) {
		const http = jest.fn().mockResolvedValue(
			okResponse({
				results: [
					{ recipientId: 'rec-1', status: 'sent', reminderCount: 2, phase: 'reminder' },
					{ recipientId: 'rec-2', status: 'skipped_wrong_order' },
				],
			}),
		);

		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'turboSign',
				operation: 'sendReminder',
				documentId: 'doc-1',
				...(reminderRecipientIds !== undefined ? { reminderRecipientIds } : {}),
			},
			http,
		});

		return { ctx, http };
	}

	it('posts to the send-reminder endpoint for the given document', async () => {
		const { ctx, http } = run();

		await TurboDocx.prototype.execute.call(ctx);

		const request = http.mock.calls[0][1];
		expect(request.method).toBe('POST');
		expect(request.url).toContain('/turbosign/documents/doc-1/send-reminder');
	});

	// Blank field = "remind everyone eligible". Sending `recipientIds: []` would be a guaranteed
	// 400, so the key has to be absent entirely.
	it('omits recipientIds when the field is left blank, so every eligible signer is reminded', async () => {
		const { ctx, http } = run('');

		await TurboDocx.prototype.execute.call(ctx);

		expect(http.mock.calls[0][1].body).not.toHaveProperty('recipientIds');
	});

	it('omits recipientIds when the field is absent entirely', async () => {
		const { ctx, http } = run();

		await TurboDocx.prototype.execute.call(ctx);

		expect(http.mock.calls[0][1].body).not.toHaveProperty('recipientIds');
	});

	// An explicitly empty JSON array is the same user intent as a blank field, and would 400.
	it('omits recipientIds when the field is an empty JSON array', async () => {
		const { ctx, http } = run('[]');

		await TurboDocx.prototype.execute.call(ctx);

		expect(http.mock.calls[0][1].body).not.toHaveProperty('recipientIds');
	});

	it('passes named recipient ids through when supplied', async () => {
		const { ctx, http } = run('["rec-1", "rec-2"]');

		await TurboDocx.prototype.execute.call(ctx);

		expect(http.mock.calls[0][1].body).toEqual({ recipientIds: ['rec-1', 'rec-2'] });
	});

	it('returns the per-recipient results, including the ones that were skipped', async () => {
		const { ctx } = run();

		const output = await TurboDocx.prototype.execute.call(ctx);

		const results = (output[0][0].json as { results: Array<{ status: string }> }).results;
		expect(results).toHaveLength(2);
		expect(results[0].status).toBe('sent');
		// A later-order signer is reported rather than silently dropped, so the workflow can tell
		// that nobody was actually emailed.
		expect(results[1].status).toBe('skipped_wrong_order');
	});
});
