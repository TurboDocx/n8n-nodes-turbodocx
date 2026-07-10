import { INodeProperties } from 'n8n-workflow';

const QUOTE = ['quote'];
const LINE_ITEM = ['quoteLineItem'];
const NUMBER_CONFIG = ['quoteNumberConfig'];

const CURRENCY_OPTIONS = [
	{ name: 'AUD', value: 'AUD' },
	{ name: 'CAD', value: 'CAD' },
	{ name: 'EUR', value: 'EUR' },
	{ name: 'GBP', value: 'GBP' },
	{ name: 'INR', value: 'INR' },
	{ name: 'USD', value: 'USD' },
];

const RENEWAL_OPTIONS = [
	{ name: 'Annually', value: 'annually' },
	{ name: 'Monthly', value: 'monthly' },
	{ name: 'Quarterly', value: 'quarterly' },
	{ name: 'Weekly', value: 'weekly' },
];

const STATUS_OPTIONS = [
	{ name: 'Accepted', value: 'accepted' },
	{ name: 'Declined', value: 'declined' },
	{ name: 'Draft', value: 'draft' },
	{ name: 'Pending Approval', value: 'pending_approval' },
	{ name: 'Sent', value: 'sent' },
	{ name: 'Voided', value: 'voided' },
];

const BILLING_FREQUENCY_OPTIONS = [
	{ name: 'Annual', value: 'annual' },
	{ name: 'Monthly', value: 'monthly' },
	{ name: 'One-Time', value: 'one-time' },
	{ name: 'Quarterly', value: 'quarterly' },
];

const DISCOUNT_TYPE_OPTIONS = [
	{ name: 'Amount', value: 'amount' },
	{ name: 'Percent', value: 'percent' },
];

const LINE_ITEM_TYPE_OPTIONS = [
	{ name: 'Bundle', value: 'bundle' },
	{ name: 'Product', value: 'product' },
];

// ===================================================================
// Quote — Operations
// ===================================================================

export const quoteOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: QUOTE,
			},
		},
		options: [
			{
				name: 'Apply Price Book',
				value: 'applyPriceBook',
				description: 'Apply a price book to all line items on a quote',
				action: 'Apply a price book to a quote',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new quote',
				action: 'Create a quote',
			},
			{
				name: 'Create and Send',
				value: 'createAndSend',
				description: 'Create a quote, add line items and bundles, then send it in one operation',
				action: 'Create and send a quote',
			},
			{
				name: 'Decline',
				value: 'decline',
				description: 'Decline a quote with a reason',
				action: 'Decline a quote',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a quote',
				action: 'Delete a quote',
			},
			{
				name: 'Download PDF',
				value: 'downloadPdf',
				description: 'Download the quote as a PDF binary',
				action: 'Download a quote PDF',
			},
			{
				name: 'Duplicate',
				value: 'duplicate',
				description: 'Duplicate an existing quote',
				action: 'Duplicate a quote',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single quote',
				action: 'Get a quote',
			},
			{
				name: 'Get Many',
				value: 'list',
				description: 'List quotes with filters and pagination',
				action: 'Get many quotes',
			},
			{
				name: 'Handle Expired',
				value: 'handleExpired',
				description: 'Resolve an expired sent quote by voiding or declining it',
				action: 'Handle an expired quote',
			},
			{
				name: 'Remove Price Book',
				value: 'removePriceBook',
				description: 'Remove the applied price book from a quote',
				action: 'Remove a price book from a quote',
			},
			{
				name: 'Send',
				value: 'send',
				description: 'Send a quote to its contact',
				action: 'Send a quote',
			},
			{
				name: 'Send With Deliverable',
				value: 'sendWithDeliverable',
				description: 'Send a quote merged with a generated deliverable document',
				action: 'Send a quote with a deliverable',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an existing quote',
				action: 'Update a quote',
			},
			{
				name: 'Void',
				value: 'void',
				description: 'Void a quote with a reason',
				action: 'Void a quote',
			},
		],
		default: 'create',
	},
];

// ===================================================================
// Quote — Fields
// ===================================================================

const quoteIdField: INodeProperties = {
	displayName: 'Quote ID',
	name: 'quoteId',
	type: 'string',
	required: true,
	default: '',
	description: 'UUID of the quote',
	displayOptions: {
		show: {
			resource: QUOTE,
			operation: [
				'get',
				'update',
				'delete',
				'duplicate',
				'applyPriceBook',
				'removePriceBook',
				'downloadPdf',
				'send',
				'sendWithDeliverable',
				'decline',
				'void',
				'handleExpired',
			],
		},
	},
};

export const quoteFields: INodeProperties[] = [
	quoteIdField,

	// ===============================
	// Create
	// ===============================
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Name of the quote',
		displayOptions: {
			show: { resource: QUOTE, operation: ['create'] },
		},
	},
	{
		displayName: 'Company ID',
		name: 'companyId',
		type: 'string',
		required: true,
		default: '',
		description: 'UUID of the company the quote is for',
		displayOptions: {
			show: { resource: QUOTE, operation: ['create'] },
		},
	},
	{
		displayName: 'Contact ID',
		name: 'contactId',
		type: 'string',
		required: true,
		default: '',
		description: 'UUID of the contact the quote is addressed to',
		displayOptions: {
			show: { resource: QUOTE, operation: ['create'] },
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: QUOTE, operation: ['create'] },
		},
		options: [
			{
				displayName: 'Currency',
				name: 'currency',
				type: 'options',
				options: CURRENCY_OPTIONS,
				default: 'USD',
				description: 'Currency for the quote',
			},
			{
				displayName: 'Price Book ID',
				name: 'priceBookId',
				type: 'string',
				default: '',
				description: 'UUID of the price book to apply',
			},
			{
				displayName: 'Renewal Period',
				name: 'renewalPeriod',
				type: 'options',
				options: RENEWAL_OPTIONS,
				default: 'monthly',
				description:
					'Renewal period for an auto-renewal quote. Only applies when Term Days is -1; ignored otherwise.',
			},
			{
				displayName: 'Tax Rate',
				name: 'taxRate',
				type: 'number',
				default: 0,
				description: 'Tax rate applied to the quote (percentage)',
			},
			{
				displayName: 'Term Days',
				name: 'termDays',
				type: 'number',
				typeOptions: { minValue: -1 },
				default: 30,
				description:
					'Days the quote terms cover. Use -1 for an auto-renewal term, which requires a Renewal Period (the Renewal Period is ignored for any other value).',
			},
			{
				displayName: 'Valid Until',
				name: 'validUntil',
				type: 'dateTime',
				default: '',
				description: 'Date until which the quote is valid',
			},
		],
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
			show: { resource: QUOTE, operation: ['update'] },
		},
		options: [
			{
				displayName: 'Clear Price Book',
				name: 'clearPriceBook',
				type: 'boolean',
				default: false,
				description: 'Whether to clear the applied price book (sends null)',
			},
			{
				displayName: 'Clear Renewal Period',
				name: 'clearRenewalPeriod',
				type: 'boolean',
				default: false,
				description: 'Whether to clear the renewal period (sends null)',
			},
			{
				displayName: 'Clear Tax Rate',
				name: 'clearTaxRate',
				type: 'boolean',
				default: false,
				description: 'Whether to clear the tax rate (sends null)',
			},
			{
				displayName: 'Clear Valid Until',
				name: 'clearValidUntil',
				type: 'boolean',
				default: false,
				description: 'Whether to clear the valid-until date (sends null)',
			},
			{
				displayName: 'Company ID',
				name: 'companyId',
				type: 'string',
				default: '',
				description: 'UUID of the company the quote is for',
			},
			{
				displayName: 'Contact ID',
				name: 'contactId',
				type: 'string',
				default: '',
				description: 'UUID of the contact the quote is addressed to',
			},
			{
				displayName: 'Currency',
				name: 'currency',
				type: 'options',
				options: CURRENCY_OPTIONS,
				default: 'USD',
				description: 'Currency for the quote',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Name of the quote',
			},
			{
				displayName: 'Price Book ID',
				name: 'priceBookId',
				type: 'string',
				default: '',
				description: 'UUID of the price book to apply',
			},
			{
				displayName: 'Renewal Period',
				name: 'renewalPeriod',
				type: 'options',
				options: RENEWAL_OPTIONS,
				default: 'monthly',
				description:
					'Renewal period for an auto-renewal quote. Only applies when Term Days is -1; ignored otherwise.',
			},
			{
				displayName: 'Tax Rate',
				name: 'taxRate',
				type: 'number',
				default: 0,
				description: 'Tax rate applied to the quote (percentage)',
			},
			{
				displayName: 'Term Days',
				name: 'termDays',
				type: 'number',
				typeOptions: { minValue: -1 },
				default: 30,
				description:
					'Days the quote terms cover. Use -1 for an auto-renewal term, which requires a Renewal Period (the Renewal Period is ignored for any other value).',
			},
			{
				displayName: 'Valid Until',
				name: 'validUntil',
				type: 'dateTime',
				default: '',
				description: 'Date until which the quote is valid',
			},
		],
	},

	// ===============================
	// Get Many (list)
	// ===============================
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: { resource: QUOTE, operation: ['list'] },
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
			show: { resource: QUOTE, operation: ['list'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: { resource: QUOTE, operation: ['list'] },
		},
		options: [
			{
				displayName: 'Company ID',
				name: 'companyId',
				type: 'string',
				default: '',
				description: 'Filter quotes by company UUID',
			},
			{
				displayName: 'Contact ID',
				name: 'contactId',
				type: 'string',
				default: '',
				description: 'Filter quotes by contact UUID',
			},
			{
				displayName: 'Currency',
				name: 'currency',
				type: 'options',
				options: CURRENCY_OPTIONS,
				default: 'USD',
				description: 'Filter quotes by currency',
			},
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				default: '',
				description: 'Filter quotes by name or quote number',
			},
			{
				displayName: 'Statuses',
				name: 'statuses',
				type: 'multiOptions',
				options: STATUS_OPTIONS,
				default: [],
				description: 'Filter quotes by one or more statuses',
			},
		],
	},

	// ===============================
	// Send / Send With Deliverable shared
	// ===============================
	{
		displayName: 'Deliverable ID',
		name: 'deliverableId',
		type: 'string',
		required: true,
		default: '',
		description: 'UUID of the deliverable to merge with the quote',
		displayOptions: {
			show: { resource: QUOTE, operation: ['sendWithDeliverable'] },
		},
	},
	{
		displayName: 'Merge Position',
		name: 'mergePosition',
		type: 'options',
		options: [
			{ name: 'Beginning', value: 'beginning' },
			{ name: 'End', value: 'end' },
		],
		default: 'end',
		description: 'Where to merge the deliverable relative to the quote',
		displayOptions: {
			show: { resource: QUOTE, operation: ['sendWithDeliverable'] },
		},
	},
	{
		displayName: 'Send Options',
		name: 'sendOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: { resource: QUOTE, operation: ['send'] },
		},
		options: [
			{
				displayName: 'CC Emails',
				name: 'ccEmails',
				type: 'string',
				default: '',
				placeholder: 'a@example.com, b@example.com',
				description: 'Comma-separated list of email addresses to CC',
			},
			{
				displayName: 'Valid Until',
				name: 'validUntil',
				type: 'dateTime',
				default: '',
				description: 'Override the quote validity date when sending',
			},
		],
	},
	{
		displayName: 'Send Options',
		name: 'sendWithDeliverableOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: { resource: QUOTE, operation: ['sendWithDeliverable'] },
		},
		options: [
			{
				displayName: 'CC Emails',
				name: 'ccEmails',
				type: 'string',
				default: '',
				placeholder: 'a@example.com, b@example.com',
				description: 'Comma-separated list of email addresses to CC',
			},
		],
	},

	// ===============================
	// Decline / Void — reason
	// ===============================
	{
		displayName: 'Reason',
		name: 'reason',
		type: 'string',
		required: true,
		default: '',
		typeOptions: { rows: 2 },
		description: 'Reason for declining or voiding the quote',
		displayOptions: {
			show: { resource: QUOTE, operation: ['decline', 'void'] },
		},
	},

	// ===============================
	// Handle Expired
	// ===============================
	{
		displayName: 'Action',
		name: 'expiredAction',
		type: 'options',
		options: [
			{ name: 'Decline', value: 'decline' },
			{ name: 'Void', value: 'void' },
		],
		default: 'void',
		description: 'How to resolve the expired quote',
		displayOptions: {
			show: { resource: QUOTE, operation: ['handleExpired'] },
		},
	},
	{
		displayName: 'Reason',
		name: 'expiredReason',
		type: 'string',
		required: true,
		default: '',
		typeOptions: { rows: 2 },
		description: 'Reason for resolving the expired quote',
		displayOptions: {
			show: { resource: QUOTE, operation: ['handleExpired'] },
		},
	},
	{
		displayName: 'New Valid Until',
		name: 'newValidUntil',
		type: 'dateTime',
		required: true,
		default: '',
		description: 'New validity date to set on the quote',
		displayOptions: {
			show: { resource: QUOTE, operation: ['handleExpired'] },
		},
	},

	// ===============================
	// Apply Price Book
	// ===============================
	{
		displayName: 'Price Book ID',
		name: 'priceBookId',
		type: 'string',
		required: true,
		default: '',
		description: 'UUID of the price book to apply to the quote',
		displayOptions: {
			show: { resource: QUOTE, operation: ['applyPriceBook'] },
		},
	},

	// ===============================
	// Create and Send
	// ===============================
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Name of the quote',
		displayOptions: {
			show: { resource: QUOTE, operation: ['createAndSend'] },
		},
	},
	{
		displayName: 'Company ID',
		name: 'companyId',
		type: 'string',
		required: true,
		default: '',
		description: 'UUID of the company the quote is for',
		displayOptions: {
			show: { resource: QUOTE, operation: ['createAndSend'] },
		},
	},
	{
		displayName: 'Contact ID',
		name: 'contactId',
		type: 'string',
		required: true,
		default: '',
		description: 'UUID of the contact the quote is addressed to',
		displayOptions: {
			show: { resource: QUOTE, operation: ['createAndSend'] },
		},
	},
	{
		displayName: 'Line Items',
		name: 'items',
		type: 'json',
		default: '[]',
		description:
			'JSON array of product line items to add. Each item: productId, productName, unitPrice, billingFrequency (monthly/quarterly/annual/one-time), optional quantity/discountPercent/discountType/discountAmount.',
		placeholder:
			'[{"productId":null,"productName":"Setup Fee","unitPrice":500,"billingFrequency":"one-time","quantity":1}]',
		hint: 'Example: [{"productId":null,"productName":"License","unitPrice":99,"billingFrequency":"monthly","quantity":10}]',
		displayOptions: {
			show: { resource: QUOTE, operation: ['createAndSend'] },
		},
	},
	{
		displayName: 'Bundle Items',
		name: 'bundleItems',
		type: 'json',
		default: '[]',
		description:
			'JSON array of bundle line items to add. Each item: bundleId, bundleName, optional quantity/discountPercent/discountType/discountAmount/showItemsToEndUser.',
		placeholder: '[{"bundleId":"<uuid>","bundleName":"Starter Bundle","quantity":1}]',
		hint: 'Example: [{"bundleId":"abc-123","bundleName":"Pro Bundle","quantity":2,"showItemsToEndUser":true}]',
		displayOptions: {
			show: { resource: QUOTE, operation: ['createAndSend'] },
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'createAndSendFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: QUOTE, operation: ['createAndSend'] },
		},
		options: [
			{
				displayName: 'CC Emails',
				name: 'ccEmails',
				type: 'string',
				default: '',
				placeholder: 'a@example.com, b@example.com',
				description: 'Comma-separated list of email addresses to CC when sending',
			},
			{
				displayName: 'Currency',
				name: 'currency',
				type: 'options',
				options: CURRENCY_OPTIONS,
				default: 'USD',
				description: 'Currency for the quote',
			},
			{
				displayName: 'Price Book ID',
				name: 'priceBookId',
				type: 'string',
				default: '',
				description: 'UUID of the price book to apply',
			},
			{
				displayName: 'Renewal Period',
				name: 'renewalPeriod',
				type: 'options',
				options: RENEWAL_OPTIONS,
				default: 'monthly',
				description:
					'Renewal period for an auto-renewal quote. Only applies when Term Days is -1; ignored otherwise.',
			},
			{
				displayName: 'Send Valid Until',
				name: 'sendValidUntil',
				type: 'dateTime',
				default: '',
				description: 'Override the quote validity date when sending',
			},
			{
				displayName: 'Tax Rate',
				name: 'taxRate',
				type: 'number',
				default: 0,
				description: 'Tax rate applied to the quote (percentage)',
			},
			{
				displayName: 'Term Days',
				name: 'termDays',
				type: 'number',
				typeOptions: { minValue: -1 },
				default: 30,
				description:
					'Days the quote terms cover. Use -1 for an auto-renewal term, which requires a Renewal Period (the Renewal Period is ignored for any other value).',
			},
			{
				displayName: 'Valid Until',
				name: 'validUntil',
				type: 'dateTime',
				default: '',
				description: 'Date until which the quote is valid',
			},
		],
	},
];

// ===================================================================
// Quote Line Item — Operations
// ===================================================================

export const quoteLineItemOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: LINE_ITEM,
			},
		},
		options: [
			{
				name: 'Add',
				value: 'add',
				description: 'Add one or more product line items to a quote',
				action: 'Add line items to a quote',
			},
			{
				name: 'Add Bundle',
				value: 'addBundle',
				description: 'Add one or more bundle line items to a quote',
				action: 'Add bundle line items to a quote',
			},
			{
				name: 'Get Many',
				value: 'list',
				description: 'List line items on a quote',
				action: 'Get many line items',
			},
			{
				name: 'Remove',
				value: 'remove',
				description: 'Remove a line item from a quote',
				action: 'Remove a line item',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a line item on a quote',
				action: 'Update a line item',
			},
		],
		default: 'list',
	},
];

// ===================================================================
// Quote Line Item — Fields
// ===================================================================

const lineItemQuoteIdField: INodeProperties = {
	displayName: 'Quote ID',
	name: 'quoteId',
	type: 'string',
	required: true,
	default: '',
	description: 'UUID of the quote the line items belong to',
	displayOptions: {
		show: {
			resource: LINE_ITEM,
			operation: ['list', 'add', 'addBundle', 'update', 'remove'],
		},
	},
};

const lineItemIdField: INodeProperties = {
	displayName: 'Line Item ID',
	name: 'itemId',
	type: 'string',
	required: true,
	default: '',
	description: 'UUID of the line item',
	displayOptions: {
		show: {
			resource: LINE_ITEM,
			operation: ['update', 'remove'],
		},
	},
};

export const quoteLineItemFields: INodeProperties[] = [
	lineItemQuoteIdField,
	lineItemIdField,

	// ===============================
	// Add (products)
	// ===============================
	{
		displayName: 'Items',
		name: 'items',
		type: 'json',
		required: true,
		default: '[]',
		description:
			'JSON array of product line items. Each item: productId (or null), productName, unitPrice, billingFrequency (monthly/quarterly/annual/one-time), optional quantity/discountPercent/discountType/discountAmount/categoryId/categoryName/cost/productSku/productDescription. An array is always sent, even for one item.',
		placeholder:
			'[{"productId":null,"productName":"Setup Fee","unitPrice":500,"billingFrequency":"one-time","quantity":1}]',
		hint: 'Example: [{"productId":null,"productName":"License","unitPrice":99,"billingFrequency":"monthly","quantity":10,"discountPercent":5}]',
		displayOptions: {
			show: { resource: LINE_ITEM, operation: ['add'] },
		},
	},

	// ===============================
	// Add Bundle
	// ===============================
	{
		displayName: 'Items',
		name: 'bundleItemsJson',
		type: 'json',
		required: true,
		default: '[]',
		description:
			'JSON array of bundle line items. Each item: bundleId, bundleName, optional quantity/discountPercent/discountType/discountAmount/bundleDescription/showItemsToEndUser. An array is always sent, even for one item.',
		placeholder: '[{"bundleId":"<uuid>","bundleName":"Starter Bundle","quantity":1}]',
		hint: 'Example: [{"bundleId":"abc-123","bundleName":"Pro Bundle","quantity":2,"showItemsToEndUser":true}]',
		displayOptions: {
			show: { resource: LINE_ITEM, operation: ['addBundle'] },
		},
	},

	// ===============================
	// Get Many (list)
	// ===============================
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: { resource: LINE_ITEM, operation: ['list'] },
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
			show: { resource: LINE_ITEM, operation: ['list'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: { resource: LINE_ITEM, operation: ['list'] },
		},
		options: [
			{
				displayName: 'Billing Frequency',
				name: 'billingFrequency',
				type: 'options',
				options: BILLING_FREQUENCY_OPTIONS,
				default: 'monthly',
				description: 'Filter line items by billing frequency',
			},
			{
				displayName: 'Line Item Type',
				name: 'lineItemType',
				type: 'options',
				options: LINE_ITEM_TYPE_OPTIONS,
				default: 'product',
				description: 'Filter by line item type',
			},
			{
				displayName: 'Parent Line Item ID',
				name: 'parentLineItemId',
				type: 'string',
				default: '',
				description: 'Filter to child line items of a given parent UUID',
			},
		],
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
			show: { resource: LINE_ITEM, operation: ['update'] },
		},
		options: [
			{
				displayName: 'Billing Frequency',
				name: 'billingFrequency',
				type: 'options',
				options: BILLING_FREQUENCY_OPTIONS,
				default: 'monthly',
				description: 'Billing frequency of the line item',
			},
			{
				displayName: 'Category ID',
				name: 'categoryId',
				type: 'string',
				default: '',
				description: 'UUID of the category for the line item',
			},
			{
				displayName: 'Category Name',
				name: 'categoryName',
				type: 'string',
				default: '',
				description: 'Name of the category for the line item',
			},
			{
				displayName: 'Clear Category ID',
				name: 'clearCategoryId',
				type: 'boolean',
				default: false,
				description: 'Whether to clear the category ID (sends null)',
			},
			{
				displayName: 'Clear Category Name',
				name: 'clearCategoryName',
				type: 'boolean',
				default: false,
				description: 'Whether to clear the category name (sends null)',
			},
			{
				displayName: 'Clear Cost',
				name: 'clearCost',
				type: 'boolean',
				default: false,
				description: 'Whether to clear the cost (sends null)',
			},
			{
				displayName: 'Cost',
				name: 'cost',
				type: 'number',
				default: 0,
				description: 'Internal cost of the line item',
			},
			{
				displayName: 'Discount Amount',
				name: 'discountAmount',
				type: 'number',
				default: 0,
				description: 'Fixed discount amount applied to the line item',
			},
			{
				displayName: 'Discount Percent',
				name: 'discountPercent',
				type: 'number',
				default: 0,
				description: 'Percentage discount applied to the line item',
			},
			{
				displayName: 'Discount Type',
				name: 'discountType',
				type: 'options',
				options: DISCOUNT_TYPE_OPTIONS,
				default: 'percent',
				description: 'Whether the discount is a percentage or a fixed amount',
			},
			{
				displayName: 'Display Order',
				name: 'displayOrder',
				type: 'number',
				default: 0,
				description: 'Position of the line item in the quote',
			},
			{
				displayName: 'Product Description',
				name: 'productDescription',
				type: 'string',
				default: '',
				description: 'Description shown for the line item',
			},
			{
				displayName: 'Product Name',
				name: 'productName',
				type: 'string',
				default: '',
				description: 'Name shown for the line item',
			},
			{
				displayName: 'Product SKU',
				name: 'productSku',
				type: 'string',
				default: '',
				description: 'SKU shown for the line item',
			},
			{
				displayName: 'Quantity',
				name: 'quantity',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 1,
				description: 'Quantity of the line item',
			},
			{
				displayName: 'Show Items to End User',
				name: 'showItemsToEndUser',
				type: 'boolean',
				default: false,
				description: 'Whether to show the bundle items to the end user',
			},
			{
				displayName: 'Unit Price',
				name: 'unitPrice',
				type: 'number',
				default: 0,
				description: 'Unit price of the line item',
			},
		],
	},
];

// ===================================================================
// Quote Number Config — Operations
// ===================================================================
// Org-wide singleton (no quoteId): the per-org quote numbering format.

export const quoteNumberConfigOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: NUMBER_CONFIG,
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get the organization quote number config',
				action: 'Get the quote number config',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update the organization quote number config',
				action: 'Update the quote number config',
			},
		],
		default: 'get',
	},
];

// ===================================================================
// Quote Number Config — Fields
// ===================================================================
// All eight format fields are required by the backend, so they are modelled as
// explicit top-level fields (with sensible defaults) rather than a JSON blob.

export const quoteNumberConfigFields: INodeProperties[] = [
	{
		displayName: 'Prefix',
		name: 'prefix',
		type: 'string',
		default: '',
		description: 'Text prepended to every quote number (e.g. "Q")',
		displayOptions: {
			show: { resource: NUMBER_CONFIG, operation: ['update'] },
		},
	},
	{
		displayName: 'Year Token',
		name: 'yearToken',
		type: 'options',
		options: [
			{ name: 'Four-Digit Year', value: 'four' },
			{ name: 'None', value: 'none' },
			{ name: 'Two-Digit Year', value: 'two' },
		],
		default: 'none',
		description: 'Whether and how a year token is embedded in the quote number',
		displayOptions: {
			show: { resource: NUMBER_CONFIG, operation: ['update'] },
		},
	},
	{
		displayName: 'Month Token',
		name: 'monthToken',
		type: 'options',
		options: [
			{ name: 'Off', value: 'off' },
			{ name: 'Two-Digit Month', value: 'two' },
		],
		default: 'off',
		description: 'Whether and how a month token is embedded in the quote number',
		displayOptions: {
			show: { resource: NUMBER_CONFIG, operation: ['update'] },
		},
	},
	{
		displayName: 'Separator',
		name: 'separator',
		type: 'string',
		default: '-',
		description: 'Separator placed between quote number tokens',
		displayOptions: {
			show: { resource: NUMBER_CONFIG, operation: ['update'] },
		},
	},
	{
		displayName: 'Pad Width',
		name: 'padWidth',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 12 },
		default: 4,
		description: 'Number of digits the sequence is zero-padded to (e.g. 4 → 0001)',
		displayOptions: {
			show: { resource: NUMBER_CONFIG, operation: ['update'] },
		},
	},
	{
		displayName: 'Suffix',
		name: 'suffix',
		type: 'string',
		default: '',
		description: 'Text appended to every quote number',
		displayOptions: {
			show: { resource: NUMBER_CONFIG, operation: ['update'] },
		},
	},
	{
		displayName: 'Start Number',
		name: 'startNumber',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 1,
		description:
			'Sequence value the next quote starts from. Cannot be set below the current per-period issued floor.',
		displayOptions: {
			show: { resource: NUMBER_CONFIG, operation: ['update'] },
		},
	},
	{
		displayName: 'Reset Cadence',
		name: 'resetCadence',
		type: 'options',
		options: [
			{ name: 'Monthly', value: 'monthly' },
			{ name: 'Never', value: 'never' },
			{ name: 'Yearly', value: 'yearly' },
		],
		default: 'never',
		description: 'How often the sequence counter resets',
		displayOptions: {
			show: { resource: NUMBER_CONFIG, operation: ['update'] },
		},
	},
];
