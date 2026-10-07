import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/**
 * Optional signer fields.
 *
 * A TurboSign field accepts `required` (boolean, default true); `"required": false` lets the
 * signer leave the field blank. The `fields` parameter is a raw JSON passthrough forwarded
 * verbatim as a multipart part, so the flag must reach the API exactly as the author wrote it.
 * Server-side rules (signature/initial fields cannot be optional, `required` must be a boolean,
 * and a recipient needs at least one required editable field) are enforced by the API, not here.
 */
describe('TurboSign optional (required: false) fields', () => {
	const signature = {
		recipientEmail: 'client@example.com',
		type: 'signature',
		template: { anchor: '{ClientSignature}', placement: 'replace', size: { width: 200, height: 50 } },
	};
	const optionalText = {
		recipientEmail: 'client@example.com',
		type: 'text',
		required: false,
		template: { anchor: '{ClientNotes}', placement: 'replace', size: { width: 240, height: 30 } },
	};

	it.each(['prepareForSigning', 'prepareForReview'])(
		'%s forwards "required": false on a field to the API unchanged',
		async (operation) => {
			const fields = JSON.stringify([signature, optionalText]);
			const http = jest.fn().mockResolvedValue(okResponse({ id: 'doc-1', status: 'sent' }));
			const ctx = makeExecuteCtx({
				itemCount: 1,
				params: {
					resource: 'turboSign',
					operation,
					fileInputMethod: 'url',
					fileLink: 'https://example.com/agreement.pdf',
					recipients: '[{"name":"Client","email":"client@example.com","signingOrder":1}]',
					fields,
				},
				http,
			});

			await TurboDocx.prototype.execute.call(ctx);

			const sentFields = http.mock.calls[0][1].formData.fields;
			expect(sentFields).toBe(fields);
			expect(sentFields).toContain('"required":false');
			const parsed = JSON.parse(sentFields);
			expect(parsed[1].required).toBe(false);
			// A field that omits the flag is not given one (the API defaults it to required).
			expect(parsed[0]).not.toHaveProperty('required');
		},
	);
});
