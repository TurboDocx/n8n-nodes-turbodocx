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
				name: 'Create Embedded Signature',
				value: 'createEmbeddedSignature',
				description:
					'Send a document AND mint a per-recipient embedded signing URL in one call (in-app / iframe signing), with optional per-recipient OTP or identity verification',
				action: 'Create an embedded signature',
			},
			{
				name: 'Create Signing URL',
				value: 'createSigningUrl',
				description:
					'Get the embedded signing URL for one recipient of an already-sent document. External IDV and override links are single-use; otp and no-verification recipients get their reusable signing link.',
				action: 'Create a signing URL',
			},
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
				name: 'Get Embedded Signing Settings',
				value: 'getEmbeddedSigningSettings',
				description:
					'Read the org-wide embedded-signing gates: enabled, external IDV allowed, override allowed, default OTP channel, allowChannelOverride (false means a different channel is rejected with OtpOverrideNotAllowed), and allowed frame ancestors (empty denies framing everywhere)',
				action: 'Get embedded signing settings',
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
				description:
					'Get the document-level status only (use Get Recipients for per-signer detail)',
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
					"Nudge a document's outstanding signers, ignoring the automatic reminder schedule",
				action: 'Send a signature reminder',
			},
			{
				name: 'Send Signature',
				value: 'prepareForSigning',
				description: 'Upload a document with fields and recipients and email a signature request',
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
				operation: ['prepareForReview', 'prepareForSigning', 'createEmbeddedSignature'],
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
				operation: ['prepareForReview', 'prepareForSigning', 'createEmbeddedSignature'],
				fileInputMethod: ['upload'],
			},
		},
		default: 'data',
		description: 'The input binary field containing the file to process (supports PDF, DOCX, PPTX)',
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
				operation: ['prepareForReview', 'prepareForSigning', 'createEmbeddedSignature'],
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
				operation: ['prepareForReview', 'prepareForSigning', 'createEmbeddedSignature'],
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
				operation: ['prepareForReview', 'prepareForSigning', 'createEmbeddedSignature'],
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
			'JSON array of signature fields with recipientEmail, type, and template anchor. Optional per-field "defaultValue" pre-fills the field (max 600 characters); for a "date" field set it to a fixed date in MM/DD/YYYY (e.g. "12/31/2026") or omit it to auto-fill the signing date ("signature"/"initial" fields cannot carry one, and a "date" field cannot be readonly). Optional per-field "metadata" enables conditional (IF/THEN) logic: put "metadata":{"fieldKey":"agree_terms"} on a controlling checkbox, and on a dependent field add "metadata":{"conditional":{"controllingFieldKey":"agree_terms","operator":"is_checked" or "is_not_checked","action":"show" or "unlock"}} (show = hidden until met; unlock = visible-but-read-only until met). Optional per-field "required" (boolean, default true): set "required":false to let the signer leave the field blank. "signature" and "initial" fields are always required, and each recipient needs at least one required editable field.',
		required: true,
		placeholder:
			'[{"recipientEmail":"sales@example.com","type":"signature","template":{"anchor":"{Signature1}","placement":"replace","size":{"width":200,"height":50}}}]',
		hint: 'Example: [{"recipientEmail":"sales@example.com","type":"signature","template":{"anchor":"{SalesSigner}","placement":"replace","size":{"width":200,"height":50}}},{"recipientEmail":"client@example.com","type":"signature","template":{"anchor":"{ClientSigner}","placement":"replace","size":{"width":200,"height":50}}}]. Conditional example: a checkbox {"recipientEmail":"client@example.com","type":"checkbox","template":{"anchor":"{AgreeTerms}","placement":"replace","size":{"width":20,"height":20}},"metadata":{"fieldKey":"agree_terms"}} controls a text field {"recipientEmail":"client@example.com","type":"text","template":{"anchor":"{Reason}","placement":"replace","size":{"width":200,"height":30}},"metadata":{"conditional":{"controllingFieldKey":"agree_terms","operator":"is_checked","action":"show"}}}. Date default example: {"recipientEmail":"client@example.com","type":"date","template":{"anchor":"{EffectiveDate}","placement":"replace","size":{"width":120,"height":20}},"defaultValue":"12/31/2026"}. Optional field example: {"recipientEmail":"client@example.com","type":"text","required":false,"template":{"anchor":"{Notes}","placement":"replace","size":{"width":240,"height":30}}}.',
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
				operation: ['prepareForReview', 'prepareForSigning', 'createEmbeddedSignature'],
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
	// Send Signature / Get Review Link - Reminder & Expiration Schedule
	// ===============================
	// Per-document schedule overrides sent when the document is prepared. Each option is optional:
	// leave it out and that setting inherits your organization's default. Applies to both prepare
	// paths — the backend accepts scheduleOverrides on prepare-for-review and prepare-for-signing
	// alike, so the review flow can pre-configure the reminder/expiration cadence too.
	{
		displayName: 'Reminder & Expiration Schedule',
		name: 'signatureSchedule',
		type: 'collection',
		placeholder: 'Add Schedule Option',
		default: {},
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['prepareForReview', 'prepareForSigning'],
			},
		},
		options: [
			{
				displayName: 'Enable Expiration',
				name: 'expirationEnabled',
				type: 'boolean',
				default: false,
				description:
					'Whether the signature request should expire automatically. Leave this option out to inherit your organization\'s default expiration policy.',
			},
			{
				displayName: 'Enable Reminders',
				name: 'remindersEnabled',
				type: 'boolean',
				default: false,
				description:
					'Whether to send automatic reminder emails to outstanding signers. Leave this option out to inherit your organization\'s default reminder schedule.',
			},
			{
				displayName: 'Expiration Warning',
				name: 'expirationWarningValue',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				displayOptions: { show: { expirationEnabled: [true] } },
				description:
					'How long before expiry to send a warning email (measured in Expiration Warning Unit). Set to 0 to never send a warning. Remove this option to inherit the organization default.',
			},
			{
				displayName: 'Expiration Warning Interval',
				name: 'expirationWarningIntervalValue',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 1,
				displayOptions: { show: { expirationEnabled: [true] } },
				description:
					'How often to repeat the expiration warning (measured in Expiration Warning Interval Unit). Remove this option to inherit the organization default.',
			},
			{
				displayName: 'Expiration Warning Interval Unit',
				name: 'expirationWarningIntervalUnit',
				type: 'options',
				options: [
					{ name: 'Hours', value: 'hours' },
					{ name: 'Days', value: 'days' },
				],
				default: 'days',
				displayOptions: { show: { expirationEnabled: [true] } },
				description: 'Time unit for the Expiration Warning Interval value',
			},
			{
				displayName: 'Expiration Warning Unit',
				name: 'expirationWarningUnit',
				type: 'options',
				options: [
					{ name: 'Hours', value: 'hours' },
					{ name: 'Days', value: 'days' },
				],
				default: 'days',
				displayOptions: { show: { expirationEnabled: [true] } },
				description: 'Time unit for the Expiration Warning value',
			},
			{
				displayName: 'Expire After',
				name: 'expireAfterValue',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 1,
				displayOptions: { show: { expirationEnabled: [true] } },
				description:
					'How long after sending until the request expires (measured in Expire After Unit). Remove this option to inherit the organization default.',
			},
			{
				displayName: 'Expire After Unit',
				name: 'expireAfterUnit',
				type: 'options',
				options: [
					{ name: 'Hours', value: 'hours' },
					{ name: 'Days', value: 'days' },
				],
				default: 'days',
				displayOptions: { show: { expirationEnabled: [true] } },
				description: 'Time unit for the Expire After value',
			},
			{
				displayName: 'Max Reminders',
				name: 'maxReminders',
				type: 'number',
				typeOptions: { minValue: -1, maxValue: 50 },
				default: -1,
				displayOptions: { show: { remindersEnabled: [true] } },
				description:
					'Maximum number of automatic reminders to send. Use -1 for unlimited, 0 to send none, up to a maximum of 50.',
			},
			{
				displayName: 'Reminder Delay',
				name: 'reminderDelayValue',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 1,
				displayOptions: { show: { remindersEnabled: [true] } },
				description:
					'How long after sending before the first reminder goes out (measured in Reminder Delay Unit). Remove this option to inherit the organization default.',
			},
			{
				displayName: 'Reminder Delay Unit',
				name: 'reminderDelayUnit',
				type: 'options',
				options: [
					{ name: 'Hours', value: 'hours' },
					{ name: 'Days', value: 'days' },
				],
				default: 'days',
				displayOptions: { show: { remindersEnabled: [true] } },
				description: 'Time unit for the Reminder Delay value',
			},
			{
				displayName: 'Reminder Interval',
				name: 'reminderIntervalValue',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 1,
				displayOptions: { show: { remindersEnabled: [true] } },
				description:
					'How often to repeat reminders after the first one (measured in Reminder Interval Unit). Remove this option to inherit the organization default.',
			},
			{
				displayName: 'Reminder Interval Unit',
				name: 'reminderIntervalUnit',
				type: 'options',
				options: [
					{ name: 'Hours', value: 'hours' },
					{ name: 'Days', value: 'days' },
				],
				default: 'days',
				displayOptions: { show: { remindersEnabled: [true] } },
				description: 'Time unit for the Reminder Interval value',
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
					'createSigningUrl',
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

	// ===============================
	// Create Signing URL Fields
	// ===============================
	{
		displayName: 'Select Recipient By',
		name: 'recipientSelector',
		type: 'options',
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['createSigningUrl'],
			},
		},
		options: [
			{
				name: 'Recipient ID',
				value: 'recipientId',
				description: "TurboDocx recipient UUID (from the send response's recipients array)",
			},
			{
				name: 'External ID',
				value: 'externalId',
				description: 'Your own identifier set on the recipient when the document was created',
			},
		],
		default: 'recipientId',
		description:
			'Which identifier selects the recipient. The API requires exactly one of recipientId / externalId.',
	},
	{
		displayName: 'Recipient Identifier',
		name: 'recipientSelectorValue',
		type: 'string',
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['createSigningUrl'],
			},
		},
		default: '',
		required: true,
		description: 'The recipient ID or external ID value, matching the selector above',
	},
	{
		displayName: 'Signing URL Options',
		name: 'signingUrlOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['createSigningUrl'],
			},
		},
		options: [
			{
				displayName: 'Return URL',
				name: 'returnUrl',
				type: 'string',
				default: '',
				placeholder: 'https://app.example.com/signed',
				description: 'Where TurboSign returns the signer after completion. Must be an https URL.',
			},
			{
				displayName: 'Identity Assertion',
				name: 'identityAssertion',
				type: 'json',
				default: '',
				description:
					'Only for external_idv recipients: the assertion from your own identity provider. JSON object with provider, verificationId, verifiedAt (ISO 8601) and subjectEmail (must match the recipient email unless overrideEmailMatching is true). Optional audit-trail context: method (id_document, id_document_liveness, kba, database, sso or other, which needs methodDetail), assuranceLevel, verifiedName and an https evidenceUrl.',
				placeholder:
					'{"provider":"ExampleIDV","verificationId":"ver_123","verifiedAt":"2026-01-01T00:00:00.000Z","subjectEmail":"john@example.com"}',
			},
		],
	},

	// ===============================
	// Create Embedded Signature Fields
	// ===============================
	// Recipients are entered as structured rows (not raw JSON) so the identity/OTP options are
	// first-class in the UI. Each row maps to a full recipient with an optional identityVerification
	// block; the signer clears any OTP in the browser on the signing page (the org API key cannot
	// verify an OTP on their behalf; see the handler).
	{
		displayName: 'Recipients',
		name: 'embeddedRecipients',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true, sortable: true },
		placeholder: 'Add Recipient',
		default: {},
		required: true,
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['createEmbeddedSignature'],
			},
		},
		description: 'The signers, in order. Each gets its own embedded signing URL in the response.',
		options: [
			{
				name: 'recipient',
				displayName: 'Recipient',
				values: [
					{
						displayName: 'Date Anchor',
						name: 'date',
						type: 'string',
						default: '',
						placeholder: '{date1}',
						description: 'Anchor text to replace with a date field for this recipient',
					},
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						placeholder: 'name@email.com',
						default: '',
						required: true,
						description: 'Recipient email address',
					},
					{
						displayName: 'Full Name Anchor',
						name: 'fullName',
						type: 'string',
						default: '',
						placeholder: '{fullName1}',
						description: 'Anchor text to replace with a full-name field for this recipient',
					},
					{
						displayName: 'Identity Verification',
						name: 'identityVerification',
						type: 'options',
						default: 'none',
						description:
							"How this recipient proves their identity before signing. OTP, external IDV and override each require embedded signing (and the matching gate) to be enabled for the org. Get Embedded Signing Settings shows the org's default channel and whether you may pick a different one.",
						options: [
							{
								name: 'Email OTP',
								value: 'emailOtp',
								description:
									"One-time passcode emailed to the recipient and entered on the signing page. Rejected with OtpOverrideNotAllowed when the org's default channel is SMS and allowChannelOverride is false.",
							},
							{
								name: 'External IDV',
								value: 'externalIdv',
								description:
									'Your own identity provider verifies the signer. The embed URL is NOT minted here: this recipient comes back status:pending, then you mint it with Create Signing URL, passing the identity assertion.',
							},
							{
								name: 'None',
								value: 'none',
								description:
									"Take the org's default channel: no verification when it is none, otherwise a passcode on the default channel (email, or SMS, which needs a phone number)",
							},
							{
								name: 'Override',
								value: 'override',
								description:
									'Skip identity verification (dev/testing). Marks the signature as not identity-verified; requires a reason.',
							},
							{
								name: 'SMS OTP',
								value: 'smsOtp',
								description:
									"One-time passcode texted to the recipient (requires a phone number). Rejected with OtpOverrideNotAllowed when the org's default channel is email and allowChannelOverride is false.",
							},
						],
					},
					{
						displayName: 'IDV Provider',
						name: 'provider',
						type: 'string',
						default: '',
						description:
							'Identity provider name (must match the assertion passed to Create Signing URL)',
					},
					{
						displayName: 'Initials Anchor',
						name: 'initials',
						type: 'string',
						default: '',
						placeholder: '{initials1}',
						description: 'Anchor text to replace with an initials field for this recipient',
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						required: true,
						description: 'Recipient full name',
					},
					{
						displayName: 'Override Reason',
						name: 'reason',
						type: 'string',
						default: '',
						description:
							'Why identity verification is skipped. Recorded on the certificate as the override acknowledgement.',
					},
					{
						displayName: 'Phone (E.164)',
						name: 'phone',
						type: 'string',
						default: '',
						placeholder: '+13055551234',
						description:
							"Required for SMS OTP, and for None when the org's default channel is SMS. E.164 format, e.g. +13055551234. A number that cannot exist is rejected with OtpPhoneInvalid.",
					},
					{
						displayName: 'Signature Anchor',
						name: 'signature',
						type: 'string',
						default: '',
						placeholder: '{signature1}',
						description:
							"Anchor text in the document to replace with this recipient's signature field",
					},
					{
						displayName: 'Signing Order',
						name: 'signingOrder',
						type: 'number',
						default: 0,
						description:
							"1-indexed signing order. Leave 0 to default to this recipient's position in the list.",
					},
				],
			},
		],
	},
	{
		displayName: 'Fields (Advanced Override)',
		name: 'embeddedFields',
		type: 'json',
		default: '',
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['createEmbeddedSignature'],
			},
		},
		description:
			'Optional. A full JSON array of signature fields, exactly as Send Signature accepts. When provided it OVERRIDES the per-recipient anchor shorthand above, giving you full control over field type, placement and size.',
		placeholder:
			'[{"recipientEmail":"john@example.com","type":"signature","template":{"anchor":"{signature1}","placement":"replace","size":{"width":200,"height":50}}}]',
	},
	{
		displayName: 'Send Email',
		name: 'embeddedSendEmail',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['createEmbeddedSignature'],
			},
		},
		description:
			'Whether to also email recipients a standalone signing link. Off by default for embedded signing, where your app shows the signing page via the returned embed URLs. When off, the signing-link, initial CC, next-signer, automatic reminder and expiry-warning emails are not sent; passcode and completed-copy emails still are, and a manual Resend Email or Send Reminder still sends.',
	},
	{
		displayName: 'Return URL',
		name: 'embeddedReturnUrl',
		type: 'string',
		default: '',
		placeholder: 'https://app.example.com/signed',
		displayOptions: {
			show: {
				resource: RESOURCE,
				operation: ['createEmbeddedSignature'],
			},
		},
		description:
			"Optional completion fallback applied to every recipient's embed URL. Must be an https URL.",
	},
];
