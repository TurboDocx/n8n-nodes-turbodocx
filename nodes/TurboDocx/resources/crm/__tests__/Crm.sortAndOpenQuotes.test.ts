import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/** Company / contact / type list sorting, company email and the open quotes that block a delete. */

interface Captured {
	method?: string;
	url?: string;
	qs?: Record<string, unknown>;
	body?: unknown;
}

function capturingHttp(body: unknown) {
	const calls: Captured[] = [];
	const http = jest.fn(async (_cred: string, opts: Captured) => {
		calls.push(opts);
		return okResponse(body);
	});
	return { http, calls };
}

const emptyList = { data: { results: [], totalRecords: 0 } };

describe('CRM lists: sort', () => {
	it.each([
		['company', 'list', {}, '/v1/companies', 'contactCount'],
		['company', 'listContacts', { companyId: 'c-1' }, '/v1/companies/c-1/contacts', 'name'],
		['contact', 'list', {}, '/v1/contacts', 'createdOn'],
		['quoteType', 'list', {}, '/v1/types', 'usageCount'],
	])('%s → %s sends the sort', async (resource, operation, extra, path, sortBy) => {
		const { http, calls } = capturingHttp(emptyList);
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource, operation, limit: 5, ...extra, sort: { sortBy, sortDirection: 'desc' } },
			http,
		});

		await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].url).toBe(`https://api.example.com${path}`);
		expect(calls[0].qs).toEqual({ sortBy, sortDirection: 'desc', limit: 5, offset: 0 });
	});

	it('Contact → Get Many sends several companies', async () => {
		const { http, calls } = capturingHttp(emptyList);
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'contact', operation: 'list', limit: 5, filters: { companyIds: 'c-1, c-2' } },
			http,
		});

		await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].qs).toEqual({ companyIds: ['c-1', 'c-2'], limit: 5, offset: 0 });
	});
});

describe('Company email', () => {
	it('Create sends the email', async () => {
		const { http, calls } = capturingHttp({ data: { result: { id: 'c-1' } } });
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'company',
				operation: 'create',
				name: 'Acme',
				contacts: '[{"name":"Ana","email":"ana@acme.test"}]',
				additionalFields: { email: 'ap@acme.test' },
			},
			http,
		});

		await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].body).toMatchObject({ name: 'Acme', email: 'ap@acme.test' });
	});

	it('Update sends the email', async () => {
		const { http, calls } = capturingHttp({ data: { result: { id: 'c-1' } } });
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'company', operation: 'update', companyId: 'c-1', updateFields: { email: 'billing@acme.test' } },
			http,
		});

		await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].body).toEqual({ email: 'billing@acme.test' });
	});
});

describe('Get Open Quotes', () => {
	const openQuotes = {
		results: [{ id: 'q-1', quoteNumber: 'Q-1', name: 'Renewal', status: 'sent', updatedOn: '2026-10-01' }],
		totalRecords: 1,
	};

	it.each([
		['company', 'companyId', 'c-1', '/v1/companies/c-1/open-quotes'],
		['contact', 'contactId', 'ct-1', '/v1/contacts/ct-1/open-quotes'],
	])('%s → Get Open Quotes returns one item with the quotes and the count', async (resource, idParam, id, path) => {
		const { http, calls } = capturingHttp({ data: openQuotes });
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource, operation: 'listOpenQuotes', [idParam]: id },
			http,
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].method).toBe('GET');
		expect(calls[0].url).toBe(`https://api.example.com${path}`);
		expect(items).toHaveLength(1);
		expect(items[0].json).toEqual(openQuotes);
	});
});
