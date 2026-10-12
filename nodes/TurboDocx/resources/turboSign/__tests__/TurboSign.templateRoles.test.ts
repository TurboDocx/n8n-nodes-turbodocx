import { TurboDocx } from '../../../TurboDocx.node';
import { turboSignFields, turboSignOperations } from '../TurboSign.description';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/**
 * Template signer roles.
 *
 * A template whose signers and fields were set up in TurboDocx is sent by naming each recipient's
 * `role` (the role key shown on the template). The fields saved for that role come with it, so
 * `fields` may be omitted: the node then sends `[]`. A role left out uses the template's saved
 * signer. `recipients` is a raw JSON passthrough, so `role` must reach the API unchanged.
 *
 * `GET /turbosign/templates/{templateId}/signature-setup` lists a template's roles.
 */
describe('TurboSign template signer roles', () => {
	const ROLE_RECIPIENTS =
		'[{"role":"client","name":"Jane Doe","email":"jane@client.com"},{"role":"vendor","name":"Sam Vendor","email":"sam@vendor.com"}]';

	function runPrepare(operation: string, params: Record<string, unknown>) {
		const http = jest.fn().mockResolvedValue(okResponse({ documentId: 'doc-1' }));
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'turboSign',
				operation,
				fileInputMethod: 'template',
				templateId: 'tpl-1',
				...params,
			},
			http,
		});
		return { ctx, http };
	}

	describe.each(['prepareForSigning', 'prepareForReview'])('%s', (operation) => {
		it('forwards each recipient role in the recipients JSON', async () => {
			const { ctx, http } = runPrepare(operation, { recipients: ROLE_RECIPIENTS, fields: '' });

			await TurboDocx.prototype.execute.call(ctx);

			const formData = http.mock.calls[0][1].formData;
			expect(formData.templateId).toBe('tpl-1');
			const recipients = JSON.parse(formData.recipients);
			expect(recipients.map((r: { role: string }) => r.role)).toEqual(['client', 'vendor']);
		});

		it('sends fields as [] when they are left empty', async () => {
			const { ctx, http } = runPrepare(operation, { recipients: ROLE_RECIPIENTS, fields: '' });

			await TurboDocx.prototype.execute.call(ctx);

			expect(http.mock.calls[0][1].formData.fields).toBe('[]');
		});

		it('sends fields as [] when the parameter is not set at all', async () => {
			const { ctx, http } = runPrepare(operation, { recipients: ROLE_RECIPIENTS });

			await TurboDocx.prototype.execute.call(ctx);

			expect(http.mock.calls[0][1].formData.fields).toBe('[]');
		});

		it('leaves recipients and fields without a role unchanged', async () => {
			const recipients = '[{"name":"Client","email":"client@example.com","signingOrder":1}]';
			const fields =
				'[{"recipientEmail":"client@example.com","type":"signature","template":{"anchor":"{Sig}","placement":"replace","size":{"width":200,"height":50}}}]';
			const { ctx, http } = runPrepare(operation, { recipients, fields });

			await TurboDocx.prototype.execute.call(ctx);

			const formData = http.mock.calls[0][1].formData;
			expect(formData.recipients).toBe(recipients);
			expect(formData.fields).toBe(fields);
			expect(JSON.parse(formData.recipients)[0]).not.toHaveProperty('role');
		});
	});

	it('does not require the Fields parameter', () => {
		const fieldsParam = turboSignFields.find((p) => p.name === 'fields');
		expect(fieldsParam?.required).not.toBe(true);
	});

	describe('getTemplateSignatureSetup', () => {
		const SETUP = {
			templateId: 'tpl 1/x',
			roles: [
				{
					key: 'client',
					label: 'Client',
					order: 1,
					hasSavedSigner: false,
					fieldCount: 3,
				},
				{
					key: 'vendor',
					label: 'Vendor',
					order: 2,
					hasSavedSigner: true,
					defaultName: 'Sam Vendor',
					defaultEmail: 'sam@vendor.com',
					fieldCount: 2,
				},
			],
		};

		function runSetup() {
			const http = jest.fn().mockResolvedValue(okResponse({ data: SETUP }));
			const ctx = makeExecuteCtx({
				itemCount: 1,
				params: {
					resource: 'turboSign',
					operation: 'getTemplateSignatureSetup',
					templateId: 'tpl 1/x',
				},
				http,
			});
			return { ctx, http };
		}

		it('is listed as a TurboSign operation', () => {
			const values = (turboSignOperations[0].options as Array<{ value: string }>).map(
				(o) => o.value,
			);
			expect(values).toContain('getTemplateSignatureSetup');
		});

		it('GETs the signature-setup endpoint with the template id URL-encoded', async () => {
			const { ctx, http } = runSetup();

			await TurboDocx.prototype.execute.call(ctx);

			expect(http).toHaveBeenCalledTimes(1);
			const request = http.mock.calls[0][1];
			expect(request.method).toBe('GET');
			expect(request.url).toBe(
				'https://api.example.com/turbosign/templates/tpl%201%2Fx/signature-setup',
			);
		});

		it('returns the unwrapped setup', async () => {
			const { ctx } = runSetup();

			const [items] = await TurboDocx.prototype.execute.call(ctx);

			expect(items).toHaveLength(1);
			expect(items[0].json).toEqual(SETUP);
		});
	});

	describe('parameter text', () => {
		const find = (name: string) =>
			(turboSignFields as Array<{ name: string; description?: string; options?: unknown[] }>).find(
				(f) => f.name === name,
			);

		it('says Fields is required unless recipients name template signer roles', () => {
			expect(find('fields')?.description).toContain(
				'Required unless the recipients name template signer roles (recipients[].role)',
			);
		});

		it('does not offer PPTX for signing and says PowerPoint templates cannot be signed', () => {
			const text = JSON.stringify(find('fileInputMethod')?.options);
			expect(text).not.toMatch(/PPTX/i);
			expect(text).toContain('PowerPoint templates cannot be signed');
		});
	});
});
