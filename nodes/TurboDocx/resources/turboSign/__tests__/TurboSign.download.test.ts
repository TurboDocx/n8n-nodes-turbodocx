import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/**
 * `GET /turbosign/documents/{id}/download` does NOT stream the signed PDF — it returns
 * `{ downloadUrl, fileName }`, where downloadUrl is a short-lived presigned S3 link
 * (RapidDocxBackend src/routes/TurboSign/index.ts, the `res.json({ downloadUrl, fileName })`
 * at the end of the download route).
 *
 * The node used to request that endpoint as an arraybuffer and hand the result straight to
 * prepareBinaryData(..., 'application/pdf'), which produced a "PDF" whose bytes were actually
 * the JSON envelope — it downloaded fine and never opened. These tests pin the two-step flow.
 */
describe('TurboSign downloadDocument', () => {
	const PDF_BYTES = Buffer.from('%PDF-1.7\nsigned document body', 'utf-8');
	const DOWNLOAD_URL = 'https://s3.example.com/bucket/doc.pdf?X-Amz-Signature=abc123';

	function run(metaBody: unknown, presigned?: jest.Mock) {
		const http = jest.fn().mockResolvedValue(okResponse(metaBody));
		const httpUnauthenticated =
			presigned ?? jest.fn().mockResolvedValue({ statusCode: 200, body: PDF_BYTES });

		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'turboSign',
				operation: 'downloadDocument',
				documentId: 'doc-1',
			},
			http,
			httpUnauthenticated,
		});

		return { ctx, http, httpUnauthenticated };
	}

	it('resolves the presigned URL and returns the real PDF bytes, not the JSON envelope', async () => {
		const { ctx, http, httpUnauthenticated } = run({
			downloadUrl: DOWNLOAD_URL,
			fileName: 'Mutual NDA.pdf',
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		// Step 1 hits the API for the metadata, as JSON (NOT as arraybuffer).
		expect(http).toHaveBeenCalledTimes(1);
		const metaRequest = http.mock.calls[0][1];
		expect(metaRequest.url).toBe('https://api.example.com/turbosign/documents/doc-1/download');
		expect(metaRequest.encoding).toBeUndefined();

		// Step 2 fetches the presigned link itself.
		expect(httpUnauthenticated).toHaveBeenCalledTimes(1);
		const fileRequest = httpUnauthenticated.mock.calls[0][0];
		expect(fileRequest.url).toBe(DOWNLOAD_URL);
		expect(fileRequest.encoding).toBe('arraybuffer');

		// The binary is the PDF, and it is NOT the JSON body.
		const binary = items[0].binary!.data as unknown as { data: string; fileName: string };
		const decoded = Buffer.from(binary.data, 'base64');
		expect(decoded.subarray(0, 5).toString()).toBe('%PDF-');
		expect(decoded.toString()).not.toContain('downloadUrl');

		// The filename comes from the API, not a hardcoded fallback.
		expect(binary.fileName).toBe('Mutual NDA.pdf');
		expect(items[0].json).toEqual({ documentId: 'doc-1', fileName: 'Mutual NDA.pdf' });
	});

	it('sends no Authorization header to S3 — the signature is already in the URL', async () => {
		const { ctx, httpUnauthenticated } = run({ downloadUrl: DOWNLOAD_URL, fileName: 'a.pdf' });

		await TurboDocx.prototype.execute.call(ctx);

		// The presigned fetch goes through the plain helper, so no credential is attached.
		// S3 rejects a request carrying both a presigned signature and an auth header.
		const fileRequest = httpUnauthenticated.mock.calls[0][0];
		expect(fileRequest.headers?.Authorization).toBeUndefined();
	});

	it('falls back to a generated filename when the API omits one', async () => {
		const { ctx } = run({ downloadUrl: DOWNLOAD_URL });

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		const binary = items[0].binary!.data as unknown as { fileName: string };
		expect(binary.fileName).toBe('signed-document-doc-1.pdf');
	});

	it('raises a clear error when no download URL comes back (e.g. document not completed)', async () => {
		const { ctx, httpUnauthenticated } = run({});

		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toThrow(
			/did not return a download URL/i,
		);
		expect(httpUnauthenticated).not.toHaveBeenCalled();
	});
});
