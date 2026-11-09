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

	it('sends a decimal size and offset as written, not rounded', async () => {
		const { ctx, http } = run(
			{
				operation: 'addTemplateSignatureAnchor',
				roleKey: 'signer_1',
				anchorFieldType: 'signature',
				anchor: '{ClientSign}',
				anchorOptions: {
					size: '{"width":200.5,"height":30.25}',
					offset: '{"x":-1.5,"y":0.75}',
				},
			},
			{ data: { results: { fieldId: 'f-1' } } },
		);

		await TurboDocx.prototype.execute.call(ctx);

		expect(http.mock.calls[0][1].body).toMatchObject({
			size: { width: 200.5, height: 30.25 },
			offset: { x: -1.5, y: 0.75 },
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

	it('Get Template Signature Setup returns an older backend\'s setup with no anchors or anchoredFieldCount', async () => {
		const OLDER = {
			templateId: 'tpl 1/x',
			roles: [{ key: 'signer_1', label: 'Client', order: 1, hasSavedSigner: false, fieldCount: 2 }],
		};
		const { ctx } = run({ operation: 'getTemplateSignatureSetup' }, { data: OLDER });

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(items[0].json).toEqual(OLDER);
	});

	/**
	 * A template open for editing in TurboDocx is locked, and both anchor routes answer 423 with
	 * no machine code: `{ error: "Resource is locked", message, data: { locked, lockedBy, lockedOn } }`.
	 * The node must say so plainly and must not pass the "Resource is locked" phrase off as a code.
	 */
	describe('a locked template (423)', () => {
		const LOCKED_BODY = {
			error: 'Resource is locked',
			message: 'This template is currently being edited',
			data: { locked: true, lockedBy: 'user-1', lockedOn: '2026-11-09T10:00:00.000Z' },
		};
		const ADD = {
			operation: 'addTemplateSignatureAnchor',
			roleKey: 'signer_1',
			anchorFieldType: 'signature',
			anchor: '{ClientSign}',
		};
		const REMOVE = { operation: 'removeTemplateSignatureAnchor', fieldId: 'f-1' };

		function runLocked(params: Record<string, unknown>, continueOnFail: boolean) {
			const http = jest.fn().mockResolvedValue({ statusCode: 423, body: LOCKED_BODY });
			return makeExecuteCtx({
				itemCount: 1,
				params: { resource: 'turboSign', templateId: 'tpl-1', ...params },
				http,
				continueOnFail,
			});
		}

		it.each([
			['add', ADD],
			['remove', REMOVE],
		])('on %s, throws a message that says the template is locked and what to do', async (_n, params) => {
			const error = (await TurboDocx.prototype.execute
				.call(runLocked(params, false))
				.catch((e: unknown) => e)) as { message: string; description?: string };

			expect(error.message).toBe(
				'This template is currently being edited. It is locked while it is open for editing in TurboDocx: close it there, then try again.',
			);
			expect(error.message).not.toContain('[Resource is locked]');
			expect(error.description).toBe('HTTP Status: 423');
		});

		it.each([
			['add', ADD],
			['remove', REMOVE],
		])('on %s with Continue On Fail, outputs statusCode 423 and no made-up code', async (_n, params) => {
			const [items] = await TurboDocx.prototype.execute.call(runLocked(params, true));

			expect(items[0].json.statusCode).toBe(423);
			expect(items[0].json).not.toHaveProperty('code');
			expect(items[0].json.error).toContain('locked while it is open for editing in TurboDocx');
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
