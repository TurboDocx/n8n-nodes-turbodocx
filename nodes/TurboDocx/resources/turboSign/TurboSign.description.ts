import { INodeProperties } from 'n8n-workflow';

const RESOURCE = ['turboSign'];

export const turboSignOperations: INodeProperties[] = [
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
				name: 'Download Document',
				value: 'downloadDocument',
				description: 'Download the signed PDF document',
				action: 'Download signed document',
			},
			{
				name: 'Get Audit Trail',
				value: 'getAuditTrail',
				description: 'Get the tamper-evident audit trail for a signature document',
				action: 'Get audit trail',
			},
			{
				name: 'Get Recipients',
				value: 'getRecipients',
				description:
					'Get every recipient with their signing status, email history, and who sent the document',
				action: 'Get document recipients',
			},
			{
				name: 'Get Review Link',
				value: 'prepareForReview',
				description:
					'Upload a document with fields and recipients and get a review link (no emails sent)',
				action: 'Get review link',
			},
			{
				name: 'Get Status',
				value: 'getStatus',
				description: 'Get the document-level status only (use Get Recipients for per-signer detail)',
				action: 'Get document status',
			},
			{
				name: 'Resend Email',
				value: 'resendEmail',
				description: 'Resend the signature request email to specific recipients',
				action: 'Resend signature email',
			},
			{
				name: 'Send Reminder',
				value: 'sendReminder',
				description:
					'Nudge a document\'s outstanding signers, ignoring the automatic reminder schedule',
				action: 'Send a signature reminder',
			},
			{
				name: 'Send Signature',
				value: 'prepareForSigning',
				description:
					'Upload a document with fields and recipients and email a signature request',
				action: 'Send a signature request',
			},
			{
				name: 'Void',
				value: 'voidDocument',
				description: 'Cancel a signature request',
				action: 'Void signature document',
			},
		],

		default: 'prepareForSigning',
	},
];

export const turboSignFields: INodeProperties[] = [
	// ===============================
	// Prepare for Review / Prepare for Signing - Common Fields
	// ===============================
	{
		displayName: 'File Input Method',
		name: 'fileInputMethod',
		type: 'options',
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['prepareForReview', 'prepareForSigning'],
			},
		},
		options: [
			{
				name: 'Upload File',
				value: 'upload',
				description: 'Upload PDF, DOCX, or PPTX from binary data',
			},
			{
				name: 'File URL',
				value: 'url',
				description: 'Provide URL to hosted file (S3, Google Drive, etc.)',
			},
			{
				name: 'Deliverable',
				value: 'deliverable',
				description: 'Use existing TurboDocx deliverable (references generated PDF)',
			},
			{
				name: 'Template',
				value: 'template',
				description: 'Use TurboDocx template (converts DOCX/PPTX to PDF)',
			},
		],
		default: 'upload',
		description: 'How to provide the document file',
	},
	{
		displayName: 'File',
		name: 'pdfFile',
		type: 'string',
		requiresDataPath: 'single',
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['prepareForReview', 'prepareForSigning'],
				fileInputMethod: ['upload'],
			},
		},
		default: 'data',
		description:
			'The input binary field containing the file to process (supports PDF, DOCX, PPTX)',
		required: true,
		hint: 'Select the binary field from a previous node (e.g., from Read Binary File node)',
	},
	{
		displayName: 'File URL',
		name: 'fileLink',
		type: 'string',
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['prepareForReview', 'prepareForSigning'],
				fileInputMethod: ['url'],
			},
		},
		default: '',
		description: 'URL to hosted file (e.g., https://my-bucket.s3.amazonaws.com/contract.pdf)',
		required: true,
	},
	{
		displayName: 'Deliverable ID',
		name: 'deliverableId',
		type: 'string',
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['prepareForReview', 'prepareForSigning'],
				fileInputMethod: ['deliverable'],
			},
		},
		default: '',
		description: 'UUID of existing TurboDocx deliverable to use for signature request',
		required: true,
	},
	{
		displayName: 'Template ID',
		name: 'templateId',
		type: 'string',
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['prepareForReview', 'prepareForSigning'],
				fileInputMethod: ['template'],
			},
		},
		default: '',
		description: 'UUID of TurboDocx template to use (will be converted to PDF)',
		required: true,
	},
	{
		displayName: 'Recipients',
		name: 'recipients',
		type: 'json',
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['prepareForReview', 'prepareForSigning'],
			},
		},
		default: '',
		description:
			'JSON array of recipients with name, email, signingOrder, and metadata (color, lightColor)',
		required: true,
		placeholder:
			'[{"name":"Sales Rep","email":"sales@example.com","signingOrder":1},{"name":"Client Name","email":"client@example.com","signingOrder":2}]',
		hint: 'Example: [{"name":"Sales Rep","email":"sales@example.com","signingOrder":1},{"name":"Client Name","email":"client@example.com","signingOrder":2}]',
	},
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'json',
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['prepareForReview', 'prepareForSigning'],
			},
		},
		default: '',
		description:
			'JSON array of signature fields with recipientEmail, type, and template anchor. Optional per-field "defaultValue" pre-fills the field (max 600 characters); for a "date" field set it to a fixed date in MM/DD/YYYY (e.g. "12/31/2026") or omit it to auto-fill the signing date ("signature"/"initial" fields cannot carry one, and a "date" field cannot be readonly). Optional per-field "metadata" enables conditional (IF/THEN) logic: put "metadata":{"fieldKey":"agree_terms"} on a controlling checkbox, and on a dependent field add "metadata":{"conditional":{"controllingFieldKey":"agree_terms","operator":"is_checked" or "is_not_checked","action":"show" or "unlock"}} (show = hidden until met; unlock = visible-but-read-only until met).',
		required: true,
		placeholder:
			'[{"recipientEmail":"sales@example.com","type":"signature","template":{"anchor":"{Signature1}","placement":"replace","size":{"width":200,"height":50}}}]',
		hint: 'Example: [{"recipientEmail":"sales@example.com","type":"signature","template":{"anchor":"{SalesSigner}","placement":"replace","size":{"width":200,"height":50}}},{"recipientEmail":"client@example.com","type":"signature","template":{"anchor":"{ClientSigner}","placement":"replace","size":{"width":200,"height":50}}}]. Conditional example: a checkbox {"recipientEmail":"client@example.com","type":"checkbox","template":{"anchor":"{AgreeTerms}","placement":"replace","size":{"width":20,"height":20}},"metadata":{"fieldKey":"agree_terms"}} controls a text field {"recipientEmail":"client@example.com","type":"text","template":{"anchor":"{Reason}","placement":"replace","size":{"width":200,"height":30}},"metadata":{"conditional":{"controllingFieldKey":"agree_terms","operator":"is_checked","action":"show"}}}. Date default example: {"recipientEmail":"client@example.com","type":"date","template":{"anchor":"{EffectiveDate}","placement":"replace","size":{"width":120,"height":20}},"defaultValue":"12/31/2026"}.',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['prepareForReview', 'prepareForSigning'],
			},
		},
		options: [
			{
				displayName: 'CC Emails',
				name: 'ccEmails',
				type: 'json',
				default: '[]',
				description: 'JSON array of email addresses to CC when document is completed (max 10)',
				placeholder: '["admin@company.com", "records@company.com"]',
			},
			{
				displayName: 'Document Description',
				name: 'documentDescription',
				type: 'string',
				default: '',
				description: 'Description for the signature document',
			},
			{
				displayName: 'Document Name',
				name: 'documentName',
				type: 'string',
				default: '',
				description: 'Name for the signature document',
			},
			{
				displayName: 'Sender Email',
				name: 'senderEmail',
				type: 'string',
				default: '',
				placeholder: 'sales@yourcompany.com',
				description:
					'Required. The reply-to address recipients see on the signature email, and the sender recorded in the audit trail. API-key requests have no mailbox of their own, so TurboDocx rejects the request if this is empty rather than sending from an unmonitored address.',
			},
			{
				displayName: 'Sender Name',
				name: 'senderName',
				type: 'string',
				default: '',
				description:
					'Name of the sender (displayed in emails and the audit trail). Defaults to the name of the API key configured in your TurboDocx credential.',
			},
		],
	},

	// ===============================
	// Get Document Status Fields
	// ===============================
	{
		displayName: 'Document ID',
		name: 'documentId',
		type: 'string',
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: [
					'getStatus',
					'getRecipients',
					'downloadDocument',
					'voidDocument',
					'resendEmail',
					'sendReminder',
					'getAuditTrail',
				],
			},
		},
		default: '',
		description: 'UUID of the signature document',
		required: true,
	},

	// ===============================
	// Void Document Fields
	// ===============================
	{
		displayName: 'Void Reason',
		name: 'voidReason',
		type: 'string',
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['voidDocument'],
			},
		},
		default: '',
		description: 'Reason for voiding the document (required, max 500 characters)',
		required: true,
	},

	// ===============================
	// Resend Email Fields
	// ===============================
	{
		displayName: 'Recipient IDs',
		name: 'recipientIds',
		type: 'json',
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['resendEmail'],
			},
		},
		default: '',
		description: 'JSON array of recipient UUIDs to resend emails to',
		required: true,
		placeholder: '["5f673f37-9912-4e72-85aa-8f3649760f6b"]',
		hint: 'Example: ["5f673f37-9912-4e72-85aa-8f3649760f6b"]',
	},

	// ===============================
	// Send Reminder Fields
	// ===============================
	{
		displayName: 'Recipient IDs',
		name: 'reminderRecipientIds',
		type: 'json',
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['sendReminder'],
			},
		},
		default: '',
		description:
			'Optional JSON array of recipient UUIDs to remind. Leave empty to remind every signer whose turn it is.',
		placeholder: '["5f673f37-9912-4e72-85aa-8f3649760f6b"]',
		hint: 'Leave empty to remind all eligible signers. Only signers at the current signing order are emailed.',
	},
];
