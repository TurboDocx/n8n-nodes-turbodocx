import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/**
 * Reminder & expiration schedule sent at signing time on `POST
 * /turbosign/single/prepare-for-signing`.
 *
 * The send path is multipart/form-data through the legacy formData helper, which only accepts
 * string/Buffer parts. So the node stringifies booleans and `maxReminders` to scalar strings and
 * encodes each Duration as a JSON string `{ value, unit }` — the shape the backend's
 * `parseMultipartScheduleDurations` middleware decodes. Every field is optional: it is a
 * `collection` option, so it is `undefined` until the user adds it, and only then is it appended.
 * Anything left unset is omitted from the body so it inherits the organization default.
 */
describe('TurboSign schedule-on-send (prepareForSigning)', () => {
	function run(signatureSchedule?: Record<string, unknown>) {
		const http = jest.fn().mockResolvedValue(okResponse({ id: 'doc-1', status: 'sent' }));
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'turboSign',
				operation: 'prepareForSigning',
				fileInputMethod: 'url',
				fileLink: 'https://example.com/agreement.pdf',
				recipients: '[{"name":"Client","email":"client@example.com","signingOrder":1}]',
				fields: '[]',
				...(signatureSchedule !== undefined ? { signatureSchedule } : {}),
			},
			http,
		});
		return { ctx, http };
	}

	it('encodes booleans and maxReminders as scalar strings and durations as JSON strings', async () => {
		const { ctx, http } = run({
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

		const formData = http.mock.calls[0][1].formData;
		expect(formData.remindersEnabled).toBe('true');
		expect(formData.maxReminders).toBe('5');
		expect(formData.reminderDelay).toBe(JSON.stringify({ value: 2, unit: 'days' }));
		expect(formData.reminderInterval).toBe(JSON.stringify({ value: 12, unit: 'hours' }));
		expect(formData.expirationEnabled).toBe('true');
		expect(formData.expireAfter).toBe(JSON.stringify({ value: 30, unit: 'days' }));
	});

	it('omits every schedule field when the user configured none, so the org defaults apply', async () => {
		const { ctx, http } = run();

		await TurboDocx.prototype.execute.call(ctx);

		const formData = http.mock.calls[0][1].formData;
		for (const key of [
			'remindersEnabled',
			'maxReminders',
			'reminderDelay',
			'reminderInterval',
			'expirationEnabled',
			'expireAfter',
			'expirationWarning',
			'expirationWarningInterval',
		]) {
			expect(formData).not.toHaveProperty(key);
		}
	});

	// A meaningful maxReminders of 0 ("send none") must survive, and a boolean explicitly set to
	// false must be forwarded — both are distinct from "not set". Durations left at 0 are the
	// degenerate/unset case and must NOT be sent.
	it('forwards a deliberate maxReminders 0 and remindersEnabled false, but drops a zero duration', async () => {
		const { ctx, http } = run({
			remindersEnabled: false,
			maxReminders: 0,
			reminderDelayValue: 0,
			reminderDelayUnit: 'days',
		});

		await TurboDocx.prototype.execute.call(ctx);

		const formData = http.mock.calls[0][1].formData;
		expect(formData.remindersEnabled).toBe('false');
		expect(formData.maxReminders).toBe('0');
		expect(formData).not.toHaveProperty('reminderDelay');
	});

	// expirationWarning is the ONE duration the backend accepts as 0 ("never warn"), so a
	// deliberate 0 must be sent — while a 0 on any other duration is still dropped as degenerate.
	it('sends expirationWarning=0 (never warn) but drops a zero expireAfter', async () => {
		const { ctx, http } = run({
			expirationEnabled: true,
			expirationWarningValue: 0,
			expirationWarningUnit: 'days',
			expireAfterValue: 0,
			expireAfterUnit: 'days',
		});

		await TurboDocx.prototype.execute.call(ctx);

		const formData = http.mock.calls[0][1].formData;
		expect(formData.expirationWarning).toBe(JSON.stringify({ value: 0, unit: 'days' }));
		expect(formData).not.toHaveProperty('expireAfter');
	});
});
