import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/**
 * `GET /turbosign/documents/{id}/recipients` answers "who did we send this to, who has
 * signed, who are we still waiting on, and have we emailed them".
 *
 * Two things about the payload are easy to get wrong and are pinned here:
 *
 *  - Each recipient carries BOTH `status` (the raw database value, only ever
 *    pending/viewed/completed) and `effectiveStatus` (the same with the document's
 *    terminal state layered on, so voided/expired are possible). A workflow that
 *    branches on "has this person signed" wants effectiveStatus. Collapsing the two
 *    would silently mislabel every signer on a voided document as still pending.
 *  - The response is wrapped in `{ data: ... }` and must be smart-unwrapped, like the
 *    sibling read operations.
 */
describe('TurboSign getRecipients', () => {
	const RESPONSE = {
		document: {
			id: 'doc-1',
			name: 'Mutual NDA',
			status: 'voided',
			createdOn: '2026-01-01T00:00:00.000Z',
			sentOn: '2026-01-02T08:59:00.000Z',
			expiresAt: null,
			sentBy: { name: 'Jane Sender', email: 'jane@acme.com' },
		},
		recipients: [
			{
				id: 'rec-1',
				name: 'John Signer',
				email: 'john@example.com',
				status: 'completed',
				effectiveStatus: 'completed',
				signedOn: '2026-02-01T10:00:00.000Z',
				signingOrder: 1,
				delivery: {
					firstSentOn: '2026-01-02T09:00:00.000Z',
					lastSentOn: '2026-01-09T09:00:00.000Z',
					totalSent: 3,
					reminderCount: 1,
					lastRemindedAt: '2026-01-09T09:00:00.000Z',
					warningCount: 0,
					lastWarningAt: null,
				},
			},
			{
				id: 'rec-2',
				name: 'Ada Signer',
				email: 'ada@example.com',
				status: 'pending',
				effectiveStatus: 'voided',
				signedOn: null,
				signingOrder: 2,
				delivery: {
					firstSentOn: '2026-01-02T09:00:00.000Z',
					lastSentOn: '2026-01-02T09:00:00.000Z',
					totalSent: 1,
					reminderCount: 0,
					lastRemindedAt: null,
					warningCount: 0,
					lastWarningAt: null,
				},
			},
		],
		summary: { total: 2, pending: 0, viewed: 0, completed: 1, voided: 1, expired: 0, waitingOn: 0 },
	};

	function run(body: unknown = { data: RESPONSE }) {
		const http = jest.fn().mockResolvedValue(okResponse(body));
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'turboSign',
				operation: 'getRecipients',
				documentId: 'doc-1',
			},
			http,
		});
		return { ctx, http };
	}

	it('requests the recipients endpoint for the given document', async () => {
		const { ctx, http } = run();

		await TurboDocx.prototype.execute.call(ctx);

		expect(http).toHaveBeenCalledTimes(1);
		const request = http.mock.calls[0][1];
		expect(request.method).toBe('GET');
		expect(request.url).toBe('https://api.example.com/turbosign/documents/doc-1/recipients');
	});

	it('smart-unwraps the { data: ... } envelope', async () => {
		const { ctx } = run();

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		// The envelope must be stripped — a workflow reading json.recipients should not
		// have to reach through json.data.recipients.
		expect(items[0].json).not.toHaveProperty('data');
		expect((items[0].json as { recipients: unknown[] }).recipients).toHaveLength(2);
	});

	it('preserves both status and effectiveStatus per recipient', async () => {
		const { ctx } = run();

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		const recipients = (items[0].json as { recipients: Array<Record<string, unknown>> }).recipients;
		// A signer who completed before the void keeps their signature.
		expect(recipients[0].status).toBe('completed');
		expect(recipients[0].effectiveStatus).toBe('completed');
		// An unsigned signer on a voided document is stranded — the raw status still
		// reads "pending", which is exactly why effectiveStatus has to survive intact.
		expect(recipients[1].status).toBe('pending');
		expect(recipients[1].effectiveStatus).toBe('voided');
	});

	it('passes through the delivery block and the summary', async () => {
		const { ctx } = run();

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		const json = items[0].json as {
			recipients: Array<{ delivery: Record<string, unknown> }>;
			summary: Record<string, unknown>;
			document: { sentBy: Record<string, unknown>; sentOn: string };
		};
		expect(json.recipients[0].delivery.totalSent).toBe(3);
		expect(json.recipients[0].delivery.reminderCount).toBe(1);
		expect(json.summary).toEqual({
			total: 2,
			pending: 0,
			viewed: 0,
			completed: 1,
			voided: 1,
			expired: 0,
			waitingOn: 0,
		});
		expect(json.document.sentBy).toEqual({ name: 'Jane Sender', email: 'jane@acme.com' });
		expect(json.document.sentOn).toBe('2026-01-02T08:59:00.000Z');
	});
});
