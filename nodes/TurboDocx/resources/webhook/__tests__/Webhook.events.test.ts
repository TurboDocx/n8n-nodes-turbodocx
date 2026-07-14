/**
 * Contract test for the subscribable signature events.
 *
 * The backend dispatches SEVEN events (`WebhookEvents` in `src/models/Webhook/IWebhook.ts`), but
 * both event dropdowns in this node hardcoded only two — `completed` and `voided`. Because they
 * are `multiOptions` with no free-text escape, a user simply COULD NOT subscribe to the other
 * five through the UI; `finalization_failed`, the one event that tells you a signed PDF failed to
 * finalize, was unreachable.
 *
 * These lists are hardcoded (rather than loaded from the API) so the dropdown still populates
 * before credentials are configured. The trade-off is that they can drift from the backend — which
 * is exactly what happened. This test is the guard: it pins both dropdowns to the full event set.
 */

import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import { webhookFields } from '../Webhook.description';
import { TurboDocxTrigger } from '../../../../TurboDocxTrigger/TurboDocxTrigger.node';

/** The backend's WebhookEvents enum, verbatim. */
const BACKEND_EVENTS = [
	'signature.document.sent',
	'signature.document.viewed',
	'signature.document.signed',
	'signature.document.recipient_signed',
	'signature.document.completed',
	'signature.document.finalization_failed',
	'signature.document.voided',
];

/** Every `events` multiOptions field in a property list. */
const eventFieldsIn = (properties: INodeProperties[]): INodeProperties[] =>
	properties.filter((p) => p.name === 'events' && p.type === 'multiOptions');

const valuesOf = (field: INodeProperties): string[] =>
	((field.options ?? []) as INodePropertyOptions[]).map((o) => String(o.value));

describe('subscribable signature events', () => {
	describe('Webhook resource', () => {
		const fields = eventFieldsIn(webhookFields);

		it('exposes an events dropdown', () => {
			expect(fields.length).toBeGreaterThan(0);
		});

		it.each(BACKEND_EVENTS)('offers %s', (event) => {
			for (const field of fields) {
				expect(valuesOf(field)).toContain(event);
			}
		});

		it('offers exactly the backend event set — no extras, none missing', () => {
			for (const field of fields) {
				expect(valuesOf(field).sort()).toEqual([...BACKEND_EVENTS].sort());
			}
		});

		it('describes every option, so the recipient_signed/signed distinction is visible in the UI', () => {
			for (const field of fields) {
				for (const option of (field.options ?? []) as INodePropertyOptions[]) {
					expect(typeof option.description).toBe('string');
					expect(option.description).not.toHaveLength(0);
				}
			}
		});
	});

	describe('Trigger node', () => {
		const fields = eventFieldsIn(new TurboDocxTrigger().description.properties);

		it('offers exactly the backend event set — no extras, none missing', () => {
			expect(fields).toHaveLength(1);
			expect(valuesOf(fields[0]).sort()).toEqual([...BACKEND_EVENTS].sort());
		});

		it('still defaults to completed — the safe "document is done" signal', () => {
			// `signed` would be the wrong default: it never fires on the final signature, and a
			// single-signer document never emits it at all.
			expect(fields[0].default).toEqual(['signature.document.completed']);
		});
	});
});
