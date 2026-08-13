import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import { turboDocxApiRequest } from '../GenericFunctions';

interface CapturedRequest {
	credential?: string;
	options?: Record<string, unknown>;
}

/**
 * Mock context capturing both request helpers. Multipart uploads must go through
 * the legacy `requestWithAuthentication` (with a `formData` key) — community nodes
 * cannot import `form-data`, and the modern httpRequest helper drops file parts
 * from a plain-object body.
 */
function mockCtx(legacy: CapturedRequest, modern: CapturedRequest): IExecuteFunctions {
	return {
		getCredentials: jest.fn(async () => ({ baseUrl: 'https://api.example.com' })),
		getNode: jest.fn(() => ({ name: 'TurboDocx' })),
		helpers: {
			requestWithAuthentication: jest.fn(async (cred: string, options: Record<string, unknown>) => {
				legacy.credential = cred;
				legacy.options = options;
				return { statusCode: 200, body: { ok: true } };
			}),
			httpRequestWithAuthentication: jest.fn(
				async (cred: string, options: Record<string, unknown>) => {
					modern.credential = cred;
					modern.options = options;
					return { statusCode: 200, body: { ok: true } };
				},
			),
		},
	} as unknown as IExecuteFunctions;
}

describe('turboDocxApiRequest multipart serialization', () => {
	it('routes a multipart body through requestWithAuthentication as formData (array of parts)', async () => {
		const legacy: CapturedRequest = {};
		const modern: CapturedRequest = {};
		const ctx = mockCtx(legacy, modern);

		const body = {
			data: JSON.stringify({ name: 'Widget' }),
			images: [
				{ value: Buffer.from('PNG-A'), options: { filename: 'a.png', contentType: 'image/png' } },
				{ value: Buffer.from('PNG-B'), options: { filename: 'b.png', contentType: 'image/png' } },
			],
		};

		await turboDocxApiRequest(ctx, {
			method: 'POST',
			endpoint: '/v1/products',
			multipart: true,
			body,
		});

		// Multipart must NOT go through the modern helper (which drops the files).
		expect(modern.options).toBeUndefined();
		// It goes through the legacy helper with the body handed over as formData,
		// preserving the array of file parts under the `images` key.
		expect(legacy.options?.formData).toBe(body);
		expect((legacy.options?.formData as typeof body).images).toHaveLength(2);
		expect(legacy.options?.uri).toBe('https://api.example.com/v1/products');
		expect(legacy.options?.resolveWithFullResponse).toBe(true);
	});

	it('routes a single {value,options} file part (TurboSign upload) as formData', async () => {
		const legacy: CapturedRequest = {};
		const modern: CapturedRequest = {};
		const ctx = mockCtx(legacy, modern);

		const file = {
			value: Buffer.from('%PDF-1'),
			options: { filename: 'doc.pdf', contentType: 'application/pdf' },
		};

		await turboDocxApiRequest(ctx, {
			method: 'POST',
			endpoint: '/turbosign/single/prepare-for-signing',
			multipart: true,
			body: { recipients: '[]', fields: '[]', file },
		});

		expect(modern.options).toBeUndefined();
		expect((legacy.options?.formData as { file: unknown }).file).toBe(file);
	});

	it('sends a normal JSON body through the modern helper, not as formData', async () => {
		const legacy: CapturedRequest = {};
		const modern: CapturedRequest = {};
		const ctx = mockCtx(legacy, modern);

		await turboDocxApiRequest(ctx, {
			method: 'POST',
			endpoint: '/x',
			body: { a: 1 },
		});

		expect(legacy.options).toBeUndefined();
		expect(modern.options?.body).toEqual({ a: 1 });
		expect(modern.options?.json).toBe(true);
	});
});

/**
 * Regression for #20 / #22: a non-2xx response must THROW, not fall through to the
 * success return. Both request branches share one guard, so both must be exercised —
 * the multipart (legacy `requestWithAuthentication`) branch is the one the live bug hit
 * (a POST 3xx it does not follow was returned as a silent `{}` success), and the modern
 * (`httpRequestWithAuthentication`) branch must stay consistent with it.
 */
describe('turboDocxApiRequest surfaces non-2xx responses', () => {
	/** A ctx whose BOTH auth helpers return the given raw response. */
	function ctxReturning(response: { statusCode?: number; body?: unknown }): IExecuteFunctions {
		const helper = jest.fn(async () => response);
		return {
			getCredentials: jest.fn(async () => ({ baseUrl: 'https://api.example.com' })),
			getNode: jest.fn(() => ({ name: 'TurboDocx' })),
			helpers: {
				requestWithAuthentication: helper, // multipart / legacy branch
				httpRequestWithAuthentication: helper, // modern JSON branch
			},
		} as unknown as IExecuteFunctions;
	}

	// A body triggers the multipart branch; no `multipart` flag takes the modern branch.
	const branches: Array<[string, Parameters<typeof turboDocxApiRequest>[1]]> = [
		[
			'multipart (legacy helper)',
			{
				method: 'POST',
				endpoint: '/turbosign/single/prepare-for-signing',
				multipart: true,
				body: { recipients: '[]', fields: '[]' },
			},
		],
		['json (modern helper)', { method: 'POST', endpoint: '/x', body: { a: 1 } }],
	];

	describe.each(branches)('%s', (_label, call) => {
		it.each([
			['4xx', 400],
			['5xx', 500],
			['3xx redirect', 302],
		])('throws a NodeOperationError on %s', async (_status, statusCode) => {
			const ctx = ctxReturning({ statusCode, body: { error: 'nope' } });
			await expect(turboDocxApiRequest(ctx, call)).rejects.toBeInstanceOf(NodeOperationError);
		});

		it('throws when statusCode is absent (unenforced branch contract)', async () => {
			const ctx = ctxReturning({ body: undefined });
			await expect(turboDocxApiRequest(ctx, call)).rejects.toBeInstanceOf(NodeOperationError);
		});

		it('returns the body on 2xx', async () => {
			const ctx = ctxReturning({ statusCode: 200, body: { ok: true } });
			await expect(turboDocxApiRequest(ctx, call)).resolves.toEqual({ ok: true });
		});
	});
});
