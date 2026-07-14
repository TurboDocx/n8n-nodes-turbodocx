import { buildApiErrorMessage } from '../GenericFunctions';

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

	it('still surfaces Celebrate/Joi nested validation errors', () => {
		const msg = buildApiErrorMessage({ data: { errors: [{ path: ['name'], message: 'name is required' }] } }, 400, true);
		expect(msg).toContain('name: name is required');
	});
});
