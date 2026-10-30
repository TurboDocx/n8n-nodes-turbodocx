import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/** Catalog list sorting, several billing frequencies / currencies, named duplicates and price book reset. */

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

describe('Catalog lists: sort and several values', () => {
	it('Product → Get Many sends several billing frequencies and currencies, and the sort', async () => {
		const { http, calls } = capturingHttp(emptyList);
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'product',
				operation: 'list',
				returnAll: false,
				limit: 20,
				filters: { billingFrequencies: ['monthly', 'annual'], currencies: ['USD', 'INR'] },
				sort: { sortBy: 'listPrice', sortDirection: 'desc' },
			},
			http,
		});

		await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].qs).toEqual({
			billingFrequency: ['monthly', 'annual'],
			currency: ['USD', 'INR'],
			sortBy: 'listPrice',
			sortDirection: 'desc',
			limit: 20,
			offset: 0,
		});
	});

	it('Product → Get Many still sends one billing frequency as a plain value', async () => {
		const { http, calls } = capturingHttp(emptyList);
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'product', operation: 'list', limit: 5, filters: { billingFrequency: 'monthly' } },
			http,
		});

		await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].qs).toEqual({ billingFrequency: 'monthly', limit: 5, offset: 0 });
	});

	it('Price Book and Bundle → Get Many send the sort', async () => {
		const { http, calls } = capturingHttp(emptyList);
		for (const [resource, sortBy, filters] of [
			['priceBook', 'overrideCount', {}],
			['bundle', 'itemCount', { currencies: ['USD', 'EUR'] }],
		] as const) {
			const ctx = makeExecuteCtx({
				itemCount: 1,
				params: { resource, operation: 'list', limit: 5, filters, sort: { sortBy, sortDirection: 'asc' } },
				http,
			});
			await TurboDocx.prototype.execute.call(ctx);
		}

		expect(calls[0].url).toBe('https://api.example.com/v1/pricebooks');
		expect(calls[0].qs).toEqual({ sortBy: 'overrideCount', sortDirection: 'asc', limit: 5, offset: 0 });
		expect(calls[1].url).toBe('https://api.example.com/v1/bundles');
		expect(calls[1].qs).toEqual({
			currency: ['USD', 'EUR'],
			sortBy: 'itemCount',
			sortDirection: 'asc',
			limit: 5,
			offset: 0,
		});
	});
});

describe('Catalog duplicates take a name', () => {
	it.each([
		['product', 'productId', '/v1/products/x-1/duplicate'],
		['priceBook', 'priceBookId', '/v1/pricebooks/x-1/duplicate'],
		['bundle', 'bundleId', '/v1/bundles/x-1/duplicate'],
	])('%s → Duplicate sends the name for the copy', async (resource, idParam, path) => {
		const { http, calls } = capturingHttp({ data: { result: { id: 'x-2' } } });
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource, operation: 'duplicate', [idParam]: 'x-1', duplicateFields: { name: 'Q4 copy' } },
			http,
		});

		await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].url).toBe(`https://api.example.com${path}`);
		expect(calls[0].body).toEqual({ name: 'Q4 copy' });
	});
});

describe('Product → Get Quote Images', () => {
	it('posts the product ids and returns the map', async () => {
		const images = { 'p-1': [{ id: 'i-1' }], 'p-2': [] };
		const { http, calls } = capturingHttp({ data: { results: images } });
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'product', operation: 'quoteImages', productIds: '["p-1","p-2"]' },
			http,
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].url).toBe('https://api.example.com/v1/products/quote-images');
		expect(calls[0].body).toEqual({ productIds: ['p-1', 'p-2'] });
		expect(items[0].json).toEqual(images);
	});
});

describe('Price Book → Update: Reset Product Pricing', () => {
	it('sends resetProductPricing', async () => {
		const { http, calls } = capturingHttp({ data: { result: { id: 'pb-1' } } });
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'priceBook',
				operation: 'update',
				priceBookId: 'pb-1',
				updateFields: { resetProductPricing: true },
			},
			http,
		});

		await TurboDocx.prototype.execute.call(ctx);

		expect(calls[0].body).toEqual({ resetProductPricing: true });
	});
});
