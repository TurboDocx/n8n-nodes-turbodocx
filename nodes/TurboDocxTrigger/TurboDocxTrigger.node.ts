import {
	IHookFunctions,
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	IDataObject,
	IHttpRequestOptions,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

import { verifyWebhookSignature } from '../TurboDocx/shared/verifyWebhookSignature';
import { resolveClientContextHeaders } from '../TurboDocx/shared/clientContext';

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
		// Same client-context headers the main node sends, so webhook management calls are
		// attributed to the real n8n host rather than an anonymous API client.
		headers: { ...resolveClientContextHeaders() },
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

/**
 * A response is a success only inside 2xx. The old `>= 400` / `< 400` guards on these webhook
 * management calls treated a 3xx redirect (or a missing status code) as success — the same
 * non-2xx-as-success defect fixed for the main node's helpers (#20/#22). Getting it wrong here
 * is worse than elsewhere: `create()` would read `secret` off a non-2xx body that never carried
 * one, silently disabling signature verification. Mirrors `assertOk` in GenericFunctions.
 */
const isSuccess = (statusCode?: number): boolean =>
	statusCode !== undefined && statusCode >= 200 && statusCode < 300;

// n8n verification finding #2: a trigger cannot be invoked as an AI tool, so it must not carry
// `usableAsTool`. The type only permits `true` (not `false`), and omitting it trips the
// community-node lint rule, so the rule is disabled here with that justification.
// eslint-disable-next-line @n8n/community-nodes/node-usable-as-tool -- triggers are never AI tools
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
			// No space. n8n builds the production webhook path as
			// `{workflowId}/{nodeName.toLowerCase()}/{path}`, so a space here is stored
			// percent-encoded but matched decoded on the way in — n8n then 404s a URL it
			// registered itself, and every delivery is silently dropped. The workflow still
			// shows as active and the subscription still shows as healthy, so there is
			// nothing to see until you notice the events never arrive.
			name: 'TurboDocxTrigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
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
				description:
					'The signature events to subscribe to. Note that "Document Signed" is partial-progress only — it never fires on the final signature. Use "Document Completed" to detect that the whole document is done.',
				// n8n requires multiOptions to be alphabetized by name, so this list is NOT in
				// lifecycle order. The lifecycle is: sent -> viewed -> recipient_signed (per signer)
				// -> signed (only while signers remain) -> completed | finalization_failed, or voided.
				options: [
					{
						name: 'Document Completed',
						value: 'signature.document.completed',
						description: 'All recipients have signed and the signed PDF is finalized',
					},
					{
						name: 'Document Finalization Failed',
						value: 'signature.document.finalization_failed',
						description:
							'The signed PDF failed to finalize (e.g. a signing error). The document is NOT completed.',
					},
					{
						name: 'Document Recipient Signed',
						value: 'signature.document.recipient_signed',
						description:
							'An individual signer completes their signature. Fires once per signer, and carries isFinalSigner.',
					},
					{
						name: 'Document Sent',
						value: 'signature.document.sent',
						description: 'The document is dispatched to recipients',
					},
					{
						name: 'Document Signed',
						value: 'signature.document.signed',
						description:
							'A signer signs but the document is not yet complete. Never fires on the final signature, and a single-signer document never emits it at all.',
					},
					{
						name: 'Document Viewed',
						value: 'signature.document.viewed',
						description: 'A recipient opens the document for the first time',
					},
					{
						name: 'Document Voided',
						value: 'signature.document.voided',
						description: 'The document is voided or cancelled',
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
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const res = await apiRequest(this, 'GET', `/api/webhooks/${WEBHOOK_NAME}`);
				if (!isSuccess(res.statusCode)) return false;
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

				if (isSuccess(existing.statusCode) && existing.body) {
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
					if (!isSuccess(patch.statusCode)) {
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
				if (!isSuccess(created.statusCode)) {
					// Only an auth status genuinely implies an insufficient key; a 409 means
					// another receiver created the webhook between our GET and POST, and a
					// 400 is a validation problem — don't misattribute those to the key.
					const hint =
						created.statusCode === 401 || created.statusCode === 403
							? ' An administrator API key is required.'
							: created.statusCode === 409
								? ' A signature webhook already exists; re-run to attach to it.'
								: '';
					throw new NodeOperationError(
						this.getNode(),
						`Failed to create the TurboDocx signature webhook (HTTP ${created.statusCode}).${hint}`,
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
				if (isSuccess(existing.statusCode) && existing.body) {
					const data = (existing.body.data as IDataObject) ?? existing.body;
					const urls = ((data.urls as string[]) ?? []).filter((u) => u !== webhookUrl);
					if (urls.length > 0) {
						// Other receivers remain: just drop our URL.
						await apiRequest(this, 'PATCH', `/api/webhooks/${WEBHOOK_NAME}`, { urls });
					} else if (staticData.createdByNode) {
						// We created it and we're the last URL: remove the webhook.
						await apiRequest(this, 'DELETE', `/api/webhooks/${WEBHOOK_NAME}`);
					} else {
						// A webhook we only attached to, and our URL was its only one — which happens
						// when this node's static data was lost (workflow re-imported/copied) so we no
						// longer know we created it.
						//
						// We CANNOT send `urls: []`: the backend's update schema keeps `.min(1)` on the
						// array even though the field is optional, so an empty array is a 400 ("At least
						// one webhook URL is required") and the deregistration would silently no-op,
						// leaving the org webhook firing at a dead n8n URL. Deactivate instead and leave
						// the (now-stale) URL in place — a subsequent activation re-points and re-enables it.
						await apiRequest(this, 'PATCH', `/api/webhooks/${WEBHOOK_NAME}`, {
							isActive: false,
						});
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

		// Explicitly reject a delivery with a status code so the sender's HTTP
		// connection is closed immediately instead of hanging until its timeout.
		const reject = (statusCode: number, message: string): IWebhookResponseData => {
			this.getResponseObject().status(statusCode).send(message).end();
			return { noWebhookResponse: true };
		};

		// Fail-open guard: verification is enabled but we hold no secret (this node
		// attached to a pre-existing org-level webhook, which never returns one).
		// Warn so the inert security control is visible rather than silently off.
		if (verifySignature && !staticData.secret) {
			this.logger.warn(
				'TurboDocx Trigger: "Verify Signature" is enabled but no webhook secret is stored ' +
					'(this node attached to a pre-existing signature webhook). Deliveries are NOT being ' +
					'verified. Re-create the webhook from this node to obtain a secret, or disable Verify Signature.',
			);
		}

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
				// Can't verify without the raw bytes: fail closed, but answer the request.
				return reject(400, 'Cannot verify signature: raw request body unavailable');
			}

			const valid = verifyWebhookSignature(rawBody, signature, timestamp, staticData.secret, {
				toleranceSeconds,
			});
			if (!valid) {
				return reject(401, 'Invalid webhook signature');
			}
		}

		// Filter by subscribed event type when present on the payload. Return {} so
		// n8n sends its default 200 (the delivery is acknowledged, just not run) —
		// returning noWebhookResponse without writing a response would hang the caller.
		const eventType =
			(bodyData.eventType as string) || (bodyData.event as string) || undefined;
		if (eventType && subscribedEvents.length > 0 && !subscribedEvents.includes(eventType)) {
			return {};
		}

		return {
			workflowData: [this.helpers.returnJsonArray([bodyData])],
		};
	}
}
