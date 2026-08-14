import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/**
 * Partner organization display preferences — GET/PATCH
 * `/partner/{partnerId}/organizations/{orgId}/preferences`.
 *
 * Two things the node has to get right and nothing else checks:
 *
 * 1. The PATCH body is wrapped: `{ preferences: { ... } }`. A bare object of booleans
 *    fails the backend's Joi schema, which requires the `preferences` key.
 * 2. Only the keys the user actually added to the collection are sent. The endpoint
 *    merges the keys it receives into the org's preferences blob and preserves the
 *    rest, so forwarding an unset toggle would silently overwrite a tenant's setting.
 *
 * The empty-collection guard exists because the backend marks the object `.min(1)` —
 * an untouched "Preferences" collection is a 400 round trip, not a no-op.
 */
describe('Partner organization preferences', () => {
	const PARTNER_ID = 'partner-uuid';
	const ORG_ID = 'org-uuid';
	const PREFERENCES = {
		hideSignatureOutline: false,
		hideSignatureHash: false,
		lockedFieldsBackground: true,
		allowDownloadBeforeSigning: false,
	};

	function run(params: Record<string, unknown>) {
		const http = jest.fn().mockResolvedValue(
			okResponse({ success: true, data: { preferences: PREFERENCES } }),
		);
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'partnerOrganization', organizationId: ORG_ID, ...params },
			http,
			credentials: { partnerId: PARTNER_ID },
		});
		return { ctx, http };
	}

	const sentRequest = (http: jest.Mock) => http.mock.calls[0][1];

	it('reads preferences from the org preferences endpoint', async () => {
		const { ctx, http } = run({ operation: 'getPreferences' });

		const result = await TurboDocx.prototype.execute.call(ctx);

		expect(sentRequest(http).method).toBe('GET');
		expect(sentRequest(http).url).toBe(
			`https://api.example.com/partner/${PARTNER_ID}/organizations/${ORG_ID}/preferences`,
		);
		// `unwrap: 'data'` strips the `{ success, data }` envelope, leaving the payload.
		expect(result[0][0].json).toEqual({ preferences: PREFERENCES });
	});

	it('wraps the update body under a preferences key', async () => {
		const { ctx, http } = run({
			operation: 'updatePreferences',
			preferences: { lockedFieldsBackground: false },
		});

		await TurboDocx.prototype.execute.call(ctx);

		expect(sentRequest(http).method).toBe('PATCH');
		expect(sentRequest(http).url).toBe(
			`https://api.example.com/partner/${PARTNER_ID}/organizations/${ORG_ID}/preferences`,
		);
		expect(sentRequest(http).body).toEqual({ preferences: { lockedFieldsBackground: false } });
	});

	it('sends only the preferences the user added, not the untouched ones', async () => {
		const { ctx, http } = run({
			operation: 'updatePreferences',
			preferences: { hideSignatureHash: true },
		});

		await TurboDocx.prototype.execute.call(ctx);

		const body = sentRequest(http).body as { preferences: Record<string, unknown> };
		expect(Object.keys(body.preferences)).toEqual(['hideSignatureHash']);
		expect(body.preferences.lockedFieldsBackground).toBeUndefined();
		expect(body.preferences.hideSignatureOutline).toBeUndefined();
		expect(body.preferences.allowDownloadBeforeSigning).toBeUndefined();
	});

	it('fails before the request when no preference was added', async () => {
		const { ctx, http } = run({ operation: 'updatePreferences', preferences: {} });

		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toThrow(
			/No preferences to update/,
		);
		expect(http).not.toHaveBeenCalled();
	});

	// The API validates these strictly — a string "true" is a 400, not a coerced true.
	// The toggles can't produce one, but an expression can, so the node names the key
	// instead of letting an opaque server error come back.
	it('rejects a non-boolean preference value before the request', async () => {
		const { ctx, http } = run({
			operation: 'updatePreferences',
			preferences: { hideSignatureHash: 'true' },
		});

		await expect(TurboDocx.prototype.execute.call(ctx)).rejects.toThrow(
			/"hideSignatureHash" must be true or false/,
		);
		expect(http).not.toHaveBeenCalled();
	});
});
