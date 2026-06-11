import {
	IHookFunctions,
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	IDataObject,
	IHttpRequestOptions,
	NodeOperationError,
} from 'n8n-workflow';

import { verifyWebhookSignature } from '../TurboDocx/shared/verifyWebhookSignature';

const DEFAULT_BASE_URL = 'https://api.turbodocx.com';
const WEBHOOK_NAME = 'signature';

interface WebhookStaticData extends IDataObject {
	secret?: string;
	registeredUrl?: string;
	createdByNode?: boolean;
}

async function baseUrlFromCreds(ctx: IHookFunctions): Promise<string> {
	const creds = await ctx.getCredentials('turboDocxApi');
	return (creds.baseUrl as string) || DEFAULT_BASE_URL;
}

async function apiRequest(
	ctx: IHookFunctions,
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
	endpoint: string,
	body?: IDataObject,
): Promise<{ statusCode: number; body: IDataObject }> {
	const baseUrl = await baseUrlFromCreds(ctx);
	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${endpoint}`,
		ignoreHttpStatusErrors: true,
		returnFullResponse: true,
	};
	if (body !== undefined) {
		options.body = body;
		options.json = true;
	}
	const res = (await ctx.helpers.httpRequestWithAuthentication.call(
		ctx,
		'turboDocxApi',
		options,
	)) as { statusCode: number; body: unknown };
	return { statusCode: res.statusCode, body: (res.body ?? {}) as IDataObject };
}

export class TurboDocxTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TurboDocx Trigger',
		name: 'turboDocxTrigger',
		icon: 'file:turbodocx.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '=Signature events',
		description: 'Starts a workflow when a TurboSign signature event occurs',
		defaults: {
			name: 'TurboDocx Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'turboDocxApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
				// Preserve the exact received bytes so the HMAC signature can be
				// verified (re-serializing the parsed body would change whitespace).
				rawBody: true,
			},
		],
		properties: [
			{
				displayName:
					'This trigger manages the single org-level "signature" webhook in TurboDocx. Requires an administrator API key. If a signature webhook already exists, this node adds its URL to it.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['signature.document.completed'],
				description: 'The signature events to subscribe to',
				options: [
					{
						name: 'Document Completed',
						value: 'signature.document.completed',
						description: 'All recipients have signed the document',
					},
					{
						name: 'Document Voided',
						value: 'signature.document.voided',
						description: 'The signature request was cancelled',
					},
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Verify Signature',
						name: 'verifySignature',
						type: 'boolean',
						default: true,
						description:
							'Whether to verify the HMAC signature on each delivery (recommended). Requires the webhook secret, which is only available when this node created the webhook.',
					},
					{
						displayName: 'Timestamp Tolerance (Seconds)',
						name: 'toleranceSeconds',
						type: 'number',
						typeOptions: { minValue: 0 },
						default: 300,
						description:
							'Maximum accepted age of a delivery timestamp, to prevent replay attacks. Set 0 to disable.',
					},
				],
			},
		],
		usableAsTool: true,
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const res = await apiRequest(this, 'GET', `/api/webhooks/${WEBHOOK_NAME}`);
				if (res.statusCode >= 400) return false;
				const data = (res.body.data as IDataObject) ?? res.body;
				const urls = (data.urls as string[]) ?? [];
				return urls.includes(webhookUrl);
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const events = this.getNodeParameter('events', []) as string[];
				const staticData = this.getWorkflowStaticData('node') as WebhookStaticData;

				if (!webhookUrl || !webhookUrl.startsWith('https://')) {
					throw new NodeOperationError(
						this.getNode(),
						'TurboDocx webhooks require an HTTPS callback URL. Use an HTTPS-reachable n8n instance (e.g. n8n Cloud or a tunnel).',
					);
				}

				// Is there already a signature webhook?
				const existing = await apiRequest(this, 'GET', `/api/webhooks/${WEBHOOK_NAME}`);

				if (existing.statusCode < 400 && existing.body) {
					const data = (existing.body.data as IDataObject) ?? existing.body;
					const existingUrls = (data.urls as string[]) ?? [];
					const existingEvents = (data.events as string[]) ?? [];
					const urls = Array.from(new Set([...existingUrls, webhookUrl]));
					const mergedEvents = Array.from(new Set([...existingEvents, ...events]));
					const patch = await apiRequest(this, 'PATCH', `/api/webhooks/${WEBHOOK_NAME}`, {
						urls,
						events: mergedEvents,
						isActive: true,
					});
					if (patch.statusCode >= 400) {
						throw new NodeOperationError(
							this.getNode(),
							`Failed to attach to the existing TurboDocx signature webhook (HTTP ${patch.statusCode}).`,
						);
					}
					staticData.registeredUrl = webhookUrl;
					staticData.createdByNode = false;
					// Secret is not returned on PATCH; verification will be skipped unless re-created.
					return true;
				}

				// None exists: create it.
				const created = await apiRequest(this, 'POST', '/api/webhooks', {
					name: WEBHOOK_NAME,
					urls: [webhookUrl],
					events,
				});
				if (created.statusCode >= 400) {
					throw new NodeOperationError(
						this.getNode(),
						`Failed to create the TurboDocx signature webhook (HTTP ${created.statusCode}). An administrator API key is required.`,
					);
				}
				const body = (created.body.data as IDataObject) ?? created.body;
				staticData.secret = body.secret as string;
				staticData.registeredUrl = webhookUrl;
				staticData.createdByNode = true;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const staticData = this.getWorkflowStaticData('node') as WebhookStaticData;

				const existing = await apiRequest(this, 'GET', `/api/webhooks/${WEBHOOK_NAME}`);
				if (existing.statusCode < 400 && existing.body) {
					const data = (existing.body.data as IDataObject) ?? existing.body;
					const urls = ((data.urls as string[]) ?? []).filter((u) => u !== webhookUrl);
					if (urls.length > 0) {
						// Other receivers remain: just drop our URL.
						await apiRequest(this, 'PATCH', `/api/webhooks/${WEBHOOK_NAME}`, { urls });
					} else if (staticData.createdByNode) {
						// We created it and we're the last URL: remove the webhook.
						await apiRequest(this, 'DELETE', `/api/webhooks/${WEBHOOK_NAME}`);
					} else {
						await apiRequest(this, 'PATCH', `/api/webhooks/${WEBHOOK_NAME}`, { urls });
					}
				}

				delete staticData.secret;
				delete staticData.registeredUrl;
				delete staticData.createdByNode;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject() as unknown as {
			rawBody?: Buffer;
			readRawBody?: () => Promise<void>;
		};
		const headers = this.getHeaderData() as IDataObject;
		const bodyData = this.getBodyData() as IDataObject;
		const options = this.getNodeParameter('options', {}) as IDataObject;
		const subscribedEvents = this.getNodeParameter('events', []) as string[];
		const staticData = this.getWorkflowStaticData('node') as WebhookStaticData;

		const verifySignature = options.verifySignature !== false;
		const toleranceSeconds =
			options.toleranceSeconds !== undefined ? (options.toleranceSeconds as number) : 300;

		// Signature verification (when we hold the secret).
		if (verifySignature && staticData.secret) {
			const signature =
				(headers['x-turbodocx-signature'] as string) || (headers['X-TurboDocx-Signature'] as string);
			const timestamp =
				(headers['x-turbodocx-timestamp'] as string) || (headers['X-TurboDocx-Timestamp'] as string);

			// HMAC must be computed over the EXACT received bytes. The webhook is
			// registered with `rawBody: true` so n8n preserves them; never
			// re-serialize the parsed body (whitespace would differ and never match).
			if (!req.rawBody && typeof req.readRawBody === 'function') {
				await req.readRawBody();
			}
			const rawBody = req.rawBody;

			if (!rawBody) {
				// Can't verify without the raw bytes: fail closed (drop the delivery)
				// rather than re-stringifying and producing a false match/mismatch.
				return { noWebhookResponse: true };
			}

			const valid = verifyWebhookSignature(rawBody, signature, timestamp, staticData.secret, {
				toleranceSeconds,
			});
			if (!valid) {
				// Reject without starting the workflow.
				return { noWebhookResponse: true };
			}
		}

		// Filter by subscribed event type when present on the payload.
		const eventType =
			(bodyData.eventType as string) || (bodyData.event as string) || undefined;
		if (eventType && subscribedEvents.length > 0 && !subscribedEvents.includes(eventType)) {
			return { noWebhookResponse: true };
		}

		return {
			workflowData: [this.helpers.returnJsonArray([bodyData])],
		};
	}
}
