import { INodeProperties } from 'n8n-workflow';

const PRODUCT = ['product'];
const PRICEBOOK = ['priceBook'];
const BUNDLE = ['bundle'];

const BILLING_FREQUENCY_OPTIONS = [
	{ name: 'Annual', value: 'annual' },
	{ name: 'Monthly', value: 'monthly' },
	{ name: 'One-Time', value: 'one-time' },
	{ name: 'Quarterly', value: 'quarterly' },
];

const CURRENCY_OPTIONS = [
	{ name: 'AUD', value: 'AUD' },
	{ name: 'CAD', value: 'CAD' },
	{ name: 'EUR', value: 'EUR' },
	{ name: 'GBP', value: 'GBP' },
	{ name: 'INR', value: 'INR' },
	{ name: 'USD', value: 'USD' },
];

// =====================================================================================
// PRODUCT
// =====================================================================================

export const productOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: PRODUCT,
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a product, optionally with images',
				action: 'Create a product',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a product',
				action: 'Delete a product',
			},
			{
				name: 'Duplicate',
				value: 'duplicate',
				description: 'Duplicate a product',
				action: 'Duplicate a product',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single product',
				action: 'Get a product',
			},
			{
				name: 'Get Many',
				value: 'list',
				description: 'List products with filters and pagination',
				action: 'Get many products',
			},
			{
				name: 'Get Primary Images',
				value: 'primaryImages',
				description: 'Get the primary image for a set of products',
				action: 'Get primary images of products',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a product, optionally with images',
				action: 'Update a product',
			},
		],
		default: 'list',
	},
];

const productIdField: INodeProperties = {
	displayName: 'Product ID',
	name: 'productId',
	type: 'string',
	required: true,
	default: '',
	description: 'UUID of the product',
	displayOptions: {
		show: {
			resource: PRODUCT,
			operation: ['get', 'update', 'delete', 'duplicate'],
		},
	},
};

export const productFields: INodeProperties[] = [
	productIdField,

	// ===============================
	// Product: Create (required)
	// ===============================
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Name of the product',
		displayOptions: {
			show: { resource: PRODUCT, operation: ['create'] },
		},
	},
	{
		displayName: 'List Price',
		name: 'listPrice',
		type: 'number',
		required: true,
		default: 0,
		description: 'List (catalog) price of the product',
		displayOptions: {
			show: { resource: PRODUCT, operation: ['create'] },
		},
	},
	{
		displayName: 'Billing Frequency',
		name: 'billingFrequency',
		type: 'options',
		default: 'one-time',
		description: 'How often the product is billed',
		options: BILLING_FREQUENCY_OPTIONS,
		displayOptions: {
			show: { resource: PRODUCT, operation: ['create'] },
		},
	},
	{
		displayName: 'Category ID',
		name: 'categoryId',
		type: 'string',
		required: true,
		default: '',
		description: 'UUID of the product category',
		displayOptions: {
			show: { resource: PRODUCT, operation: ['create'] },
		},
	},

	// ===============================
	// Product: Image Binary Property (create + update)
	// ===============================
	{
		displayName: 'Image Binary Property',
		name: 'imageBinaryProperty',
		type: 'string',
		default: '',
		description:
			'Comma-separated list of input binary property names to upload as product images (e.g. "data" or "image0,image1"). Leave empty to send a JSON-only request without images.',
		placeholder: 'data',
		hint: 'Each named binary property on the input item is uploaded as one product image. Type is auto-detected from the file content.',
		displayOptions: {
			show: { resource: PRODUCT, operation: ['create', 'update'] },
		},
	},

	// ===============================
	// Product: Create — Additional Fields
	// ===============================
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: PRODUCT, operation: ['create'] },
		},
		options: [
			{
				displayName: 'Cost',
				name: 'cost',
				type: 'number',
				default: 0,
				description: 'Internal cost of the product',
			},
			{
				displayName: 'Currency',
				name: 'currency',
				type: 'options',
				default: 'USD',
				options: CURRENCY_OPTIONS,
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Short description of the product',
			},
			{
				displayName: 'Detailed Specification',
				name: 'detailedSpecification',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description: 'Detailed specification text for the product',
			},
			{
				displayName: 'Internal Notes',
				name: 'internalNotes',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Internal notes not shown to customers',
			},
			{
				displayName: 'Minimum Order Quantity',
				name: 'minimumOrderQuantity',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 1,
				description: 'Minimum quantity that can be ordered',
			},
			{
				displayName: 'Show in Catalog',
				name: 'showInCatalog',
				type: 'boolean',
				default: false,
				description: 'Whether the product appears in the catalog',
			},
			{
				displayName: 'SKU',
				name: 'sku',
				type: 'string',
				default: '',
				description: 'Stock keeping unit identifier',
			},
		],
	},

	// ===============================
	// Product: Update — Update Fields
	// ===============================
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: PRODUCT, operation: ['update'] },
		},
		options: [
			{
				displayName: 'Billing Frequency',
				name: 'billingFrequency',
				type: 'options',
				default: 'one-time',
				options: BILLING_FREQUENCY_OPTIONS,
			},
			{
				displayName: 'Category ID',
				name: 'categoryId',
				type: 'string',
				default: '',
				description: 'UUID of the product category',
			},
			{
				displayName: 'Cost',
				name: 'cost',
				type: 'number',
				default: 0,
				description: 'Internal cost of the product',
			},
			{
				displayName: 'Currency',
				name: 'currency',
				type: 'options',
				default: 'USD',
				options: CURRENCY_OPTIONS,
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Short description of the product',
			},
			{
				displayName: 'Detailed Specification',
				name: 'detailedSpecification',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description: 'Detailed specification text for the product',
			},
			{
				displayName: 'Image IDs to Keep',
				name: 'imageIdsToKeep',
				type: 'json',
				default: '[]',
				description:
					'JSON array of existing image IDs to keep. Images not listed are removed. Only used when uploading images.',
				placeholder: '["img-uuid-1","img-uuid-2"]',
			},
			{
				displayName: 'Image Order',
				name: 'imageOrder',
				type: 'json',
				default: '[]',
				description: 'JSON array of image IDs in the desired display order',
				placeholder: '["img-uuid-1","img-uuid-2"]',
			},
			{
				displayName: 'Internal Notes',
				name: 'internalNotes',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Internal notes not shown to customers',
			},
			{
				displayName: 'List Price',
				name: 'listPrice',
				type: 'number',
				default: 0,
				description: 'List (catalog) price of the product',
			},
			{
				displayName: 'Minimum Order Quantity',
				name: 'minimumOrderQuantity',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 1,
				description: 'Minimum quantity that can be ordered',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Name of the product',
			},
			{
				displayName: 'Show in Catalog',
				name: 'showInCatalog',
				type: 'boolean',
				default: false,
				description: 'Whether the product appears in the catalog',
			},
			{
				displayName: 'SKU',
				name: 'sku',
				type: 'string',
				default: '',
				description: 'Stock keeping unit identifier',
			},
		],
	},

	// ===============================
	// Product: Get Primary Images
	// ===============================
	{
		displayName: 'Product IDs',
		name: 'productIds',
		type: 'json',
		required: true,
		default: '[]',
		description: 'JSON array of product UUIDs to fetch primary images for',
		placeholder: '["prod-uuid-1","prod-uuid-2"]',
		hint: 'Returns a map of product ID to its primary image (or null when none).',
		displayOptions: {
			show: { resource: PRODUCT, operation: ['primaryImages'] },
		},
	},

	// ===============================
	// Product: Get Many
	// ===============================
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: { resource: PRODUCT, operation: ['list'] },
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: PRODUCT, operation: ['list'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: { resource: PRODUCT, operation: ['list'] },
		},
		options: [
			{
				displayName: 'Billing Frequency',
				name: 'billingFrequency',
				type: 'options',
				default: 'one-time',
				options: BILLING_FREQUENCY_OPTIONS,
			},
			{
				displayName: 'Category IDs',
				name: 'categoryIds',
				type: 'string',
				default: '',
				description: 'Comma-separated list of category UUIDs to filter by',
			},
			{
				displayName: 'Currency',
				name: 'currency',
				type: 'options',
				default: 'USD',
				options: CURRENCY_OPTIONS,
			},
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				default: '',
				description: 'Filter products by name or SKU',
			},
			{
				displayName: 'Show in Catalog',
				name: 'showInCatalog',
				type: 'boolean',
				default: false,
				description: 'Whether to only return products shown in the catalog',
			},
		],
	},
];

// =====================================================================================
// PRICE BOOK
// =====================================================================================

export const priceBookOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: PRICEBOOK,
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a price book',
				action: 'Create a price book',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a price book',
				action: 'Delete a price book',
			},
			{
				name: 'Duplicate',
				value: 'duplicate',
				description: 'Duplicate a price book',
				action: 'Duplicate a price book',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single price book',
				action: 'Get a price book',
			},
			{
				name: 'Get Many',
				value: 'list',
				description: 'List price books with filters and pagination',
				action: 'Get many price books',
			},
			{
				name: 'Get Many Products',
				value: 'listProducts',
				description: 'List the products priced in a price book',
				action: 'Get many products of a price book',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a price book',
				action: 'Update a price book',
			},
		],
		default: 'list',
	},
];

const priceBookIdField: INodeProperties = {
	displayName: 'Price Book ID',
	name: 'priceBookId',
	type: 'string',
	required: true,
	default: '',
	description: 'UUID of the price book',
	displayOptions: {
		show: {
			resource: PRICEBOOK,
			operation: ['get', 'update', 'delete', 'duplicate', 'listProducts'],
		},
	},
};

export const priceBookFields: INodeProperties[] = [
	priceBookIdField,

	// ===============================
	// Price Book: Create (required)
	// ===============================
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Name of the price book',
		displayOptions: {
			show: { resource: PRICEBOOK, operation: ['create'] },
		},
	},
	{
		displayName: 'Price Book Type ID',
		name: 'priceBookTypeId',
		type: 'string',
		required: true,
		default: '',
		description: 'UUID of the price book type',
		displayOptions: {
			show: { resource: PRICEBOOK, operation: ['create'] },
		},
	},
	{
		displayName: 'Valid From',
		name: 'validFrom',
		type: 'dateTime',
		required: true,
		default: '',
		description: 'Date the price book becomes valid',
		displayOptions: {
			show: { resource: PRICEBOOK, operation: ['create'] },
		},
	},
	{
		displayName: 'Product Pricing',
		name: 'productPricing',
		type: 'json',
		default: '[]',
		description:
			'JSON array of per-product pricing. Each item: productId, plus optional discountPercent, discountType (percent/amount), discountAmount, finalPrice.',
		placeholder:
			'[{"productId":"prod-uuid","discountPercent":10},{"productId":"prod-uuid-2","finalPrice":99.99}]',
		hint: 'Leave as [] for a price book that uses only a blanket discount percent.',
		displayOptions: {
			show: { resource: PRICEBOOK, operation: ['create'] },
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: PRICEBOOK, operation: ['create'] },
		},
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Description of the price book',
			},
			{
				displayName: 'Discount Percent',
				name: 'discountPercent',
				type: 'number',
				default: 0,
				description: 'Blanket discount percent applied to all products (defaults to 0)',
			},
			{
				displayName: 'Is Default',
				name: 'isDefault',
				type: 'boolean',
				default: false,
				description: 'Whether this is the default price book',
			},
			{
				displayName: 'Show in Quote Builder',
				name: 'showInQuoteBuilder',
				type: 'boolean',
				default: false,
				description: 'Whether the price book appears in the quote builder',
			},
			{
				displayName: 'Valid To',
				name: 'validTo',
				type: 'dateTime',
				default: '',
				description: 'Date the price book stops being valid',
			},
		],
	},

	// ===============================
	// Price Book: Update — Update Fields
	// ===============================
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: PRICEBOOK, operation: ['update'] },
		},
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Description of the price book',
			},
			{
				displayName: 'Discount Percent',
				name: 'discountPercent',
				type: 'number',
				default: 0,
				description: 'Blanket discount percent applied to all products',
			},
			{
				displayName: 'Is Default',
				name: 'isDefault',
				type: 'boolean',
				default: false,
				description: 'Whether this is the default price book',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Name of the price book',
			},
			{
				displayName: 'Price Book Type ID',
				name: 'priceBookTypeId',
				type: 'string',
				default: '',
				description: 'UUID of the price book type',
			},
			{
				displayName: 'Product Pricing',
				name: 'productPricing',
				type: 'json',
				default: '[]',
				description:
					'JSON array of per-product pricing. Each item: productId, plus optional discountPercent, discountType, discountAmount, finalPrice. Replaces existing pricing.',
				placeholder: '[{"productId":"prod-uuid","discountPercent":10}]',
			},
			{
				displayName: 'Show in Quote Builder',
				name: 'showInQuoteBuilder',
				type: 'boolean',
				default: false,
				description: 'Whether the price book appears in the quote builder',
			},
			{
				displayName: 'Valid From',
				name: 'validFrom',
				type: 'dateTime',
				default: '',
				description: 'Date the price book becomes valid',
			},
			{
				displayName: 'Valid To',
				name: 'validTo',
				type: 'dateTime',
				default: '',
				description: 'Date the price book stops being valid',
			},
		],
	},

	// ===============================
	// Price Book: Get Many
	// ===============================
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: { resource: PRICEBOOK, operation: ['list', 'listProducts'] },
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: PRICEBOOK, operation: ['list', 'listProducts'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: { resource: PRICEBOOK, operation: ['list'] },
		},
		options: [
			{
				displayName: 'Price Book Type IDs',
				name: 'priceBookTypeIds',
				type: 'string',
				default: '',
				description: 'Comma-separated list of price book type UUIDs to filter by',
			},
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				default: '',
				description: 'Filter price books by name',
			},
			{
				displayName: 'Show in Quote Builder',
				name: 'showInQuoteBuilder',
				type: 'boolean',
				default: false,
				description: 'Whether to only return price books shown in the quote builder',
			},
		],
	},
	{
		displayName: 'Filters',
		name: 'listProductsFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: { resource: PRICEBOOK, operation: ['listProducts'] },
		},
		options: [
			{
				displayName: 'Category IDs',
				name: 'categoryIds',
				type: 'string',
				default: '',
				description: 'Comma-separated list of category UUIDs to filter by',
			},
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				default: '',
				description: 'Filter products by name or SKU',
			},
		],
	},
];

// =====================================================================================
// BUNDLE
// =====================================================================================

export const bundleOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: BUNDLE,
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a bundle',
				action: 'Create a bundle',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a bundle',
				action: 'Delete a bundle',
			},
			{
				name: 'Duplicate',
				value: 'duplicate',
				description: 'Duplicate a bundle',
				action: 'Duplicate a bundle',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single bundle',
				action: 'Get a bundle',
			},
			{
				name: 'Get Many',
				value: 'list',
				description: 'List bundles with filters and pagination',
				action: 'Get many bundles',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a bundle',
				action: 'Update a bundle',
			},
		],
		default: 'list',
	},
];

const bundleIdField: INodeProperties = {
	displayName: 'Bundle ID',
	name: 'bundleId',
	type: 'string',
	required: true,
	default: '',
	description: 'UUID of the bundle',
	displayOptions: {
		show: {
			resource: BUNDLE,
			operation: ['get', 'update', 'delete', 'duplicate'],
		},
	},
};

export const bundleFields: INodeProperties[] = [
	bundleIdField,

	// ===============================
	// Bundle: Create (required)
	// ===============================
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Name of the bundle',
		displayOptions: {
			show: { resource: BUNDLE, operation: ['create'] },
		},
	},
	{
		displayName: 'Category ID',
		name: 'categoryId',
		type: 'string',
		required: true,
		default: '',
		description: 'UUID of the bundle category',
		displayOptions: {
			show: { resource: BUNDLE, operation: ['create'] },
		},
	},
	{
		displayName: 'Items',
		name: 'items',
		type: 'json',
		default: '[]',
		description:
			'JSON array of bundle items. Each item: productId, unitPrice, billingFrequency, plus optional quantity, discountPercent, discountType, discountAmount, finalPrice, cost.',
		placeholder:
			'[{"productId":"prod-uuid","unitPrice":100,"billingFrequency":"one-time","quantity":2}]',
		hint: 'Leave as [] to create an empty bundle and add items later.',
		displayOptions: {
			show: { resource: BUNDLE, operation: ['create'] },
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: BUNDLE, operation: ['create'] },
		},
		options: [
			{
				displayName: 'Bundle Discount Amount',
				name: 'bundleDiscountAmount',
				type: 'number',
				default: 0,
				description: 'Fixed discount amount applied to the bundle',
			},
			{
				displayName: 'Bundle Discount Percent',
				name: 'bundleDiscountPercent',
				type: 'number',
				default: 0,
				description: 'Discount percent applied to the bundle',
			},
			{
				displayName: 'Bundle Discount Type',
				name: 'bundleDiscountType',
				type: 'options',
				default: 'percent',
				options: [
					{ name: 'Amount', value: 'amount' },
					{ name: 'Percent', value: 'percent' },
				],
			},
			{
				displayName: 'Currency',
				name: 'currency',
				type: 'options',
				default: 'USD',
				options: CURRENCY_OPTIONS,
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Description of the bundle',
			},
			{
				displayName: 'Show in Catalog',
				name: 'showInCatalog',
				type: 'boolean',
				default: false,
				description: 'Whether the bundle appears in the catalog',
			},
			{
				displayName: 'Show Items to End User',
				name: 'showItemsToEndUser',
				type: 'boolean',
				default: false,
				description: 'Whether individual bundle items are shown to the end user',
			},
			{
				displayName: 'SKU',
				name: 'sku',
				type: 'string',
				default: '',
				description: 'Stock keeping unit identifier',
			},
			{
				displayName: 'Sync With Products',
				name: 'syncWithProducts',
				type: 'boolean',
				default: false,
				description: 'Whether bundle item prices stay in sync with the underlying products',
			},
		],
	},

	// ===============================
	// Bundle: Update — Update Fields
	// ===============================
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: BUNDLE, operation: ['update'] },
		},
		options: [
			{
				displayName: 'Bundle Discount Amount',
				name: 'bundleDiscountAmount',
				type: 'number',
				default: 0,
				description: 'Fixed discount amount applied to the bundle',
			},
			{
				displayName: 'Bundle Discount Percent',
				name: 'bundleDiscountPercent',
				type: 'number',
				default: 0,
				description: 'Discount percent applied to the bundle',
			},
			{
				displayName: 'Bundle Discount Type',
				name: 'bundleDiscountType',
				type: 'options',
				default: 'percent',
				options: [
					{ name: 'Amount', value: 'amount' },
					{ name: 'Percent', value: 'percent' },
				],
			},
			{
				displayName: 'Category ID',
				name: 'categoryId',
				type: 'string',
				default: '',
				description: 'UUID of the bundle category',
			},
			{
				displayName: 'Currency',
				name: 'currency',
				type: 'options',
				default: 'USD',
				options: CURRENCY_OPTIONS,
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Description of the bundle',
			},
			{
				displayName: 'Items',
				name: 'items',
				type: 'json',
				default: '[]',
				description:
					'JSON array of bundle items. Each item: productId, unitPrice, billingFrequency, plus optional quantity, discountPercent, discountType, discountAmount, finalPrice, cost. Replaces existing items.',
				placeholder:
					'[{"productId":"prod-uuid","unitPrice":100,"billingFrequency":"one-time"}]',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Name of the bundle',
			},
			{
				displayName: 'Show in Catalog',
				name: 'showInCatalog',
				type: 'boolean',
				default: false,
				description: 'Whether the bundle appears in the catalog',
			},
			{
				displayName: 'Show Items to End User',
				name: 'showItemsToEndUser',
				type: 'boolean',
				default: false,
				description: 'Whether individual bundle items are shown to the end user',
			},
			{
				displayName: 'SKU',
				name: 'sku',
				type: 'string',
				default: '',
				description: 'Stock keeping unit identifier',
			},
			{
				displayName: 'Sync With Products',
				name: 'syncWithProducts',
				type: 'boolean',
				default: false,
				description: 'Whether bundle item prices stay in sync with the underlying products',
			},
		],
	},

	// ===============================
	// Bundle: Get Many
	// ===============================
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: { resource: BUNDLE, operation: ['list'] },
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: BUNDLE, operation: ['list'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: { resource: BUNDLE, operation: ['list'] },
		},
		options: [
			{
				displayName: 'Category IDs',
				name: 'categoryIds',
				type: 'string',
				default: '',
				description: 'Comma-separated list of category UUIDs to filter by',
			},
			{
				displayName: 'Currency',
				name: 'currency',
				type: 'options',
				default: 'USD',
				options: CURRENCY_OPTIONS,
			},
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				default: '',
				description: 'Filter bundles by name or SKU',
			},
			{
				displayName: 'Show in Catalog',
				name: 'showInCatalog',
				type: 'boolean',
				default: false,
				description: 'Whether to only return bundles shown in the catalog',
			},
		],
	},
];
