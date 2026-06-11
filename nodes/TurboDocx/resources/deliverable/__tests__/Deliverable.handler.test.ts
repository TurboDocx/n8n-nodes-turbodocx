import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

describe('Deliverable generate output shape', () => {
	it('emits the flat deliverable record (peels both results and deliverable wrappers)', async () => {
		// Backend POST /v1/deliverable -> { data: { results: { deliverable: <record> } } }
		const http = jest.fn(async () =>
			okResponse({ data: { results: { deliverable: { id: 'd1', name: 'Report' } } } }),
		);
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'deliverable',
				operation: 'generate',
				name: 'Report',
				templateId: 't1',
				variables: '[]',
				additionalFields: {},
			},
			http,
		});

		const [out] = await TurboDocx.prototype.execute.call(ctx);

		expect(out[0].json).toEqual({ id: 'd1', name: 'Report' });
	});
});
