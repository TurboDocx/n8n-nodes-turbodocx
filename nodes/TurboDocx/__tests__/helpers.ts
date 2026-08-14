import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

export interface MockExecuteOptions {
	/** Number of input items. */
	itemCount: number;
	/** Node parameter values, keyed by name (same across items unless overridden). */
	params: Record<string, unknown>;
	/** Implementation for httpRequestWithAuthentication. */
	http: jest.Mock;
	/** Implementation for the UNauthenticated httpRequest (presigned-URL downloads). */
	httpUnauthenticated?: jest.Mock;
	/** continueOnFail() return value. */
	continueOnFail?: boolean;
	/**
	 * Extra credential fields merged over the default `{ baseUrl }`. Partner resources
	 * read `partnerId` off the credential (it is not a node parameter), so any test that
	 * asserts a partner URL has to supply it.
	 */
	credentials?: Record<string, unknown>;
}

/**
 * Minimal IExecuteFunctions mock sufficient to drive TurboDocx.node.execute()
 * through the resource handlers. getNodeParameter resolves by name from `params`
 * (falling back to the provided default), ignoring the item index.
 */
export function makeExecuteCtx(opts: MockExecuteOptions): IExecuteFunctions {
	const items: INodeExecutionData[] = Array.from({ length: opts.itemCount }, () => ({ json: {} }));
	return {
		getInputData: () => items,
		getNode: () => ({ name: 'TurboDocx', type: 'turboDocx' }),
		continueOnFail: () => opts.continueOnFail ?? false,
		getCredentials: async () => ({ baseUrl: 'https://api.example.com', ...opts.credentials }),
		getNodeParameter: (name: string, _itemIndex?: number, fallback?: unknown) =>
			name in opts.params ? opts.params[name] : fallback,
		helpers: {
			httpRequestWithAuthentication: opts.http,
			// Multipart uploads (TurboSign prepare-*, product images) go through the legacy
			// helper instead. Same (ctx, credentialName, options) signature, so it shares the mock.
			requestWithAuthentication: opts.http,
			httpRequest: opts.httpUnauthenticated ?? jest.fn(),
			assertBinaryData: () => ({ fileName: 'document.pdf', mimeType: 'application/pdf' }),
			getBinaryDataBuffer: async () => Buffer.from('%PDF-1.7 test'),
			prepareBinaryData: async (buffer: Buffer, fileName: string, mimeType: string) => ({
				data: buffer.toString('base64'),
				fileName,
				mimeType,
			}),
			returnJsonArray: (data: unknown[]) => data.map((json) => ({ json })),
		},
	} as unknown as IExecuteFunctions;
}

/** A successful full-response envelope for httpRequestWithAuthentication. */
export function okResponse(body: unknown) {
	return { statusCode: 200, body };
}
