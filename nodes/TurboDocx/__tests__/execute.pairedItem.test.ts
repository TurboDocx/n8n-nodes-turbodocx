import { TurboDocx } from '../TurboDocx.node';
import { makeExecuteCtx, okResponse } from './helpers';

describe('TurboDocx.execute pairedItem linkage', () => {
	it('stamps pairedItem on each success output, one per input item', async () => {
		const http = jest.fn(async () => okResponse({ status: 'completed' }));
		const ctx = makeExecuteCtx({
			itemCount: 2,
			params: { resource: 'turboSign', operation: 'getStatus', documentId: 'doc1' },
			http,
		});

		const [out] = await TurboDocx.prototype.execute.call(ctx);

		expect(out).toHaveLength(2);
		expect(out[0].pairedItem).toEqual({ item: 0 });
		expect(out[1].pairedItem).toEqual({ item: 1 });
	});

	it('stamps pairedItem on every item of a 1→N fan-out (list)', async () => {
		const http = jest.fn(async () =>
			okResponse({ data: { results: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], totalRecords: 3 } }),
		);
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'deliverable', operation: 'list', returnAll: true, filters: {} },
			http,
		});

		const [out] = await TurboDocx.prototype.execute.call(ctx);

		expect(out).toHaveLength(3);
		for (const item of out) {
			expect(item.pairedItem).toEqual({ item: 0 });
		}
	});
});
