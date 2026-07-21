import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

function captureCreateBody(additionalFields: Record<string, unknown>) {
	const capture: { body?: Record<string, unknown> } = {};
	const http = jest.fn(async (_cred: string, opts: { body?: Record<string, unknown> }) => {
		capture.body = opts.body;
		return okResponse({ result: { id: 'q1' } });
	});
	const ctx = makeExecuteCtx({
		itemCount: 1,
		params: {
			resource: 'quote',
			operation: 'create',
			name: 'Q',
			companyId: 'c1',
			contactId: 'p1',
			additionalFields,
		},
		http,
	});
	return { ctx, capture };
}

describe('Quote create renewalPeriod / termDays coupling', () => {
	// Create used to DROP the renewal period here, quietly creating a quote on terms the user
	// never asked for. Both fields are optional collection entries, so a renewal period is
	// always deliberate — refuse rather than discard it.
	it('rejects a renewal period alongside a fixed term instead of silently dropping it', async () => {
		const { ctx, capture } = captureCreateBody({ termDays: 30, renewalPeriod: 'monthly' });
		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toThrow(
			/only applies to auto-renewing quotes/i,
		);
		expect(capture.body).toBeUndefined();
	});

	it('rejects a renewal period with no term at all (backend demands null)', async () => {
		const { ctx } = captureCreateBody({ renewalPeriod: 'monthly' });
		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toThrow(
			/only applies to auto-renewing quotes/i,
		);
	});

	it('sends renewalPeriod only for auto-renewal (termDays === -1)', async () => {
		const { ctx, capture } = captureCreateBody({ termDays: -1, renewalPeriod: 'annually' });
		await TurboDocx.prototype.execute.call(ctx);
		expect(capture.body).toMatchObject({ termDays: -1, renewalPeriod: 'annually' });
	});
});

describe('Quote createAndSend renewalPeriod / termDays coupling', () => {
	it('rejects a mismatched renewal period before creating anything', async () => {
		const http = jest.fn(async () => okResponse({ result: { id: 'q1' } }));
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'quote',
				operation: 'createAndSend',
				name: 'Q',
				companyId: 'c1',
				contactId: 'p1',
				createAndSendFields: { termDays: 30, renewalPeriod: 'monthly' },
			},
			http,
		});

		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toThrow(
			/only applies to auto-renewing quotes/i,
		);
		// Nothing was created — the quote is not left half-built with the wrong terms.
		expect(http).not.toHaveBeenCalled();
	});
});

/**
 * The same coupling applies on PATCH — `joiUpdateQuoteSchema` (RapidDocxBackend
 * src/models/TurboQuoteHeader/ITurboQuoteHeader.ts) declares
 * `renewalPeriod: Joi.when('termDays', { is: -1, then: required, otherwise: valid(null) })`.
 * An absent termDays takes the `otherwise` branch, so a lone renewalPeriod is rejected with
 * `"renewalPeriod" must be [null]`. Update used to send it anyway and just 400.
 */
function captureUpdate(updateFields: Record<string, unknown>) {
	const capture: { body?: Record<string, unknown> } = {};
	const http = jest.fn(async (_cred: string, opts: { body?: Record<string, unknown> }) => {
		capture.body = opts.body;
		return okResponse({ result: { id: 'q1' } });
	});
	const ctx = makeExecuteCtx({
		itemCount: 1,
		params: { resource: 'quote', operation: 'update', quoteId: 'q1', updateFields },
		http,
	});
	return { ctx, capture };
}

describe('Quote update renewalPeriod / termDays coupling', () => {
	it('rejects a renewal period without an auto-renewal term, with an actionable message', async () => {
		const { ctx } = captureUpdate({ renewalPeriod: 'monthly' });
		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toThrow(
			/only applies to auto-renewing quotes/i,
		);
	});

	it('rejects a renewal period alongside a fixed term', async () => {
		const { ctx } = captureUpdate({ termDays: 30, renewalPeriod: 'monthly' });
		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toThrow(
			/only applies to auto-renewing quotes/i,
		);
	});

	it('sends renewalPeriod when termDays is -1', async () => {
		const { ctx, capture } = captureUpdate({ termDays: -1, renewalPeriod: 'quarterly' });
		await TurboDocx.prototype.execute.call(ctx);
		expect(capture.body).toMatchObject({ termDays: -1, renewalPeriod: 'quarterly' });
	});

	it('still allows clearing the renewal period outright', async () => {
		const { ctx, capture } = captureUpdate({ clearRenewalPeriod: true });
		await TurboDocx.prototype.execute.call(ctx);
		expect(capture.body).toMatchObject({ renewalPeriod: null });
	});
});
