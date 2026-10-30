import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/**
 * TurboQuote list sorting and filters, the quote summary / creators / next number reads,
 * custom line item images and named duplicates.
 */

interface Captured {
	method?: string;
	url?: string;
	uri?: string;
	qs?: Record<string, unknown>;
	body?: unknown;
	formData?: Record<string, unknown>;
}

function capturingHttp(body: unknown) {
	const calls: Captured[] = [];
	const http = jest.fn(async (_cred: string, opts: Captured) => {
		calls.push(opts);
		return okResponse(body);
	});
	return { http, calls };
}

describe('Quote → Get Many: sort and new filters', () => {
	it('sends the sort, several companies / currencies, expired, created by and Valid until', async () => {
		const { http, calls } = capturingHttp({ data: { results: [{ id: 'q-1' }], totalRecords: 1 } });
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'quote',
				operation: 'list',
				returnAll: false,
				limit: 10,
				filters: {
					statuses: ['sent', 'expired'],
					companyIds: 'c-1, c-2',
					currencies: ['USD', 'EUR'],
					createdBy: 'u-1',
					createdByApiKeys: true,
					validUntilWindow: 'thisMonth',
					validUntilFrom: '2026-10-01T00:00:00',
					validUntilTo: '2026-10-31T00:00:00',
				},
				sort: { sortBy: 'total', sortDirection: 'asc' },
			},
			http,
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].url).toBe('https://api.example.com/v1/quotes');
		expect(calls[0].qs).toEqual({
			statuses: ['sent', 'expired'],
			companyIds: ['c-1', 'c-2'],
			currencies: ['USD', 'EUR'],
			createdBy: ['u-1'],
			createdByApiKeys: true,
			validUntilWindow: 'thisMonth',
			validUntilFrom: '2026-10-01',
			validUntilTo: '2026-10-31',
			sortBy: 'total',
			sortDirection: 'asc',
			limit: 10,
			offset: 0,
		});
		expect(items[0].json.id).toBe('q-1');
	});

	it('sends no sort when none is chosen (the old order)', async () => {
		const { http, calls } = capturingHttp({ data: { results: [], totalRecords: 0 } });
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'quote', operation: 'list', returnAll: false, limit: 5 },
			http,
		});

		await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].qs).toEqual({ limit: 5, offset: 0 });
	});
});

describe('Quote → Get Summary / Get Creators', () => {
	it('gets the summary for the filters and returns it unwrapped', async () => {
		const summary = { currency: 'EUR', openPipeline: { total: 10, count: 1 } };
		const { http, calls } = capturingHttp({ data: { summary } });
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'quote',
				operation: 'getSummary',
				filters: { currencies: ['EUR', 'USD'], summaryCurrency: 'EUR' },
			},
			http,
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].method).toBe('GET');
		expect(calls[0].url).toBe('https://api.example.com/v1/quotes/summary');
		expect(calls[0].qs).toEqual({ currencies: ['EUR', 'USD'], summaryCurrency: 'EUR' });
		expect(items[0].json).toEqual(summary);
	});

	it('lists the creators, one item each', async () => {
		const creators = [
			{ id: 'u-1', name: 'Ana Lee', email: 'ana@acme.test', isAPIKey: false, apiKeyDeleted: false },
			{ id: 'u-2', name: 'Zapier key', email: null, isAPIKey: true, apiKeyDeleted: true },
		];
		const { http, calls } = capturingHttp({ data: { results: creators } });
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'quote', operation: 'listCreators' },
			http,
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].url).toBe('https://api.example.com/v1/quotes/creators');
		expect(items.map((item) => item.json)).toEqual(creators);
	});
});

describe('Quote → Duplicate with a name', () => {
	it('sends the name for the copy', async () => {
		const { http, calls } = capturingHttp({ data: { result: { id: 'q-2', name: 'Q4 renewal' } } });
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'quote', operation: 'duplicate', quoteId: 'q-1', duplicateFields: { name: 'Q4 renewal' } },
			http,
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].url).toBe('https://api.example.com/v1/quotes/q-1/duplicate');
		expect(calls[0].body).toEqual({ name: 'Q4 renewal' });
		expect(items[0].json.id).toBe('q-2');
	});

	it('sends no body without a name', async () => {
		const { http, calls } = capturingHttp({ data: { result: { id: 'q-2' } } });
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'quote', operation: 'duplicate', quoteId: 'q-1' },
			http,
		});

		await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].body).toBeUndefined();
	});
});

describe('Quote Number Config → Get Next Number', () => {
	it('returns the next number', async () => {
		const next = { nextNumber: 'Q-2026-0042', sequence: 42, canEdit: true };
		const { http, calls } = capturingHttp({ data: { results: next } });
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'quoteNumberConfig', operation: 'getNext' },
			http,
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].url).toBe('https://api.example.com/v1/quotes/number-config/next');
		expect(items[0].json).toEqual(next);
	});
});

describe('Quote Line Item → custom line item images', () => {
	it('Get Images returns one item per image', async () => {
		const { http, calls } = capturingHttp({ data: { results: [{ id: 'img-1' }, { id: 'img-2' }] } });
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'quoteLineItem', operation: 'getImages', quoteId: 'q-1', itemId: 'li-1' },
			http,
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].url).toBe('https://api.example.com/v1/quotes/q-1/items/li-1/images');
		expect(items.map((item) => item.json.id)).toEqual(['img-1', 'img-2']);
	});

	it('Get Quote Images returns the map keyed by line item', async () => {
		const byItem = { 'li-1': [{ id: 'img-1' }] };
		const { http, calls } = capturingHttp({ data: { results: byItem } });
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'quoteLineItem', operation: 'getQuoteImages', quoteId: 'q-1' },
			http,
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].url).toBe('https://api.example.com/v1/quotes/q-1/items/images');
		expect(items[0].json).toEqual(byItem);
	});

	it('Add Images uploads each binary property as an images part', async () => {
		const { http, calls } = capturingHttp({ data: { results: [{ id: 'img-1' }] } });
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'quoteLineItem',
				operation: 'addImages',
				quoteId: 'q-1',
				itemId: 'li-1',
				imageBinaryProperty: 'data',
			},
			http,
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].method).toBe('POST');
		expect(calls[0].uri).toBe('https://api.example.com/v1/quotes/q-1/items/li-1/images');
		const images = calls[0].formData?.images as Array<{ value: Buffer }>;
		expect(images).toHaveLength(1);
		expect(calls[0].formData?.data).toBeUndefined();
		expect(items[0].json.id).toBe('img-1');
	});

	it('Add Images refuses more than three images before calling the API', async () => {
		const { http } = capturingHttp({});
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'quoteLineItem',
				operation: 'addImages',
				quoteId: 'q-1',
				itemId: 'li-1',
				imageBinaryProperty: 'a,b,c,d',
			},
			http,
		});

		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toThrow(/at most 3/);
		expect(http).not.toHaveBeenCalled();
	});

	it('Reorder Images puts the ids first to last', async () => {
		const { http, calls } = capturingHttp({ data: { results: [{ id: 'img-2' }, { id: 'img-1' }] } });
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'quoteLineItem',
				operation: 'reorderImages',
				quoteId: 'q-1',
				itemId: 'li-1',
				imageIds: 'img-2, img-1',
			},
			http,
		});

		await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].method).toBe('PUT');
		expect(calls[0].url).toBe('https://api.example.com/v1/quotes/q-1/items/li-1/images/order');
		expect(calls[0].body).toEqual({ imageIds: ['img-2', 'img-1'] });
	});

	it('Remove Image deletes one image and returns the ones left', async () => {
		const { http, calls } = capturingHttp({ data: { results: [{ id: 'img-2' }] } });
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'quoteLineItem',
				operation: 'removeImage',
				quoteId: 'q-1',
				itemId: 'li-1',
				imageId: 'img-1',
			},
			http,
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].method).toBe('DELETE');
		expect(calls[0].url).toBe('https://api.example.com/v1/quotes/q-1/items/li-1/images/img-1');
		expect(items.map((item) => item.json.id)).toEqual(['img-2']);
	});
});

describe('Quote → Delete a sent quote', () => {
	it("surfaces the API's reason and code", async () => {
		const message = "A sent quote can't be deleted. Void it instead.";
		const http = jest.fn().mockResolvedValue({
			statusCode: 409,
			body: { message, error: { message, code: 'CANNOT_DELETE_SENT_QUOTE' }, data: {} },
		});
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'quote', operation: 'delete', quoteId: 'q-1' },
			http,
		});

		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toThrow(/Void it instead/);
		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toThrow(/CANNOT_DELETE_SENT_QUOTE/);
	});
});
