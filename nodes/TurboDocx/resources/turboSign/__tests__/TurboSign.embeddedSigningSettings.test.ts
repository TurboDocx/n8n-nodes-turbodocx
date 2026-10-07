import { TurboDocx } from '../../../TurboDocx.node';
import { makeExecuteCtx, okResponse } from '../../../__tests__/helpers';

/**
 * `GET /turbosign/embedded-signing-settings` reports the org-wide embedded-signing gates. The
 * response is double-enveloped `{ data: { results } }` (same as createSigningUrl), so the node must
 * unwrap to `results` — a workflow gating on `$json.enabled` should not reach through
 * `$json.data.results.enabled`.
 */
describe('TurboSign getEmbeddedSigningSettings', () => {
	const RESULTS = {
		enabled: true,
		allowExternalIdv: false,
		allowIdentityOverride: false,
		defaultChannel: 'email',
		allowChannelOverride: false,
		allowedFrameAncestors: ['https://app.example.com'],
	};

	it('GETs the settings endpoint and unwraps { data: { results } }', async () => {
		const http = jest.fn().mockResolvedValue(okResponse({ data: { results: RESULTS } }));
		const ctx = makeExecuteCtx({
			itemCount: 1,
			params: { resource: 'turboSign', operation: 'getEmbeddedSigningSettings' },
			http,
		});

		const [items] = await TurboDocx.prototype.execute.call(ctx);

		expect(http).toHaveBeenCalledTimes(1);
		const request = http.mock.calls[0][1];
		expect(request.method).toBe('GET');
		expect(request.url).toBe('https://api.example.com/turbosign/embedded-signing-settings');
		expect(items[0].json).not.toHaveProperty('data');
		expect(items[0].json).toEqual(RESULTS);
		expect(items[0].json.enabled).toBe(true);
		// Passed through untouched: false means the org locked the channel (OtpOverrideNotAllowed).
		expect(items[0].json.allowChannelOverride).toBe(false);
		expect(items[0].json.allowedFrameAncestors).toEqual(['https://app.example.com']);
	});
});
