import { INodeProperties } from 'n8n-workflow';

const COMPANY = ['company'];
const CONTACT = ['contact'];
const QUOTE_TEMPLATE = ['quoteTemplate'];
const QUOTE_TYPE = ['quoteType'];

const CATEGORY_TYPE_OPTIONS = [
	{ name: 'Bundle Category', value: 'bundle_category' },
	{ name: 'Company Industry', value: 'company_industry' },
	{ name: 'Price Book Type', value: 'pricebook_type' },
	{ name: 'Product Category', value: 'product_category' },
];

// =====================================================================
// COMPANY
// =====================================================================

export const companyOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: COMPANY,
			},
		},
		options: [
			{
				name: 'Bulk Create',
				value: 'bulkCreate',
				description: 'Create many companies in one request (partial success)',
				action: 'Bulk create companies',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a company with its initial contacts',
				action: 'Create a company',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a company',
				action: 'Delete a company',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single company',
				action: 'Get a company',
			},
			{
				name: 'Get Many',
				value: 'list',
				description: 'List companies with search and pagination',
				action: 'Get many companies',
			},
			{
				name: 'List Contacts',
				value: 'listContacts',
				description: 'List the contacts belonging to a company',
				action: 'List contacts of a company',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a company',
				action: 'Update a company',
			},
		],
		default: 'list',
	},
];

const companyIdField: INodeProperties = {
	displayName: 'Company ID',
	name: 'companyId',
	type: 'string',
	required: true,
	default: '',
	description: 'UUID of the company',
	displayOptions: {
		show: {
			resource: COMPANY,
			operation: ['get', 'update', 'delete', 'listContacts'],
		},
	},
};

export const companyFields: INodeProperties[] = [
	companyIdField,

	// ===============================
	// Bulk Create
	// ===============================
	{
		displayName: 'Rows',
		name: 'rows',
		type: 'json',
		required: true,
		default: '[]',
		description:
			'JSON array of companies to create. Each row uses the same shape as Create: name, contacts (array of {name,email,...}), plus optional phone/city/state/country/industryId.',
		placeholder:
			'[{"name":"Acme","contacts":[{"name":"Jane Doe","email":"jane@acme.com"}]}]',
		hint: 'Each row uses the same shape as Create. Max 500 rows; failed rows are reported in the result\'s `failed` array, not thrown.',
		displayOptions: {
			show: { resource: COMPANY, operation: ['bulkCreate'] },
		},
	},

	// ===============================
	// Create
	// ===============================
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Name of the company',
		displayOptions: {
			show: { resource: COMPANY, operation: ['create'] },
		},
	},
	{
		displayName: 'Contacts',
		name: 'contacts',
		type: 'json',
		required: true,
		default: '[]',
		description:
			'JSON array of initial contacts. Each item: name (required), email (required), phone (optional), title (optional).',
		placeholder:
			'[{"name":"Jane Doe","email":"jane@acme.com","phone":"+15551234567","title":"CTO"}]',
		hint: 'Example: [{"name":"Jane Doe","email":"jane@acme.com"},{"name":"John Roe","email":"john@acme.com","title":"VP Sales"}]',
		displayOptions: {
			show: { resource: COMPANY, operation: ['create'] },
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: COMPANY, operation: ['create'] },
		},
		options: [
			{
				displayName: 'City',
				name: 'city',
				type: 'string',
				default: '',
				description: 'City of the company',
			},
			{
				displayName: 'Country',
				name: 'country',
				type: 'string',
				default: '',
				description: 'Country of the company',
			},
			{
				displayName: 'Industry ID',
				name: 'industryId',
				type: 'string',
				default: '',
				description: 'UUID of the industry (company_industry quote type) to associate',
			},
			{
				displayName: 'Phone',
				name: 'phone',
				type: 'string',
				default: '',
				description: 'Phone number of the company',
			},
			{
				displayName: 'State',
				name: 'state',
				type: 'string',
				default: '',
				description: 'State of the company',
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
			show: { resource: COMPANY, operation: ['list', 'listContacts'] },
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
			show: { resource: COMPANY, operation: ['list', 'listContacts'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: { resource: COMPANY, operation: ['list'] },
		},
		options: [
			{
				displayName: 'Industry IDs',
				name: 'industryIds',
				type: 'string',
				default: '',
				description:
					'Comma-separated list of industry (company_industry quote type) UUIDs to filter by',
			},
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				default: '',
				description: 'Filter companies by name',
			},
		],
	},
	{
		displayName: 'Filters',
		name: 'contactFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: { resource: COMPANY, operation: ['listContacts'] },
		},
		options: [
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				default: '',
				description: 'Filter contacts by name',
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
			show: { resource: COMPANY, operation: ['update'] },
		},
		options: [
			{
				displayName: 'City',
				name: 'city',
				type: 'string',
				default: '',
				description: 'Updated city. Leave empty to clear.',
			},
			{
				displayName: 'Country',
				name: 'country',
				type: 'string',
				default: '',
				description: 'Updated country. Leave empty to clear.',
			},
			{
				displayName: 'Industry ID',
				name: 'industryId',
				type: 'string',
				default: '',
				description: 'Updated industry UUID. Leave empty to clear.',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Updated company name',
			},
			{
				displayName: 'Phone',
				name: 'phone',
				type: 'string',
				default: '',
				description: 'Updated phone number. Leave empty to clear.',
			},
			{
				displayName: 'State',
				name: 'state',
				type: 'string',
				default: '',
				description: 'Updated state. Leave empty to clear.',
			},
		],
	},
];

// =====================================================================
// CONTACT
// =====================================================================

export const contactOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: CONTACT,
			},
		},
		options: [
			{
				name: 'Bulk Create',
				value: 'bulkCreate',
				description: 'Create many contacts in one request (partial success)',
				action: 'Bulk create contacts',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a contact under a company',
				action: 'Create a contact',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a contact',
				action: 'Delete a contact',
			},
			{
				name: 'Get Many',
				value: 'list',
				description: 'List contacts with search and pagination',
				action: 'Get many contacts',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a contact',
				action: 'Update a contact',
			},
		],
		default: 'list',
	},
];

const contactIdField: INodeProperties = {
	displayName: 'Contact ID',
	name: 'contactId',
	type: 'string',
	required: true,
	default: '',
	description: 'UUID of the contact',
	displayOptions: {
		show: {
			resource: CONTACT,
			operation: ['update', 'delete'],
		},
	},
};

export const contactFields: INodeProperties[] = [
	contactIdField,

	// ===============================
	// Bulk Create
	// ===============================
	{
		displayName: 'Rows',
		name: 'rows',
		type: 'json',
		required: true,
		default: '[]',
		description:
			'JSON array of contacts to create. Each row uses the same shape as Create: name, companyId, plus optional email/phone/title.',
		placeholder:
			'[{"name":"Jane Doe","companyId":"comp-uuid","email":"jane@acme.com"}]',
		hint: 'Each row uses the same shape as Create. Max 500 rows; failed rows are reported in the result\'s `failed` array, not thrown.',
		displayOptions: {
			show: { resource: CONTACT, operation: ['bulkCreate'] },
		},
	},

	// ===============================
	// Create
	// ===============================
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Name of the contact',
		displayOptions: {
			show: { resource: CONTACT, operation: ['create'] },
		},
	},
	{
		displayName: 'Company ID',
		name: 'companyId',
		type: 'string',
		required: true,
		default: '',
		description: 'UUID of the company this contact belongs to',
		displayOptions: {
			show: { resource: CONTACT, operation: ['create'] },
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: CONTACT, operation: ['create'] },
		},
		options: [
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
				description: 'Email address of the contact',
			},
			{
				displayName: 'Phone',
				name: 'phone',
				type: 'string',
				default: '',
				description: 'Phone number of the contact',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'Job title of the contact',
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
			show: { resource: CONTACT, operation: ['list'] },
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
			show: { resource: CONTACT, operation: ['list'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: { resource: CONTACT, operation: ['list'] },
		},
		options: [
			{
				displayName: 'Company ID',
				name: 'companyId',
				type: 'string',
				default: '',
				description: 'Filter contacts by the company they belong to',
			},
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				default: '',
				description: 'Filter contacts by name',
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
			show: { resource: CONTACT, operation: ['update'] },
		},
		options: [
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
				description: 'Updated email address. Leave empty to clear.',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Updated contact name',
			},
			{
				displayName: 'Phone',
				name: 'phone',
				type: 'string',
				default: '',
				description: 'Updated phone number. Leave empty to clear.',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'Updated job title. Leave empty to clear.',
			},
		],
	},
];

// =====================================================================
// QUOTE TEMPLATE
// =====================================================================

export const quoteTemplateOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: QUOTE_TEMPLATE,
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description:
					'Create the organization\'s quote template. An org has at most one, and it is auto-provisioned from the org\'s branding the first time the template is read — so on any established org this returns 400 TEMPLATE_ALREADY_EXISTS. Use Update instead.',
				action: 'Create a quote template',
			},
			{
				name: 'Delete',
				value: 'delete',
				description:
					"Reset the organization's quote template to its branding defaults. The template is soft-deleted, and the next read regenerates one from the org's branding — so this does not leave the org without a template. Any customization (colors, disclaimer, terms, closing message, sender details) is permanently lost and cannot be recovered.",
				action: 'Delete a quote template',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single quote template by ID',
				action: 'Get a quote template',
			},
			{
				name: 'Get Default',
				value: 'getDefault',
				description:
					"Get the organization's quote template. If the org has none, one is auto-created from its branding — so this operation can have the side effect of provisioning the template.",
				action: 'Get the default quote template',
			},
			{
				name: 'Get Many',
				value: 'list',
				description: 'List quote templates with pagination',
				action: 'Get many quote templates',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a quote template',
				action: 'Update a quote template',
			},
		],
		default: 'list',
	},
];

const quoteTemplateIdField: INodeProperties = {
	displayName: 'Quote Template ID',
	name: 'quoteTemplateId',
	type: 'string',
	required: true,
	default: '',
	description: 'UUID of the quote template',
	displayOptions: {
		show: {
			resource: QUOTE_TEMPLATE,
			operation: ['get', 'update', 'delete'],
		},
	},
};

const quoteTemplateOptionFields: INodeProperties[] = [
	{
		displayName: 'Logo URL',
		name: 'logoUrl',
		type: 'string',
		default: '',
		description: 'URL of the logo to display on quotes',
	},
	{
		displayName: 'Primary Color',
		name: 'primaryColor',
		type: 'color',
		default: '',
		description: 'Primary brand color (hex)',
	},
	{
		displayName: 'Primary Text Color',
		name: 'primaryTextColor',
		type: 'color',
		default: '',
		description: 'Primary text color (hex)',
	},
	{
		displayName: 'Disclaimer',
		name: 'disclaimer',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		description: 'Disclaimer text shown on quotes',
	},
	{
		displayName: 'Terms and Conditions',
		name: 'termsAndConditions',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		description: 'Terms and conditions text shown on quotes',
	},
	{
		displayName: 'Closing Message',
		name: 'closingMessage',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		description: 'Closing message shown on quotes',
	},
	{
		displayName: 'Sender Name',
		name: 'senderName',
		type: 'string',
		default: '',
		description: 'Name of the sender shown on quotes',
	},
	{
		displayName: 'Sender Phone',
		name: 'senderPhone',
		type: 'string',
		default: '',
		description: 'Phone number of the sender shown on quotes',
	},
	{
		displayName: 'Sender Email',
		name: 'senderEmail',
		type: 'string',
		placeholder: 'name@email.com',
		default: '',
		description: 'Email address of the sender shown on quotes',
	},
	{
		displayName: 'Contact Email',
		name: 'contactEmail',
		type: 'string',
		placeholder: 'name@email.com',
		default: '',
		description: 'Contact email address shown on quotes',
	},
];

export const quoteTemplateFields: INodeProperties[] = [
	quoteTemplateIdField,

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
			show: { resource: QUOTE_TEMPLATE, operation: ['list'] },
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
			show: { resource: QUOTE_TEMPLATE, operation: ['list'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: { resource: QUOTE_TEMPLATE, operation: ['list'] },
		},
		options: [
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				default: '',
				description: 'Filter quote templates by name',
			},
		],
	},

	// ===============================
	// Create
	// ===============================
	{
		displayName: 'Fields',
		name: 'createFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: QUOTE_TEMPLATE, operation: ['create'] },
		},
		options: quoteTemplateOptionFields,
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
			show: { resource: QUOTE_TEMPLATE, operation: ['update'] },
		},
		options: quoteTemplateOptionFields,
	},
];

// =====================================================================
// QUOTE TYPE
// =====================================================================

export const quoteTypeOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: QUOTE_TYPE,
			},
		},
		options: [
			{
				name: 'Bulk Create',
				value: 'bulkCreate',
				description: 'Create many quote types in one request (partial success)',
				action: 'Bulk create quote types',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a quote type/category',
				action: 'Create a quote type',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a quote type/category',
				action: 'Delete a quote type',
			},
			{
				name: 'Get Many',
				value: 'list',
				description: 'List quote types/categories with pagination',
				action: 'Get many quote types',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a quote type/category',
				action: 'Update a quote type',
			},
		],
		default: 'list',
	},
];

const quoteTypeIdField: INodeProperties = {
	displayName: 'Quote Type ID',
	name: 'quoteTypeId',
	type: 'string',
	required: true,
	default: '',
	description: 'UUID of the quote type',
	displayOptions: {
		show: {
			resource: QUOTE_TYPE,
			operation: ['update', 'delete'],
		},
	},
};

export const quoteTypeFields: INodeProperties[] = [
	quoteTypeIdField,

	// ===============================
	// Bulk Create
	// ===============================
	{
		displayName: 'Rows',
		name: 'rows',
		type: 'json',
		required: true,
		default: '[]',
		description:
			'JSON array of quote types to create. Each row uses the same shape as Create: name, categoryType (product_category/pricebook_type/company_industry/bundle_category).',
		placeholder: '[{"name":"Software","categoryType":"product_category"}]',
		hint: 'Each row uses the same shape as Create. Max 500 rows; failed rows are reported in the result\'s `failed` array, not thrown.',
		displayOptions: {
			show: { resource: QUOTE_TYPE, operation: ['bulkCreate'] },
		},
	},

	// ===============================
	// Create
	// ===============================
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Name of the quote type',
		displayOptions: {
			show: { resource: QUOTE_TYPE, operation: ['create'] },
		},
	},
	{
		displayName: 'Category Type',
		name: 'categoryType',
		type: 'options',
		required: true,
		default: 'product_category',
		description: 'The category this type belongs to',
		options: CATEGORY_TYPE_OPTIONS,
		displayOptions: {
			show: { resource: QUOTE_TYPE, operation: ['create'] },
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
			show: { resource: QUOTE_TYPE, operation: ['list'] },
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
			show: { resource: QUOTE_TYPE, operation: ['list'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: { resource: QUOTE_TYPE, operation: ['list'] },
		},
		options: [
			{
				displayName: 'Category Type',
				name: 'categoryType',
				type: 'options',
				default: 'product_category',
				description: 'Filter by category type',
				options: CATEGORY_TYPE_OPTIONS,
			},
			{
				displayName: 'Include Usage',
				name: 'includeUsage',
				type: 'boolean',
				default: false,
				description: 'Whether to include usage information in the response',
			},
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				default: '',
				description: 'Filter quote types by name',
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
			show: { resource: QUOTE_TYPE, operation: ['update'] },
		},
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Updated name of the quote type',
			},
		],
	},
];
