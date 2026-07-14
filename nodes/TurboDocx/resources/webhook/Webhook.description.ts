import { INodeProperties } from 'n8n-workflow';

const RESOURCE = ['webhook'];

export const webhookOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: RESOURCE,
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: "Create the org's signature webhook",
				action: 'Create a webhook',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Soft-delete the signature webhook and its delivery history',
				action: 'Delete a webhook',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get the signature webhook with delivery stats and available events',
				action: 'Get a webhook',
			},
			{
				name: 'Get Stats',
				value: 'getStats',
				description: 'Get aggregate delivery stats over a sliding window',
				action: 'Get webhook stats',
			},
			{
				name: 'List Deliveries',
				value: 'listDeliveries',
				description: 'List historical delivery attempts for the signature webhook',
				action: 'List webhook deliveries',
			},
			{
				name: 'Notify',
				value: 'notify',
				description: 'Send a manual notification to all configured URLs',
				action: 'Notify a webhook',
			},
			{
				name: 'Regenerate Secret',
				value: 'regenerateSecret',
				description: 'Rotate the webhook HMAC secret (shown once)',
				action: 'Regenerate webhook secret',
			},
			{
				name: 'Replay Delivery',
				value: 'replayDelivery',
				description: 'Manually retry a specific past delivery by ID',
				action: 'Replay a webhook delivery',
			},
			{
				name: 'Test',
				value: 'test',
				description: 'Send a test delivery to all configured URLs',
				action: 'Test a webhook',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Patch one or more fields on the signature webhook',
				action: 'Update a webhook',
			},
		],
		default: 'get',
	},
];

/**
 * The subscribable signature events, in lifecycle order.
 *
 * `recipientSigned`, `signed` and `completed` are easy to confuse:
 * `recipient_signed` fires once PER SIGNER (and carries isFinalSigner), while `signed` is a
 * document-level partial-progress event that fires ONLY when signers still remain. So `signed`
 * never fires on the final signature, and a single-signer document never emits it at all.
 * To detect "the document is done", subscribe to `completed`, not `signed`.
 */
const EVENT_OPTIONS = [
	{
		name: 'Signature Document Sent',
		value: 'signature.document.sent',
		description: 'The document is dispatched to recipients',
	},
	{
		name: 'Signature Document Viewed',
		value: 'signature.document.viewed',
		description: 'A recipient opens the document for the first time',
	},
	{
		name: 'Signature Document Recipient Signed',
		value: 'signature.document.recipient_signed',
		description: 'An individual signer completes their signature. Fires once per signer.',
	},
	{
		name: 'Signature Document Signed',
		value: 'signature.document.signed',
		description:
			'A signer signs but the document is not yet complete. Never fires on the final signature.',
	},
	{
		name: 'Signature Document Completed',
		value: 'signature.document.completed',
		description: 'All recipients have signed and the signed PDF is finalized',
	},
	{
		name: 'Signature Document Finalization Failed',
		value: 'signature.document.finalization_failed',
		description:
			'The signed PDF failed to finalize (e.g. a signing error). The document is NOT completed.',
	},
	{
		name: 'Signature Document Voided',
		value: 'signature.document.voided',
		description: 'The document is voided or cancelled',
	},
];

export const webhookFields: INodeProperties[] = [
	// ===============================
	// Create
	// ===============================
	{
		displayName: 'URLs',
		name: 'urls',
		type: 'json',
		required: true,
		default: '[]',
		description:
			'JSON array of HTTPS endpoint URLs to deliver events to. HTTP URLs are rejected by the backend.',
		placeholder: '["https://example.com/webhooks/turbodocx"]',
		hint: 'Example: ["https://example.com/hook-a", "https://example.com/hook-b"]',
		displayOptions: {
			show: { resource: RESOURCE, operation: ['create'] },
		},
	},
	{
		displayName: 'Events',
		name: 'events',
		type: 'multiOptions',
		required: true,
		default: [],
		description: 'Signature events to subscribe this webhook to',
		options: EVENT_OPTIONS,
		displayOptions: {
			show: { resource: RESOURCE, operation: ['create'] },
		},
	},

	// ===============================
	// Update
	// ===============================
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: RESOURCE, operation: ['update'] },
		},
		options: [
			{
				displayName: 'Active',
				name: 'isActive',
				type: 'boolean',
				default: false,
				description: 'Whether the webhook is active and should receive deliveries',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				default: [],
				description: 'Replacement set of signature events to subscribe to',
				options: EVENT_OPTIONS,
			},
			{
				displayName: 'URLs',
				name: 'urls',
				type: 'json',
				default: '[]',
				description:
					'JSON array of HTTPS endpoint URLs. Replaces all existing URLs. HTTP URLs are rejected by the backend.',
				placeholder: '["https://example.com/webhooks/turbodocx"]',
				hint: 'Example: ["https://example.com/hook-a", "https://example.com/hook-b"]',
			},
		],
	},

	// ===============================
	// Test / Notify
	// ===============================
	{
		displayName: 'Event Type',
		name: 'eventType',
		type: 'options',
		default: 'signature.document.completed',
		description: 'The event type to simulate in the test/notify delivery',
		options: EVENT_OPTIONS,
		displayOptions: {
			show: { resource: RESOURCE, operation: ['test', 'notify'] },
		},
	},
	{
		displayName: 'Payload',
		name: 'payload',
		type: 'json',
		default: '{}',
		description: 'JSON object delivered as the event payload',
		placeholder: '{"documentId":"abc-123","status":"completed"}',
		hint: 'Example: {"documentId":"abc-123","status":"completed"}',
		displayOptions: {
			show: { resource: RESOURCE, operation: ['test', 'notify'] },
		},
	},

	// ===============================
	// Replay Delivery
	// ===============================
	{
		displayName: 'Delivery ID',
		name: 'deliveryId',
		type: 'string',
		required: true,
		default: '',
		description: 'ID of the past delivery attempt to retry',
		displayOptions: {
			show: { resource: RESOURCE, operation: ['replayDelivery'] },
		},
	},

	// ===============================
	// List Deliveries
	// ===============================
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: { resource: RESOURCE, operation: ['listDeliveries'] },
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: RESOURCE, operation: ['listDeliveries'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: { resource: RESOURCE, operation: ['listDeliveries'] },
		},
		options: [
			{
				displayName: 'Delivered',
				name: 'isDelivered',
				type: 'boolean',
				default: false,
				description: 'Whether to only return deliveries that succeeded',
			},
			{
				displayName: 'Event Type',
				name: 'eventType',
				type: 'options',
				default: 'signature.document.completed',
				description: 'Filter deliveries by event type',
				options: EVENT_OPTIONS,
			},
			{
				displayName: 'HTTP Status',
				name: 'httpStatus',
				type: 'number',
				default: 200,
				description: 'Filter deliveries by the HTTP status code returned by the endpoint',
			},
		],
	},

	// ===============================
	// Get Stats
	// ===============================
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: { resource: RESOURCE, operation: ['getStats'] },
		},
		options: [
			{
				displayName: 'Days',
				name: 'days',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 365 },
				default: 30,
				description: 'Sliding window in days (1-365) to aggregate stats over',
			},
		],
	},
];
