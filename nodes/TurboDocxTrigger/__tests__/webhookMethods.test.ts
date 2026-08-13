import { IHookFunctions } from 'n8n-workflow';
import { TurboDocxTrigger } from '../TurboDocxTrigger.node';

/**
 * Regression for the non-2xx-as-success defect (#20/#22) as it applied to the trigger's own
 * webhook registration. `create()` used a `>= 400` guard, so a 3xx redirect or a status-less
 * response fell through to `staticData.secret = body.secret` — reading `secret` off a body that
 * never carried one and silently disabling signature verification while reporting success.
 */
interface MockHookOpts {
	/** Sequence of responses returned by httpRequestWithAuthentication, in call order. */
	responses: Array<{ statusCode?: number; body?: unknown }>;
	staticData?: Record<string, unknown>;
	webhookUrl?: string;
}

function makeHookCtx(opts: MockHookOpts) {
	const http = jest.fn();
	for (const r of opts.responses) http.mockResolvedValueOnce(r);
	const staticData = opts.staticData ?? {};
	const ctx = {
		getNodeWebhookUrl: () => opts.webhookUrl ?? 'https://n8n.example.com/webhook/sig',
		getNodeParameter: (name: string, fallback?: unknown) => (name === 'events' ? [] : fallback),
		getWorkflowStaticData: () => staticData,
		getNode: () => ({ name: 'TurboDocxTrigger' }),
		getCredentials: async () => ({ baseUrl: 'https://api.example.com' }),
		helpers: { httpRequestWithAuthentication: http },
	} as unknown as IHookFunctions;
	return { ctx, staticData };
}

const create = new TurboDocxTrigger().webhookMethods.default.create;

describe('TurboDocxTrigger webhook create() surfaces non-2xx registration failures', () => {
	it('throws on a 3xx instead of reporting success with no secret', async () => {
		// GET existing -> 302, POST create -> 302. Old code entered the attach branch on the GET
		// (302 < 400) and never threw; the fix rejects both.
		const { ctx, staticData } = makeHookCtx({ responses: [{ statusCode: 302, body: {} }, { statusCode: 302, body: {} }] });
		await expect(create.call(ctx)).rejects.toThrow();
		expect(staticData.secret).toBeUndefined();
	});

	it('throws when the response has no status code', async () => {
		const { ctx, staticData } = makeHookCtx({ responses: [{ body: {} }, { body: {} }] });
		await expect(create.call(ctx)).rejects.toThrow();
		expect(staticData.secret).toBeUndefined();
	});

	it('stores the secret on a 2xx create (happy path intact)', async () => {
		// GET existing -> 404 (none), POST create -> 201 with a secret.
		const { ctx, staticData } = makeHookCtx({
			responses: [
				{ statusCode: 404, body: {} },
				{ statusCode: 201, body: { data: { secret: 'wh-secret' } } },
			],
		});
		await expect(create.call(ctx)).resolves.toBe(true);
		expect(staticData.secret).toBe('wh-secret');
	});
});
