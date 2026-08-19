import { NodeOperationError } from 'n8n-workflow';
import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/**
 * Conditional (IF/THEN) fields.
 *
 * The `fields` parameter is a raw JSON passthrough forwarded verbatim as a multipart part, so a
 * per-field `metadata.conditional` rule already reaches the backend with ZERO serialization
 * change. These tests pin the two guarantees the node makes around that:
 *
 *   (a) a fields JSON carrying `metadata.conditional` is handed to the multipart body UNCHANGED
 *       (byte-for-byte the same string the author supplied), and
 *   (b) a MALFORMED rule is rejected client-side with a NodeOperationError, matching the
 *       backend's new 400, before the round-trip.
 *
 * A DANGLING `controllingFieldKey` (one that names no existing checkbox) is deliberately NOT an
 * error — the backend fails open by design, so the node must let it through.
 */
describe('TurboSign conditional (IF/THEN) fields', () => {
	// A checkbox with a stable fieldKey controls a text field via is_checked -> show.
	const controllingCheckbox = {
		recipientEmail: 'client@example.com',
		type: 'checkbox',
		template: {
			anchor: '{OtherReasonToggle}',
			placement: 'replace',
			size: { width: 20, height: 20 },
		},
		metadata: { fieldKey: 'other_reason_toggle' },
	};

	function dependentText(conditional: Record<string, unknown>) {
		return {
			recipientEmail: 'client@example.com',
			type: 'text',
			template: {
				anchor: '{OtherReason}',
				placement: 'replace',
				size: { width: 240, height: 30 },
			},
			metadata: { conditional },
		};
	}

	function run(fields: string) {
		const http = jest.fn().mockResolvedValue(okResponse({ id: 'doc-1', status: 'sent' }));
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: {
				resource: 'turboSign',
				operation: 'prepareForSigning',
				fileInputMethod: 'url',
				fileLink: 'https://example.com/agreement.pdf',
				recipients: '[{"name":"Client","email":"client@example.com","signingOrder":1}]',
				fields,
			},
			http,
		});
		return { ctx, http };
	}

	it('forwards a fields JSON carrying metadata.conditional to the multipart body unchanged', async () => {
		const fields = JSON.stringify([
			controllingCheckbox,
			dependentText({
				controllingFieldKey: 'other_reason_toggle',
				operator: 'is_checked',
				action: 'show',
			}),
		]);
		const { ctx, http } = run(fields);

		await TurboDocx.prototype.execute.call(ctx);

		// Multipart uploads go through the legacy helper with the request body handed over as
		// `formData`. The `fields` part must be the exact string the author supplied — proving
		// `metadata.conditional` survives without any re-serialization.
		const formData = http.mock.calls[0][1].formData;
		expect(formData.fields).toBe(fields);
		expect(JSON.parse(formData.fields)[1].metadata.conditional).toEqual({
			controllingFieldKey: 'other_reason_toggle',
			operator: 'is_checked',
			action: 'show',
		});
	});

	it('allows a dangling controllingFieldKey (backend fails open by design)', async () => {
		const fields = JSON.stringify([
			dependentText({
				controllingFieldKey: 'no_such_checkbox',
				operator: 'is_not_checked',
				action: 'unlock',
			}),
		]);
		const { ctx, http } = run(fields);

		await TurboDocx.prototype.execute.call(ctx);

		// Not rejected, and forwarded unchanged.
		expect(http.mock.calls[0][1].formData.fields).toBe(fields);
	});

	it('throws a NodeOperationError when the operator is invalid', async () => {
		const fields = JSON.stringify([
			controllingCheckbox,
			dependentText({
				controllingFieldKey: 'other_reason_toggle',
				operator: 'equals',
				action: 'show',
			}),
		]);
		const { ctx, http } = run(fields);

		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toBeInstanceOf(NodeOperationError);
		// Rejected client-side, before any request is made.
		expect(http).not.toHaveBeenCalled();
	});

	it('throws a NodeOperationError when the action is invalid', async () => {
		const fields = JSON.stringify([
			controllingCheckbox,
			dependentText({
				controllingFieldKey: 'other_reason_toggle',
				operator: 'is_checked',
				action: 'reveal',
			}),
		]);
		const { ctx, http } = run(fields);

		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toBeInstanceOf(NodeOperationError);
		expect(http).not.toHaveBeenCalled();
	});

	it('throws a NodeOperationError when controllingFieldKey is missing or empty', async () => {
		const fields = JSON.stringify([
			dependentText({ operator: 'is_checked', action: 'show' }),
		]);
		const { ctx, http } = run(fields);

		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toBeInstanceOf(NodeOperationError);
		expect(http).not.toHaveBeenCalled();
	});

	it('does not touch fields that carry no metadata', async () => {
		const fields = JSON.stringify([
			{
				recipientEmail: 'client@example.com',
				type: 'signature',
				template: { anchor: '{Sig}', placement: 'replace', size: { width: 200, height: 50 } },
			},
		]);
		const { ctx, http } = run(fields);

		await TurboDocx.prototype.execute.call(ctx);

		expect(http.mock.calls[0][1].formData.fields).toBe(fields);
	});
});
