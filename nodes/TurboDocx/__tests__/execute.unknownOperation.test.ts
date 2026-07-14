import { NodeOperationError } from 'n8n-workflow';
import { TurboDocx } from '../TurboDocx.node';
import { makeExecuteCtx } from './helpers';

describe('TurboDocx.execute unknown-operation handling', () => {
	it('reports an unknown operation as a clean NodeOperationError, not a fake HTTP 400', async () => {
		const http = jest.fn();
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'turboSign', operation: 'definitelyNotAnOperation' },
			http,
		});

		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toBeInstanceOf(NodeOperationError);
		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toThrow(
			/Unknown TurboSign operation/,
		);
		// The bug: a plain Error gets normalized into a bogus "HTTP Status: 400".
		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.not.toThrow(/HTTP Status: 400/);
		// And no HTTP call should have been attempted.
		expect(http).not.toHaveBeenCalled();
	});
});
