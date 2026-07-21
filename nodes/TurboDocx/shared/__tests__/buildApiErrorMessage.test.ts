import { buildApiError, buildApiErrorMessage } from '../GenericFunctions';

describe('buildApiErrorMessage', () => {
	it('extracts the message from a nested {error:{message,code}} body (TurboQuote shape)', () => {
		const msg = buildApiErrorMessage({ error: { message: 'Deliverable not found', code: 'DELIVERABLE_NOT_FOUND' } }, 404);
		expect(msg).toContain('Deliverable not found');
		expect(msg).not.toContain('[object Object]');
	});

	it('prefers the human message over a code-style error string', () => {
		// Deliverable backend returns both; the code "TemplateNotFound" otherwise gets
		// mangled by n8n into a bogus DNS/host error (contains "ENOTFOUND").
		const msg = buildApiErrorMessage({ error: 'TemplateNotFound', message: 'Template with id abc not found' }, 404);
		expect(msg).toContain('Template with id abc not found');
		expect(msg).not.toMatch(/^TemplateNotFound/);
	});

	it('falls back to a simple {error:"..."} string when there is no message', () => {
		const msg = buildApiErrorMessage({ error: 'Forbidden' }, 403);
		expect(msg).toContain('Forbidden');
		expect(msg).toContain('HTTP Status: 403');
	});

	it('uses {message,type} and appends the code', () => {
		const msg = buildApiErrorMessage({ message: 'Validation failed', type: 'ValidationError' }, 400);
		expect(msg).toContain('Validation failed');
		expect(msg).toContain('[ValidationError]');
	});

	/**
	 * The backend's domain ValidationError serialises as `{ message, error: "<Code>", data }`
	 * (RapidDocxBackend src/handlers/Error/ValidationErrorHandler.ts and the TurboQuote routes):
	 * the machine code sits in `error` as a STRING, not in `type`/`code`. It used to be dropped,
	 * so a workflow could not branch on WHY a send was refused.
	 */
	it.each([
		'QuoteHasNoLineItems',
		'QuoteExpired',
		'QuoteNotSendable',
		'QuoteValidUntilRequired',
		'QuoteContactRequired',
		'QuoteCustomerInactive',
		'SenderEmailRequired',
	])('surfaces the %s code alongside the human message', (code) => {
		const msg = buildApiErrorMessage(
			{ message: 'Cannot send quote', error: code, data: { quoteId: 'q-1' } },
			400,
		);
		expect(msg).toContain('Cannot send quote');
		expect(msg).toContain(`[${code}]`);
		expect(msg).toContain('HTTP Status: 400');
	});

	it('omits a code that n8n would mangle into a bogus connection error', () => {
		// "TemplateNotFound" upper-cases to "TEMPLAT|ENOTFOUND"; NodeOperationError replaces any
		// message containing a COMMON_ERRORS token, so appending it would destroy the message.
		const msg = buildApiErrorMessage(
			{ message: 'Template with id abc not found', error: 'TemplateNotFound' },
			404,
		);
		expect(msg).toContain('Template with id abc not found');
		expect(msg.toUpperCase()).not.toContain('ENOTFOUND');
	});

	it('does not repeat a bare error string as its own code', () => {
		expect(buildApiErrorMessage({ error: 'Forbidden' }, 403)).not.toContain('[Forbidden]');
	});

	it('still surfaces Celebrate/Joi nested validation errors', () => {
		const msg = buildApiErrorMessage({ data: { errors: [{ path: ['name'], message: 'name is required' }] } }, 400, true);
		expect(msg).toContain('name: name is required');
	});
});

/**
 * The structured form. `continueOnFail` output carries `code` and `statusCode` as real fields
 * so a workflow can branch with an IF node on `code`, instead of substring-matching a blob
 * that also contains the HTTP status.
 */
describe('buildApiError', () => {
	it('returns the code as a field, not only inside the message', () => {
		const parts = buildApiError(
			{ message: 'Cannot send a quote with no line items.', error: 'QuoteHasNoLineItems' },
			400,
		);

		expect(parts.code).toBe('QuoteHasNoLineItems');
		expect(parts.statusCode).toBe(400);
		expect(parts.message).toContain('Cannot send a quote with no line items.');
	});

	it('keeps the HTTP status out of the message so it can go in the description', () => {
		const parts = buildApiError({ message: 'Quote not found' }, 404);

		expect(parts.message).not.toContain('HTTP Status');
		expect(parts.statusCode).toBe(404);
	});

	it('returns an empty code when the API sent none', () => {
		const parts = buildApiError({ message: 'Something broke' }, 500);

		expect(parts.code).toBe('');
	});

	it('omits a code n8n would mangle, but still reports it structurally', () => {
		// "TemplateNotFound" upper-cases to contain ENOTFOUND, which n8n rewrites into a bogus
		// connection error — so it is kept out of the display string but IS still usable as a
		// field, which is the better place to branch on it anyway.
		const parts = buildApiError({ message: 'Template is gone', error: 'TemplateNotFound' }, 404);

		expect(parts.message).not.toContain('TemplateNotFound');
		expect(parts.code).toBe('TemplateNotFound');
	});

	it('still renders a single display string via buildApiErrorMessage', () => {
		const msg = buildApiErrorMessage(
			{ message: 'Cannot send a quote with no line items.', error: 'QuoteHasNoLineItems' },
			400,
		);

		expect(msg).toContain('QuoteHasNoLineItems');
		expect(msg).toContain('HTTP Status: 400');
	});
});
