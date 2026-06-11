import { normalizeUnexpectedError } from '../GenericFunctions';

describe('normalizeUnexpectedError', () => {
	it('reads the message from a nested {error:{message,code}} backend body', () => {
		const r = normalizeUnexpectedError({ error: { message: 'Deliverable not found', code: 'DELIVERABLE_NOT_FOUND' }, statusCode: 404 });
		expect(r.message).toContain('Deliverable not found');
		expect(r.message).not.toContain('[object Object]');
		expect(r.code).toBe('DELIVERABLE_NOT_FOUND');
		expect(r.statusCode).toBe(404);
	});

	it('prefers the human message over a code-style error string', () => {
		const r = normalizeUnexpectedError({ response: { body: { error: 'TemplateNotFound', message: 'Template with id abc not found' } }, httpCode: 404 });
		expect(r.message).toContain('Template with id abc not found');
		expect(r.message).not.toMatch(/^TemplateNotFound/);
	});

	it('falls back to a simple {error:"..."} string in the response body', () => {
		const r = normalizeUnexpectedError({ response: { body: { error: 'Forbidden' } }, statusCode: 403 });
		expect(r.message).toContain('Forbidden');
		expect(r.statusCode).toBe(403);
	});
});
