import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/**
 * Reminder & expiration schedule sent with a quote on the Send / Send With Deliverable /
 * Create-and-Send operations.
 *
 * Unlike the multipart TurboSign signature-send path (which stringifies everything through the
 * legacy formData helper), the quote-send endpoints are application/json (`json: true`, plain
 * object body). So the schedule is forwarded as NATIVE types: booleans stay booleans,
 * `maxReminders` stays a number, and each Duration is a real `{ value, unit }` OBJECT — no
 * JSON.stringify. Every field is optional (a `collection` option is `undefined` until the user
 * adds it), so anything left unset is omitted and inherits the organization default.
 */

// The eight fields the schedule can put on the send body.
const SCHEDULE_KEYS = [
	'remindersEnabled',
	'maxReminders',
	'reminderDelay',
	'reminderInterval',
	'expirationEnabled',
	'expireAfter',
	'expirationWarning',
	'expirationWarningInterval',
];

interface CapturedCall {
	body?: Record<string, unknown>;
	url?: string;
}

function makeHttp() {
	const calls: CapturedCall[] = [];
	const http = jest.fn(async (_cred: string, opts: { body?: Record<string, unknown>; url?: string }) => {
		calls.push({ body: opts.body, url: opts.url });
		// `result.id` is read by createAndSend to build the terminal /send URL.
		return okResponse({ result: { id: 'quote-1' } });
	});
	return { http, calls };
}

/**
 * Build a ctx for each of the three schedule-carrying operations. Each returns the captured HTTP
 * calls; the schedule always lands on the FINAL request (the terminal POST), which is the only
 * request for send / sendWithDeliverable and the closing `/send` for createAndSend.
 */
const OPERATIONS: Array<{
	name: string;
	build: (signatureSchedule?: Record<string, unknown>) => { ctx: ReturnType<typeof makeExecuteCtx>; calls: CapturedCall[] };
}> = [
	{
		name: 'send',
		build(signatureSchedule) {
			const { http, calls } = makeHttp();
			const ctx = makeExecuteCtx({
				itemCount: 1,
				params: {
					resource: 'quote',
					operation: 'send',
					quoteId: 'q-1',
					sendOptions: {},
					...(signatureSchedule !== undefined ? { signatureSchedule } : {}),
				},
				http,
			});
			return { ctx, calls };
		},
	},
	{
		name: 'sendWithDeliverable',
		build(signatureSchedule) {
			const { http, calls } = makeHttp();
			const ctx = makeExecuteCtx({
				itemCount: 1,
				params: {
					resource: 'quote',
					operation: 'sendWithDeliverable',
					quoteId: 'q-1',
					deliverableId: 'd-1',
					mergePosition: 'end',
					sendWithDeliverableOptions: {},
					...(signatureSchedule !== undefined ? { signatureSchedule } : {}),
				},
				http,
			});
			return { ctx, calls };
		},
	},
	{
		name: 'createAndSend',
		build(signatureSchedule) {
			const { http, calls } = makeHttp();
			const ctx = makeExecuteCtx({
				itemCount: 1,
				params: {
					resource: 'quote',
					operation: 'createAndSend',
					name: 'Q',
					companyId: 'c-1',
					contactId: 'p-1',
					createAndSendFields: {},
					items: '[]',
					bundleItems: '[]',
					...(signatureSchedule !== undefined ? { signatureSchedule } : {}),
				},
				http,
			});
			return { ctx, calls };
		},
	},
];

/** The body of the terminal (last) request — where every op puts the schedule. */
function terminalBody(calls: CapturedCall[]): Record<string, unknown> {
	return (calls[calls.length - 1].body ?? {}) as Record<string, unknown>;
}

describe.each(OPERATIONS)('Quote schedule-on-send ($name)', ({ build }) => {
	it('forwards booleans, maxReminders, and durations as NATIVE types (no JSON.stringify)', async () => {
		const { ctx, calls } = build({
			remindersEnabled: true,
			maxReminders: 5,
			reminderDelayValue: 2,
			reminderDelayUnit: 'days',
			reminderIntervalValue: 12,
			reminderIntervalUnit: 'hours',
			expirationEnabled: true,
			expireAfterValue: 30,
			expireAfterUnit: 'days',
		});

		await TurboDocx.prototype.execute.call(ctx);

		const body = terminalBody(calls);

		// Booleans stay booleans, not the strings the multipart path emits.
		expect(body.remindersEnabled).toBe(true);
		expect(typeof body.remindersEnabled).toBe('boolean');
		expect(body.expirationEnabled).toBe(true);
		expect(typeof body.expirationEnabled).toBe('boolean');

		// maxReminders stays a number.
		expect(body.maxReminders).toBe(5);
		expect(typeof body.maxReminders).toBe('number');

		// Durations are real { value, unit } OBJECTS, NOT JSON strings.
		expect(body.reminderDelay).toEqual({ value: 2, unit: 'days' });
		expect(typeof body.reminderDelay).toBe('object');
		expect(body.reminderInterval).toEqual({ value: 12, unit: 'hours' });
		expect(body.expireAfter).toEqual({ value: 30, unit: 'days' });
	});

	it('omits every schedule field when the user configured none, so the org defaults apply', async () => {
		// No signatureSchedule param at all -> handler reads the {} fallback.
		const { ctx, calls } = build();

		await TurboDocx.prototype.execute.call(ctx);

		const body = terminalBody(calls);
		for (const key of SCHEDULE_KEYS) {
			expect(body).not.toHaveProperty(key);
		}
	});

	// A deliberate maxReminders of 0 ("send none") and remindersEnabled explicitly false are
	// distinct from "not set" and must be forwarded. A duration left at 0 is the degenerate/unset
	// case and must be dropped.
	it('forwards a deliberate maxReminders 0 and remindersEnabled false, but drops a zero duration', async () => {
		const { ctx, calls } = build({
			remindersEnabled: false,
			maxReminders: 0,
			reminderDelayValue: 0,
			reminderDelayUnit: 'days',
		});

		await TurboDocx.prototype.execute.call(ctx);

		const body = terminalBody(calls);
		expect(body.remindersEnabled).toBe(false);
		expect(body.maxReminders).toBe(0);
		expect(body).not.toHaveProperty('reminderDelay');
	});

	// expirationWarning is the ONE duration the backend accepts as 0 ("never warn"), so a
	// deliberate 0 IS sent — while a 0 on any other duration is still dropped as degenerate.
	it('sends expirationWarning=0 (never warn) but drops a zero expireAfter', async () => {
		const { ctx, calls } = build({
			expirationEnabled: true,
			expirationWarningValue: 0,
			expirationWarningUnit: 'days',
			expireAfterValue: 0,
			expireAfterUnit: 'days',
		});

		await TurboDocx.prototype.execute.call(ctx);

		const body = terminalBody(calls);
		expect(body.expirationWarning).toEqual({ value: 0, unit: 'days' });
		expect(body).not.toHaveProperty('expireAfter');
	});
});

// createAndSend runs create -> (items) -> (bundles) -> send. The schedule must land on the
// TERMINAL `/send` POST, not the create call — assert both the placement and the endpoint.
describe('Quote schedule-on-send (createAndSend) lands on the terminal /send request', () => {
	it('puts the schedule on the final /send body, not the create body', async () => {
		const { ctx, calls } = OPERATIONS.find((o) => o.name === 'createAndSend')!.build({
			remindersEnabled: true,
			maxReminders: 3,
			reminderDelayValue: 1,
			reminderDelayUnit: 'days',
		});

		await TurboDocx.prototype.execute.call(ctx);

		// With no line items or bundles, the sequence is create then send: two calls.
		expect(calls).toHaveLength(2);

		const createCall = calls[0];
		const sendCall = calls[calls.length - 1];

		expect(createCall.url).toMatch(/\/v1\/quotes$/);
		expect(createCall.body).not.toHaveProperty('remindersEnabled');
		expect(createCall.body).not.toHaveProperty('reminderDelay');

		expect(sendCall.url).toMatch(/\/v1\/quotes\/quote-1\/send$/);
		expect(sendCall.body).toMatchObject({
			remindersEnabled: true,
			maxReminders: 3,
			reminderDelay: { value: 1, unit: 'days' },
		});
	});
});
