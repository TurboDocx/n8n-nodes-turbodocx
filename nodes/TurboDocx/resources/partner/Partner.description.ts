import { INodeProperties } from 'n8n-workflow';

const ORG = ['partnerOrganization'];
const ORG_USER = ['partnerOrgUser'];
const ORG_API_KEY = ['partnerOrgApiKey'];
const PARTNER_API_KEY = ['partnerApiKey'];
const PARTNER_USER = ['partnerUser'];
const AUDIT_LOG = ['partnerAuditLog'];

// Shared option lists ------------------------------------------------------
const ORG_USER_ROLE_OPTIONS = [
	{ name: 'Admin', value: 'admin' },
	{ name: 'Contributor', value: 'contributor' },
	{ name: 'User', value: 'user' },
	{ name: 'Viewer', value: 'viewer' },
];

const PARTNER_USER_ROLE_OPTIONS = [
	{ name: 'Admin', value: 'admin' },
	{ name: 'Member', value: 'member' },
	{ name: 'Viewer', value: 'viewer' },
];

const FEATURES_PLACEHOLDER =
	'{"maxUsers":50,"maxTemplates":100,"maxStorage":10737418240,"hasTDAI":true,"hasPptx":true,"hasSalesforce":false}';
const FEATURES_HINT =
	'Partial Features object. Keys: maxUsers, maxProjectspaces, maxTemplates, maxStorage, maxGeneratedDeliverables, maxSignatures, maxAICredits, rdWatermark, hasFileDownload, hasAdvancedDateFormats, hasGDrive, hasSharepoint, hasSharepointOnly, hasTDAI, hasPptx, hasTDWriter, hasSalesforce, hasWrike, hasVariableStack, hasSubvariables, hasZapier, hasBYOM, hasBYOVS, hasBetaFeatures, enableBulkSending.';

const SCOPES_PLACEHOLDER = '["org:create","org:read","org:update"]';
const SCOPES_HINT =
	'Array of partner scopes. Valid values: org:create, org:read, org:update, org:delete, entitlements:update, org-users:create, org-users:read, org-users:update, org-users:delete, partner-users:create, partner-users:read, partner-users:update, partner-users:delete, org-apikeys:create, org-apikeys:read, org-apikeys:update, org-apikeys:delete, partner-apikeys:create, partner-apikeys:read, partner-apikeys:update, partner-apikeys:delete, audit:read.';

const PERMISSIONS_PLACEHOLDER =
	'{"canManageOrgs":true,"canManageOrgUsers":true,"canManagePartnerUsers":false,"canManageOrgAPIKeys":true,"canManagePartnerAPIKeys":false,"canUpdateEntitlements":true,"canViewAuditLogs":true}';
const PERMISSIONS_HINT =
	'PartnerPermissions object with 7 booleans: canManageOrgs, canManageOrgUsers, canManagePartnerUsers, canManageOrgAPIKeys, canManagePartnerAPIKeys, canUpdateEntitlements, canViewAuditLogs.';

// =====================================================================
// Partner Organization
// =====================================================================
export const partnerOrganizationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ORG } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new organization',
				action: 'Create an organization',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an organization',
				action: 'Delete an organization',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get details of a single organization',
				action: 'Get an organization',
			},
			{
				name: 'Get Many',
				value: 'list',
				description: 'List organizations with search and pagination',
				action: 'Get many organizations',
			},
			{
				name: 'Update',
				value: 'update',
				description: "Update an organization's name",
				action: 'Update an organization',
			},
			{
				name: 'Update Entitlements',
				value: 'updateEntitlements',
				description: "Update an organization's features and tracking entitlements",
				action: 'Update organization entitlements',
			},
		],
		default: 'list',
	},
];

const organizationIdField: INodeProperties = {
	displayName: 'Organization ID',
	name: 'organizationId',
	type: 'string',
	required: true,
	default: '',
	description: 'UUID of the organization',
	displayOptions: {
		show: {
			resource: ORG,
			operation: ['get', 'update', 'delete', 'updateEntitlements'],
		},
	},
};

export const partnerOrganizationFields: INodeProperties[] = [
	organizationIdField,

	// Create
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Name for the new organization',
		displayOptions: { show: { resource: ORG, operation: ['create'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ORG, operation: ['create'] } },
		options: [
			{
				displayName: 'Features',
				name: 'features',
				type: 'json',
				default: '{}',
				description: 'JSON object of feature entitlements to set on the new organization',
				placeholder: FEATURES_PLACEHOLDER,
				hint: FEATURES_HINT,
			},
			{
				displayName: 'Metadata',
				name: 'metadata',
				type: 'json',
				default: '{}',
				description: 'Arbitrary JSON metadata to associate with the organization',
				placeholder: '{"industry":"Technology"}',
			},
		],
	},

	// Update
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Updated organization name',
		displayOptions: { show: { resource: ORG, operation: ['update'] } },
	},

	// Update Entitlements
	{
		displayName: 'Features',
		name: 'features',
		type: 'json',
		default: '{}',
		description: 'JSON object of feature entitlements to update. Only included keys are changed.',
		placeholder: FEATURES_PLACEHOLDER,
		hint: FEATURES_HINT,
		displayOptions: { show: { resource: ORG, operation: ['updateEntitlements'] } },
	},
	{
		displayName: 'Tracking',
		name: 'tracking',
		type: 'json',
		default: '{}',
		description:
			'JSON object of usage tracking counters to update. Keys: numUsers, numProjectspaces, numTemplates, storageUsed, numGeneratedDeliverables, numSignaturesUsed, currentAICredits.',
		placeholder: '{"numUsers":12,"storageUsed":5368709120}',
		displayOptions: { show: { resource: ORG, operation: ['updateEntitlements'] } },
	},

	// Get Many
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ORG, operation: ['list'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ORG, operation: ['list'], returnAll: [false] } },
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ORG, operation: ['list'] } },
		options: [
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Filter organizations by name',
			},
		],
	},
];

// =====================================================================
// Partner Org User
// =====================================================================
export const partnerOrgUserOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ORG_USER } },
		options: [
			{
				name: 'Add',
				value: 'add',
				description: 'Add a user to an organization',
				action: 'Add an org user',
			},
			{
				name: 'Get Many',
				value: 'list',
				description: 'List users in an organization',
				action: 'Get many org users',
			},
			{
				name: 'Remove',
				value: 'remove',
				description: 'Remove a user from an organization',
				action: 'Remove an org user',
			},
			{
				name: 'Resend Invite',
				value: 'resendInvite',
				description: 'Resend an organization invitation email to a user',
				action: 'Resend an org user invite',
			},
			{
				name: 'Update Role',
				value: 'updateRole',
				description: "Update a user's role in an organization",
				action: 'Update an org user role',
			},
		],
		default: 'list',
	},
];

export const partnerOrgUserFields: INodeProperties[] = [
	{
		displayName: 'Organization ID',
		name: 'organizationId',
		type: 'string',
		required: true,
		default: '',
		description: 'UUID of the organization',
		displayOptions: { show: { resource: ORG_USER } },
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		description: 'UUID of the organization user',
		displayOptions: {
			show: { resource: ORG_USER, operation: ['updateRole', 'remove', 'resendInvite'] },
		},
	},

	// Add
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'user@example.com',
		description: 'Email address of the user to add',
		displayOptions: { show: { resource: ORG_USER, operation: ['add'] } },
	},
	{
		displayName: 'Role',
		name: 'role',
		type: 'options',
		default: 'user',
		description: 'Role to grant the user in the organization',
		options: ORG_USER_ROLE_OPTIONS,
		displayOptions: { show: { resource: ORG_USER, operation: ['add'] } },
	},

	// Update Role
	{
		displayName: 'Role',
		name: 'role',
		type: 'options',
		default: 'user',
		description: 'Updated role for the user',
		options: ORG_USER_ROLE_OPTIONS,
		displayOptions: { show: { resource: ORG_USER, operation: ['updateRole'] } },
	},

	// Get Many
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ORG_USER, operation: ['list'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ORG_USER, operation: ['list'], returnAll: [false] } },
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ORG_USER, operation: ['list'] } },
		options: [
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Filter users by name or email',
			},
		],
	},
];

// =====================================================================
// Partner Org API Key
// =====================================================================
export const partnerOrgApiKeyOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ORG_API_KEY } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create an API key for an organization',
				action: 'Create an org API key',
			},
			{
				name: 'Get Many',
				value: 'list',
				description: 'List API keys for an organization',
				action: 'Get many org API keys',
			},
			{
				name: 'Revoke',
				value: 'revoke',
				description: 'Revoke an organization API key',
				action: 'Revoke an org API key',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an organization API key',
				action: 'Update an org API key',
			},
		],
		default: 'list',
	},
];

export const partnerOrgApiKeyFields: INodeProperties[] = [
	{
		displayName: 'Organization ID',
		name: 'organizationId',
		type: 'string',
		required: true,
		default: '',
		description: 'UUID of the organization',
		displayOptions: { show: { resource: ORG_API_KEY } },
	},
	{
		displayName: 'API Key ID',
		name: 'apiKeyId',
		type: 'string',
		typeOptions: { password: true },
		required: true,
		default: '',
		description: 'UUID of the API key',
		displayOptions: { show: { resource: ORG_API_KEY, operation: ['update', 'revoke'] } },
	},

	// Create
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Name for the new API key',
		displayOptions: { show: { resource: ORG_API_KEY, operation: ['create'] } },
	},
	{
		displayName: 'Role',
		name: 'role',
		type: 'string',
		required: true,
		default: '',
		description: 'Role assigned to the API key (e.g. admin, contributor)',
		displayOptions: { show: { resource: ORG_API_KEY, operation: ['create'] } },
	},

	// Update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ORG_API_KEY, operation: ['update'] } },
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Updated name for the API key',
			},
			{
				displayName: 'Role',
				name: 'role',
				type: 'string',
				default: '',
				description: 'Updated role for the API key',
			},
		],
	},

	// Get Many
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ORG_API_KEY, operation: ['list'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ORG_API_KEY, operation: ['list'], returnAll: [false] } },
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ORG_API_KEY, operation: ['list'] } },
		options: [
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Filter API keys by name',
			},
		],
	},
];

// =====================================================================
// Partner API Key
// =====================================================================
export const partnerApiKeyOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: PARTNER_API_KEY } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new partner API key',
				action: 'Create a partner API key',
			},
			{
				name: 'Get Many',
				value: 'list',
				description: 'List partner API keys',
				action: 'Get many partner API keys',
			},
			{
				name: 'Revoke',
				value: 'revoke',
				description: 'Revoke a partner API key',
				action: 'Revoke a partner API key',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a partner API key',
				action: 'Update a partner API key',
			},
		],
		default: 'list',
	},
];

export const partnerApiKeyFields: INodeProperties[] = [
	{
		displayName: 'API Key ID',
		name: 'apiKeyId',
		type: 'string',
		typeOptions: { password: true },
		required: true,
		default: '',
		description: 'UUID of the partner API key',
		displayOptions: { show: { resource: PARTNER_API_KEY, operation: ['update', 'revoke'] } },
	},

	// Create
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Name for the new partner API key',
		displayOptions: { show: { resource: PARTNER_API_KEY, operation: ['create'] } },
	},
	{
		displayName: 'Scopes',
		name: 'scopes',
		type: 'json',
		required: true,
		default: '[]',
		description: 'JSON array of partner scopes to grant the key',
		placeholder: SCOPES_PLACEHOLDER,
		hint: SCOPES_HINT,
		displayOptions: { show: { resource: PARTNER_API_KEY, operation: ['create'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: PARTNER_API_KEY, operation: ['create'] } },
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 2 },
				default: '',
				description: 'Description of the API key',
			},
		],
	},

	// Update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: PARTNER_API_KEY, operation: ['update'] } },
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 2 },
				default: '',
				description: 'Updated description for the API key',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Updated name for the API key',
			},
			{
				displayName: 'Scopes',
				name: 'scopes',
				type: 'json',
				default: '[]',
				description: 'JSON array of partner scopes. Replaces the existing scopes.',
				placeholder: SCOPES_PLACEHOLDER,
				hint: SCOPES_HINT,
			},
		],
	},

	// Get Many
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: PARTNER_API_KEY, operation: ['list'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: PARTNER_API_KEY, operation: ['list'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: PARTNER_API_KEY, operation: ['list'] } },
		options: [
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Filter API keys by name',
			},
		],
	},
];

// =====================================================================
// Partner User
// =====================================================================
export const partnerUserOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: PARTNER_USER } },
		options: [
			{
				name: 'Add',
				value: 'add',
				description: 'Add a user to the partner portal',
				action: 'Add a partner user',
			},
			{
				name: 'Get Many',
				value: 'list',
				description: 'List partner portal users',
				action: 'Get many partner users',
			},
			{
				name: 'Remove',
				value: 'remove',
				description: 'Remove a user from the partner portal',
				action: 'Remove a partner user',
			},
			{
				name: 'Resend Invite',
				value: 'resendInvite',
				description: 'Resend a partner portal invitation email to a user',
				action: 'Resend a partner user invite',
			},
			{
				name: 'Update Permissions',
				value: 'updatePermissions',
				description: "Update a partner user's role and permissions",
				action: 'Update partner user permissions',
			},
		],
		default: 'list',
	},
];

export const partnerUserFields: INodeProperties[] = [
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		description: 'UUID of the partner user',
		displayOptions: {
			show: { resource: PARTNER_USER, operation: ['updatePermissions', 'remove', 'resendInvite'] },
		},
	},

	// Add
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'admin@partner.com',
		description: 'Email address of the user to add',
		displayOptions: { show: { resource: PARTNER_USER, operation: ['add'] } },
	},
	{
		displayName: 'Role',
		name: 'role',
		type: 'options',
		default: 'member',
		description: 'Role to grant the partner user',
		options: PARTNER_USER_ROLE_OPTIONS,
		displayOptions: { show: { resource: PARTNER_USER, operation: ['add'] } },
	},
	{
		displayName: 'Permissions',
		name: 'permissions',
		type: 'json',
		required: true,
		default: PERMISSIONS_PLACEHOLDER,
		description: 'JSON object of partner permissions to grant the user',
		placeholder: PERMISSIONS_PLACEHOLDER,
		hint: PERMISSIONS_HINT,
		displayOptions: { show: { resource: PARTNER_USER, operation: ['add'] } },
	},

	// Update Permissions
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: PARTNER_USER, operation: ['updatePermissions'] } },
		options: [
			{
				displayName: 'Permissions',
				name: 'permissions',
				type: 'json',
				default: '{}',
				description:
					'JSON object of partner permissions to update. Only included keys are changed.',
				placeholder: PERMISSIONS_PLACEHOLDER,
				hint: PERMISSIONS_HINT,
			},
			{
				displayName: 'Role',
				name: 'role',
				type: 'options',
				default: 'member',
				description: 'Updated role for the partner user',
				options: PARTNER_USER_ROLE_OPTIONS,
			},
		],
	},

	// Get Many
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: PARTNER_USER, operation: ['list'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: PARTNER_USER, operation: ['list'], returnAll: [false] } },
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: PARTNER_USER, operation: ['list'] } },
		options: [
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Filter users by name or email',
			},
		],
	},
];

// =====================================================================
// Partner Audit Log
// =====================================================================
export const partnerAuditLogOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: AUDIT_LOG } },
		options: [
			{
				name: 'Get Many',
				value: 'list',
				description: 'List partner audit log entries with filtering and pagination',
				action: 'Get many audit logs',
			},
		],
		default: 'list',
	},
];

export const partnerAuditLogFields: INodeProperties[] = [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: AUDIT_LOG, operation: ['list'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: AUDIT_LOG, operation: ['list'], returnAll: [false] } },
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: AUDIT_LOG, operation: ['list'] } },
		options: [
			{
				displayName: 'Action',
				name: 'action',
				type: 'string',
				default: '',
				description: 'Filter by action name (e.g. org.created)',
			},
			{
				displayName: 'End Date',
				name: 'endDate',
				type: 'string',
				default: '',
				placeholder: '2025-12-31',
				description: 'Only include entries on or before this date (ISO 8601)',
			},
			{
				displayName: 'Resource ID',
				name: 'resourceId',
				type: 'string',
				default: '',
				description: 'Filter by the affected resource ID',
			},
			{
				displayName: 'Resource Type',
				name: 'resourceType',
				type: 'string',
				default: '',
				description: 'Filter by resource type (e.g. organization)',
			},
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Free-text search across audit log entries',
			},
			{
				displayName: 'Start Date',
				name: 'startDate',
				type: 'string',
				default: '',
				placeholder: '2025-01-01',
				description: 'Only include entries on or after this date (ISO 8601)',
			},
			{
				displayName: 'Success',
				name: 'success',
				type: 'boolean',
				default: false,
				description: 'Whether to only include entries with a matching success outcome',
			},
		],
	},
];
