import { INodeProperties } from 'n8n-workflow';

const RESOURCE = ['deliverable'];

export const deliverableOperations: INodeProperties[] = [
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
				name: 'Delete',
				value: 'delete',
				description: 'Soft-delete a deliverable',
				action: 'Delete a deliverable',
			},
			{
				name: 'Download PDF',
				value: 'downloadPdf',
				description: 'Download the generated PDF as binary data',
				action: 'Download deliverable PDF',
			},
			{
				name: 'Download Source File',
				value: 'downloadSource',
				description: 'Download the original DOCX/PPTX source file as binary data',
				action: 'Download deliverable source file',
			},
			{
				name: 'Generate',
				value: 'generate',
				description: 'Generate a document from a template with variable substitution',
				action: 'Generate a deliverable',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get full details of a single deliverable',
				action: 'Get a deliverable',
			},
			{
				name: 'Get Many',
				value: 'list',
				description: 'List deliverables with search and pagination',
				action: 'Get many deliverables',
			},
			{
				name: 'Update',
				value: 'update',
				description: "Update a deliverable's name, description, or tags",
				action: 'Update a deliverable',
			},
		],
		default: 'generate',
	},
];

const deliverableIdField: INodeProperties = {
	displayName: 'Deliverable ID',
	name: 'deliverableId',
	type: 'string',
	required: true,
	default: '',
	description: 'UUID of the deliverable',
	displayOptions: {
		show: {
			resource: RESOURCE,
			operation: ['get', 'update', 'delete', 'downloadPdf', 'downloadSource'],
		},
	},
};

export const deliverableFields: INodeProperties[] = [
	deliverableIdField,

	// ===============================
	// Generate
	// ===============================
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Name for the generated deliverable (3-255 characters)',
		displayOptions: {
			show: { resource: RESOURCE, operation: ['generate'] },
		},
	},
	{
		displayName: 'Template ID',
		name: 'templateId',
		type: 'string',
		required: true,
		default: '',
		description: 'UUID of the template to generate from',
		displayOptions: {
			show: { resource: RESOURCE, operation: ['generate'] },
		},
	},
	{
		displayName: 'Variables',
		name: 'variables',
		type: 'json',
		required: true,
		default: '[]',
		description:
			'JSON array of variables to substitute. Each item: placeholder, text, mimeType (text/html/image/markdown).',
		placeholder:
			'[{"placeholder":"{CompanyName}","text":"TechCorp Inc.","mimeType":"text"}]',
		hint: 'Example: [{"placeholder":"{EmployeeName}","text":"John Smith","mimeType":"text"},{"placeholder":"{CompanyName}","text":"TechCorp","mimeType":"text"}]',
		displayOptions: {
			show: { resource: RESOURCE, operation: ['generate'] },
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: RESOURCE, operation: ['generate'] },
		},
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Description for the deliverable',
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'json',
				default: '[]',
				description: 'JSON array of tag strings to associate with the deliverable',
				placeholder: '["hr", "contract"]',
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
			show: { resource: RESOURCE, operation: ['list'] },
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
			show: { resource: RESOURCE, operation: ['list'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: { resource: RESOURCE, operation: ['list'] },
		},
		options: [
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				default: '',
				description: 'Filter deliverables by name',
			},
			{
				displayName: 'Include Tags',
				name: 'showTags',
				type: 'boolean',
				default: false,
				description: 'Whether to include tags in the response',
			},
		],
	},

	// ===============================
	// Get (single) - extra option
	// ===============================
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: { resource: RESOURCE, operation: ['get'] },
		},
		options: [
			{
				displayName: 'Include Tags',
				name: 'showTags',
				type: 'boolean',
				default: false,
				description: 'Whether to include tags in the response',
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
			show: { resource: RESOURCE, operation: ['update'] },
		},
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Updated name (3-255 characters)',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Updated description',
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'json',
				default: '[]',
				description: 'JSON array of tags. Replaces all existing tags; pass [] to remove all.',
				placeholder: '["hr", "contract", "finalized"]',
			},
		],
	},
];
