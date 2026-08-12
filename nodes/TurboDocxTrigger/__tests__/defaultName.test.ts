import { TurboDocxTrigger } from '../TurboDocxTrigger.node';

/**
 * n8n builds a production webhook path as `{workflowId}/{nodeName}/{path}`, lowercasing
 * the node name. Whitespace in that name is stored percent-encoded but matched decoded on
 * the way in, so n8n returns 404 for a URL it registered itself and every delivery is
 * dropped.
 *
 * There is nothing to see when this breaks: the workflow reads as active, the TurboDocx
 * subscription reads as healthy, and the events simply never arrive. That invisibility is
 * why it needs a test rather than review attention.
 */
describe('TurboDocxTrigger default node name', () => {
	it('has no whitespace, so the generated webhook path stays routable', () => {
		const name = new TurboDocxTrigger().description.defaults.name as string;
		expect(name).toBeDefined();
		expect(name).not.toMatch(/\s/);
	});

	it('still declares the simple webhook path the URL is built from', () => {
		const webhooks = new TurboDocxTrigger().description.webhooks ?? [];
		expect(webhooks).toHaveLength(1);
		expect(webhooks[0].path).toBe('webhook');
		expect(webhooks[0].httpMethod).toBe('POST');
	});
});
