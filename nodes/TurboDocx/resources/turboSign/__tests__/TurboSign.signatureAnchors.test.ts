import { TurboDocx } from '../../../TurboDocx.node';
import { turboSignOperations } from '../TurboSign.description';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/**
 * Anchored fields on a template's saved signature setup (mirrors addTemplateSignatureAnchor /
 * removeTemplateSignatureAnchor in the JS SDK). An anchored field is a signature field tied to a
 * tag like {ClientSign} for one signer role. Both routes answer `{ data: { results } }` and the
 * node returns `results`.
 */
describe('TurboSign template signature anchors', () => {
	const SAVED = { roles: [{ key: 'signer_1' }], fields: [{ id: 'f-1', anchor: '{ClientSign}' }] };

	function run(params: Record<string, unknown>, body: unknown) {
		const http = jest.fn().mockResolvedValue(okResponse(body));
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'turboSign', templateId: 'tpl 1/x', ...params },
			http,
		});
		return { ctx, http };
	}

	it('lists both operations', () => {
		const values = (turboSignOperations[0].options as Array<{ value: string }>).map((o) => o.value);
		expect(values).toEqual(
			expect.arrayContaining(['addTemplateSignatureAnchor', 'removeTemplateSignatureAnchor']),
		);
	});

	describe('addTemplateSignatureAnchor', () => {
		const RESULT = { fieldId: 'f-1', signatureSetup: SAVED, tagBecameSignatureField: true };

		it('POSTs roleKey, type and anchor to the anchors endpoint and returns results', async () => {
			const { ctx, http } = run(
				{
					operation: 'addTemplateSignatureAnchor',
					roleKey: 'signer_1',
					anchorFieldType: 'signature',
					anchor: '{ClientSign}',
				},
				{ data: { results: RESULT } },
			);

			const [items] = await TurboDocx.prototype.execute.call(ctx);

			const request = http.mock.calls[0][1];
			expect(request.method).toBe('POST');
			expect(request.url).toBe(
				'https://api.example.com/turbosign/templates/tpl%201%2Fx/signature-setup/anchors',
			);
			expect(request.body).toEqual({ roleKey: 'signer_1', type: 'signature', anchor: '{ClientSign}' });
			expect(items[0].json).toEqual(RESULT);
		});

		it('sends the optional size, offset, placement, defaultValue and isReadonly', async () => {
			const { ctx, http } = run(
				{
					operation: 'addTemplateSignatureAnchor',
					roleKey: 'signer_1',
					anchorFieldType: 'text',
					anchor: '{Title}',
					anchorOptions: {
						size: '{"width":200,"height":30}',
						offset: '{"x":0,"y":-5}',
						placement: 'after',
						defaultValue: 'CEO',
						isReadonly: true,
					},
				},
				{ data: { results: RESULT } },
			);

			await TurboDocx.prototype.execute.call(ctx);

			expect(http.mock.calls[0][1].body).toEqual({
				roleKey: 'signer_1',
				type: 'text',
				anchor: '{Title}',
				size: { width: 200, height: 30 },
				offset: { x: 0, y: -5 },
				placement: 'after',
				defaultValue: 'CEO',
				isReadonly: true,
			});
		});
	});

	describe('removeTemplateSignatureAnchor', () => {
		it('DELETEs the field by id, URL-encoded, and returns results', async () => {
			const { ctx, http } = run(
				{ operation: 'removeTemplateSignatureAnchor', fieldId: 'f 1/a' },
				{ data: { results: { signatureSetup: SAVED } } },
			);

			const [items] = await TurboDocx.prototype.execute.call(ctx);

			const request = http.mock.calls[0][1];
			expect(request.method).toBe('DELETE');
			expect(request.url).toBe(
				'https://api.example.com/turbosign/templates/tpl%201%2Fx/signature-setup/anchors/f%201%2Fa',
			);
			expect(items[0].json).toEqual({ signatureSetup: SAVED });
		});
	});

	it('Get Template Signature Setup passes anchors and anchoredFieldCount through', async () => {
		const SETUP = {
			templateId: 'tpl 1/x',
			roles: [{ key: 'signer_1', label: 'Client', order: 1, fieldCount: 2, anchoredFieldCount: 1 }],
			anchors: [
				{
					fieldId: 'f-1',
					roleKey: 'signer_1',
					type: 'signature',
					anchor: '{ClientSign}',
					placement: 'replace',
					notFound: false,
				},
			],
		};
		const { ctx } = run({ operation: 'getTemplateSignatureSetup' }, { data: SETUP });

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(items[0].json).toEqual(SETUP);
	});
});
