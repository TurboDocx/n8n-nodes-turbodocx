import { IExecuteFunctions } from 'n8n-workflow';
import { paginatedList } from '../GenericFunctions';

function ctxWith(params: Record<string, unknown>, http: jest.Mock): IExecuteFunctions {
	return {
		getCredentials: async () => ({ baseUrl: 'https://api.example.com' }),
		getNode: () => ({ name: 'TurboDocx' }),
		getNodeParameter: (name: string, _i?: number, fallback?: unknown) =>
			name in params ? params[name] : fallback,
		helpers: { httpRequestWithAuthentication: http },
	} as unknown as IExecuteFunctions;
}

describe('paginatedList', () => {
	it('keeps paging until a short page even when the API omits totalRecords', async () => {
		// Page 1: a full page (pageSize=2) with NO totalRecords. Page 2: short page -> stop.
		const pages = [
			{ data: { results: [{ id: 1 }, { id: 2 }] } },
			{ data: { results: [{ id: 3 }] } },
		];
		const http = jest.fn(async () => ({ statusCode: 200, body: pages.shift() }));
		const ctx = ctxWith({ returnAll: true }, http);

		const out = await paginatedList(ctx, { endpoint: '/v1/things', i: 0, pageSize: 2 });

		expect(out.map((r) => (r as { id: number }).id)).toEqual([1, 2, 3]);
		expect(http).toHaveBeenCalledTimes(2);
	});

	it('respects the Limit (single page) when returnAll is false', async () => {
		const http = jest.fn(async () => ({
			statusCode: 200,
			body: { data: { results: [{ id: 1 }, { id: 2 }] } },
		}));
		const ctx = ctxWith({ returnAll: false, limit: 2 }, http);

		const out = await paginatedList(ctx, { endpoint: '/v1/things', i: 0, pageSize: 100 });

		expect(out).toHaveLength(2);
		expect(http).toHaveBeenCalledTimes(1);
		// forwarded the user limit, not the page size
		expect((http.mock.calls[0] as unknown[])[1] as { qs: unknown }).toMatchObject({
			qs: { limit: 2, offset: 0 },
		});
	});

	it('stops on an empty page', async () => {
		const http = jest.fn(async () => ({ statusCode: 200, body: { data: { results: [] } } }));
		const ctx = ctxWith({ returnAll: true }, http);

		const out = await paginatedList(ctx, { endpoint: '/v1/things', i: 0, pageSize: 100 });

		expect(out).toEqual([]);
		expect(http).toHaveBeenCalledTimes(1);
	});
});
