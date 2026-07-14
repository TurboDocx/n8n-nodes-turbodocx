import { IWebhookFunctions } from 'n8n-workflow';
import { TurboDocxTrigger } from '../TurboDocxTrigger.node';

interface MockWebhookOpts {
	body: Record<string, unknown>;
	headers?: Record<string, string>;
	events?: string[];
	options?: Record<string, unknown>;
	staticData?: Record<string, unknown>;
	rawBody?: Buffer;
}

function makeWebhookCtx(opts: MockWebhookOpts) {
	const res = {
		status: jest.fn().mockReturnThis(),
		send: jest.fn().mockReturnThis(),
		end: jest.fn().mockReturnThis(),
	};
	const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() };
	const ctx = {
		getRequestObject: () => ({ rawBody: opts.rawBody }),
		getHeaderData: () => opts.headers ?? {},
		getBodyData: () => opts.body,
		getResponseObject: () => res,
		logger,
		getNodeParameter: (name: string, fallback?: unknown) => {
			if (name === 'options') return opts.options ?? {};
			if (name === 'events') return opts.events ?? ['signature.document.completed'];
			return fallback;
		},
		getWorkflowStaticData: () => opts.staticData ?? {},
		helpers: { returnJsonArray: (data: unknown[]) => data.map((json) => ({ json })) },
	} as unknown as IWebhookFunctions;
	return { ctx, res, logger };
}

describe('TurboDocxTrigger.webhook response handling', () => {
	it('passes a valid subscribed delivery through as workflow data', async () => {
		const { ctx } = makeWebhookCtx({
			body: { event: 'signature.document.completed', documentId: 'd1' },
			options: { verifySignature: false },
		});
		const result = await TurboDocxTrigger.prototype.webhook.call(ctx);
		expect(result.workflowData).toBeDefined();
		expect(result.noWebhookResponse).toBeUndefined();
	});

	it('ignores an unsubscribed event with a default 200 (no hanging connection)', async () => {
		const { ctx } = makeWebhookCtx({
			body: { event: 'signature.document.voided' },
			events: ['signature.document.completed'],
			options: { verifySignature: false },
		});
		const result = await TurboDocxTrigger.prototype.webhook.call(ctx);
		// Must NOT leave the caller hanging: return {} so n8n emits its default 200.
		expect(result.workflowData).toBeUndefined();
		expect(result.noWebhookResponse).not.toBe(true);
	});

	it('rejects an invalid signature with an explicit HTTP response (no hang)', async () => {
		const { ctx, res } = makeWebhookCtx({
			body: { event: 'signature.document.completed' },
			headers: {
				'x-turbodocx-signature': 'sha256=deadbeef',
				'x-turbodocx-timestamp': String(Math.floor(Date.now() / 1000)),
			},
			options: { verifySignature: true, toleranceSeconds: 0 },
			staticData: { secret: 'top-secret' },
			rawBody: Buffer.from('{"event":"signature.document.completed"}'),
		});
		const result = await TurboDocxTrigger.prototype.webhook.call(ctx);
		expect(result.workflowData).toBeUndefined();
		// Explicitly answered the request rather than dropping silently.
		expect(res.status).toHaveBeenCalledWith(401);
		expect(res.end).toHaveBeenCalled();
	});

	it('warns (does not silently no-op) when verification is enabled but no secret is held', async () => {
		const { ctx, logger } = makeWebhookCtx({
			body: { event: 'signature.document.completed' },
			options: { verifySignature: true },
			staticData: {}, // attached to a pre-existing webhook -> no secret
		});
		const result = await TurboDocxTrigger.prototype.webhook.call(ctx);
		expect(logger.warn).toHaveBeenCalled();
		// Still passes through (attach-to-existing mode is legitimate), just not silently.
		expect(result.workflowData).toBeDefined();
	});
});
