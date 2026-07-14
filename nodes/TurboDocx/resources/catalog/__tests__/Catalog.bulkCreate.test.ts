import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

describe('Catalog bulkCreate', () => {
	it('POSTs { rows } to /v1/products/bulk and surfaces the BulkImportResult from `results`', async () => {
		const capture: { url?: string; body?: Record<string, unknown> } = {};
		const http = jest.fn(
			async (_cred: string, opts: { url?: string; body?: Record<string, unknown> }) => {
				capture.url = opts.url;
				capture.body = opts.body;
				// The /bulk endpoints wrap the summary in a PLURAL `{ results }` envelope.
				return okResponse({ results: { imported: 2, failed: [], adjusted: [] } });
			},
		);
		const rows = [
			{ name: 'A', listPrice: 1, billingFrequency: 'one-time', categoryId: 'c' },
			{ name: 'B', listPrice: 2, billingFrequency: 'one-time', categoryId: 'c' },
		];
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'product',
				operation: 'bulkCreate',
				rows: JSON.stringify(rows),
			},
			http,
		});

		const out = await TurboDocx.prototype.execute.call(ctx);

		expect(capture.url).toContain('/v1/products/bulk');
		expect(capture.body).toEqual({ rows });
		// Single summary object, not a fan-out of rows.
		expect(out[0]).toHaveLength(1);
		expect(out[0][0].json).toEqual({ imported: 2, failed: [], adjusted: [] });
	});
});
