import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';
import { turboSignFields } from '../TurboSign.description';

/**
 * Fit Fields to Tags (`fitAnchoredTags`) on Send Signature and Get Review Link.
 *
 * When on, each field sent on a single-brace tag such as {ClientSign} is placed the way a
 * template's saved setup field is placed (fitted to its tag's line when it has no size). The API
 * treats false the same as a missing key, so the node sends the part only when the option is on,
 * as the string 'true' (the multipart helper takes string parts only). Off or not added, the
 * request is exactly as before. It applies to every file source: upload, URL, deliverable and
 * template.
 */
describe('TurboSign fitAnchoredTags', () => {
	function run(
		operation: string,
		fileInputMethod: string,
		additionalFields?: Record<string, unknown>,
	) {
		const http = jest
			.fn()
			.mockResolvedValue(okResponse({ documentId: 'doc-1', status: 'review_ready' }));
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'turboSign',
				operation,
				fileInputMethod,
				pdfFile: 'data',
				fileLink: 'https://example.com/contract.pdf',
				deliverableId: '11111111-1111-1111-1111-111111111111',
				templateId: '22222222-2222-2222-2222-222222222222',
				recipients: '[{"name":"Jane Doe","email":"jane@example.com","signingOrder":1}]',
				fields:
					'[{"recipientEmail":"jane@example.com","type":"signature","template":{"anchor":"{ClientSign}"}}]',
				...(additionalFields !== undefined ? { additionalFields } : {}),
			},
			http,
		});
		return { ctx, http };
	}

	async function formDataOf(
		operation: string,
		fileInputMethod: string,
		additionalFields?: Record<string, unknown>,
	): Promise<Record<string, unknown>> {
		const { ctx, http } = run(operation, fileInputMethod, additionalFields);
		await TurboDocx.prototype.execute.call(ctx);
		return http.mock.calls[0][1].formData;
	}

	const operations: Array<[string, string]> = [
		['prepareForSigning', '/turbosign/single/prepare-for-signing'],
		['prepareForReview', '/turbosign/single/prepare-for-review'],
	];
	const sources = ['upload', 'url', 'deliverable', 'template'];

	describe.each(operations)('%s', (operation, path) => {
		// An expression such as {{ $json.fitTags }} hands the option the string "true", not a boolean
		it.each(sources)(
			'sends fitAnchoredTags "true" when an expression turns the option on (%s source)',
			async (source) => {
				const { ctx, http } = run(operation, source, { fitAnchoredTags: 'true' });
				await TurboDocx.prototype.execute.call(ctx);

				expect(http.mock.calls[0][1].uri).toContain(path);
				expect(http.mock.calls[0][1].formData.fitAnchoredTags).toBe('true');
			},
		);

		it.each(sources)(
			'leaves the key out when the option is off or not added, the body otherwise unchanged (%s source)',
			async (source) => {
				const notAdded = await formDataOf(operation, source);
				const off = await formDataOf(operation, source, { fitAnchoredTags: false });
				const { fitAnchoredTags, ...onRest } = await formDataOf(operation, source, {
					fitAnchoredTags: true,
				});

				expect(notAdded).not.toHaveProperty('fitAnchoredTags');
				expect(off).toStrictEqual(notAdded);
				expect(fitAnchoredTags).toBe('true');
				expect(onRest).toStrictEqual(notAdded);
			},
		);
	});

	it('is an Additional Fields option, off by default, on both prepare operations', () => {
		const additional = turboSignFields.find((p) => p.name === 'additionalFields');
		const option = (
			additional?.options as Array<{ name: string; type: string; default: unknown }>
		).find((o) => o.name === 'fitAnchoredTags');

		expect(additional?.displayOptions?.show?.operation).toStrictEqual([
			'prepareForReview',
			'prepareForSigning',
		]);
		expect(option).toMatchObject({ type: 'boolean', default: false });
	});
});
