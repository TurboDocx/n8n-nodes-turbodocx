import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/**
 * Apply Signature Setup.
 *
 * Optional boolean on Send Signature and Get Review Link. When true, a field sent with a
 * `template.anchor` that matches an anchored field of the template's saved signature setup is
 * treated as that field. It only has an effect with a template or deliverable source, so the
 * node sends it for those sources only. It is sent when set (an explicit false too) and left out
 * otherwise. The multipart helper only takes string parts, so it goes out as 'true' / 'false'.
 */
describe('TurboSign applySignatureSetup', () => {
	const recipients = '[{"name":"Client","email":"client@example.com","signingOrder":1}]';
	const fields =
		'[{"recipientEmail":"client@example.com","type":"signature","template":{"anchor":"{ClientSign}"}}]';

	async function sentFormData(
		operation: string,
		source: Record<string, unknown>,
		additionalFields: Record<string, unknown>,
	) {
		const http = jest.fn().mockResolvedValue(okResponse({ id: 'doc-1' }));
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'turboSign', operation, recipients, fields, additionalFields, ...source },
			http,
		});
		await TurboDocx.prototype.execute.call(ctx);
		return http.mock.calls[0][1].formData;
	}

	const template = { fileInputMethod: 'template', templateId: 'tpl-1' };
	const deliverable = { fileInputMethod: 'deliverable', deliverableId: 'dlv-1' };

	describe.each(['prepareForSigning', 'prepareForReview'])('%s', (operation) => {
		it('sends true with a template source', async () => {
			const formData = await sentFormData(operation, template, { applySignatureSetup: true });
			expect(formData.applySignatureSetup).toBe('true');
		});

		it('sends true with a deliverable source', async () => {
			const formData = await sentFormData(operation, deliverable, { applySignatureSetup: true });
			expect(formData.applySignatureSetup).toBe('true');
		});

		it('forwards an explicit false', async () => {
			const formData = await sentFormData(operation, template, { applySignatureSetup: false });
			expect(formData.applySignatureSetup).toBe('false');
		});

		it('leaves it out when not set', async () => {
			const formData = await sentFormData(operation, template, {});
			expect(formData).not.toHaveProperty('applySignatureSetup');
		});

		it.each([
			['upload', { fileInputMethod: 'upload', pdfFile: 'data' }],
			['url', { fileInputMethod: 'url', fileLink: 'https://example.com/a.pdf' }],
		])('leaves it out for a %s source', async (_name, source) => {
			const formData = await sentFormData(operation, source, { applySignatureSetup: true });
			expect(formData).not.toHaveProperty('applySignatureSetup');
		});
	});
});
