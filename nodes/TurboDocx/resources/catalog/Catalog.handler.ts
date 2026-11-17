import { IExecuteFunctions, INodeExecutionData, IDataObject, NodeOperationError } from 'n8n-workflow';
import {
	turboDocxApiRequest,
	parseJsonParameter,
	paginatedList,
} from '../../shared/GenericFunctions';
import {
	applySort,
	collectImageParts,
	duplicateBody,
	oneOrMany,
	splitCsv,
} from '../../shared/turboQuoteOptions';

/**
 * Paginate a list endpoint that returns `{ results, totalRecords }` (after smart
 * unwrap). Honours Return All / Limit and forwards the provided base query.
 */
async function paginateList(
	ctx: IExecuteFunctions,
	i: number,
	endpoint: string,
	baseQs: IDataObject,
): Promise<INodeExecutionData[]> {
	const records = await paginatedList(ctx, { endpoint, i, baseQs });
	return records.map((r) => ({ json: r }));
}

/**
 * Shared handler for a `/bulk` create endpoint. Parses the `rows` JSON param,
 * POSTs `{ rows }`, and returns the single BulkImportResult summary object.
 * The bulk endpoints return a PLURAL `{ results: BulkImportResult }` envelope,
 * so we unwrap 'smart' and read `.results` manually (not a fan-out).
 */
async function bulkCreate(
	ctx: IExecuteFunctions,
	i: number,
	endpoint: string,
): Promise<INodeExecutionData[]> {
	const rows = parseJsonParameter(
		ctx,
		ctx.getNodeParameter('rows', i, '[]') as string,
		'rows',
		i,
	) as IDataObject[];
	const body = await turboDocxApiRequest(
		ctx,
		{ method: 'POST', endpoint, body: { rows }, unwrap: 'smart' },
		i,
	);
	return [{ json: (body.results as IDataObject) ?? body }];
}

// =====================================================================================
// PRODUCT
// =====================================================================================

async function executeProduct(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'list') {
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.query) baseQs.query = filters.query;
		const billingFrequency = oneOrMany(filters.billingFrequency, filters.billingFrequencies);
		if (billingFrequency) baseQs.billingFrequency = billingFrequency;
		const currency = oneOrMany(filters.currency, filters.currencies);
		if (currency) baseQs.currency = currency;
		if (filters.showInCatalog !== undefined) baseQs.showInCatalog = filters.showInCatalog;
		if (filters.categoryIds) baseQs.categoryIds = splitCsv(filters.categoryIds as string);
		applySort(ctx, i, baseQs);
		return paginateList(ctx, i, '/v1/products', baseQs);
	}

	if (operation === 'bulkCreate') {
		return bulkCreate(ctx, i, '/v1/products/bulk');
	}

	if (operation === 'get') {
		const productId = ctx.getNodeParameter('productId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint: `/v1/products/${productId}`, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'create') {
		const name = ctx.getNodeParameter('name', i) as string;
		const listPrice = ctx.getNodeParameter('listPrice', i) as number;
		const billingFrequency = ctx.getNodeParameter('billingFrequency', i) as string;
		const categoryId = ctx.getNodeParameter('categoryId', i) as string;
		const additionalFields = ctx.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const imageBinaryProperty = ctx.getNodeParameter('imageBinaryProperty', i, '') as string;

		const dataFields: IDataObject = { name, listPrice, billingFrequency, categoryId };
		if (additionalFields.sku !== undefined && additionalFields.sku !== '')
			dataFields.sku = additionalFields.sku;
		if (additionalFields.description !== undefined && additionalFields.description !== '')
			dataFields.description = additionalFields.description;
		if (
			additionalFields.detailedSpecification !== undefined &&
			additionalFields.detailedSpecification !== ''
		)
			dataFields.detailedSpecification = additionalFields.detailedSpecification;
		if (additionalFields.internalNotes !== undefined && additionalFields.internalNotes !== '')
			dataFields.internalNotes = additionalFields.internalNotes;
		if (additionalFields.cost !== undefined) dataFields.cost = additionalFields.cost;
		if (additionalFields.minimumOrderQuantity !== undefined)
			dataFields.minimumOrderQuantity = additionalFields.minimumOrderQuantity;
		if (additionalFields.currency !== undefined) dataFields.currency = additionalFields.currency;
		if (additionalFields.showInCatalog !== undefined)
			dataFields.showInCatalog = additionalFields.showInCatalog;

		const binaryPropertyNames = splitCsv(imageBinaryProperty);
		if (binaryPropertyNames.length > 0) {
			const images = await collectImageParts(ctx, i, binaryPropertyNames, 'product');
			const body: IDataObject = { data: JSON.stringify(dataFields), images };
			const result = await turboDocxApiRequest(
				ctx,
				{ method: 'POST', endpoint: '/v1/products', body, multipart: true, unwrap: 'result' },
				i,
			);
			return [{ json: result }];
		}

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: '/v1/products', body: dataFields, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'update') {
		const productId = ctx.getNodeParameter('productId', i) as string;
		const updateFields = ctx.getNodeParameter('updateFields', i, {}) as IDataObject;
		const imageBinaryProperty = ctx.getNodeParameter('imageBinaryProperty', i, '') as string;

		const dataFields: IDataObject = {};
		if (updateFields.name !== undefined && updateFields.name !== '')
			dataFields.name = updateFields.name;
		if (updateFields.listPrice !== undefined) dataFields.listPrice = updateFields.listPrice;
		if (updateFields.billingFrequency !== undefined)
			dataFields.billingFrequency = updateFields.billingFrequency;
		if (updateFields.sku !== undefined && updateFields.sku !== '')
			dataFields.sku = updateFields.sku;
		if (updateFields.description !== undefined && updateFields.description !== '')
			dataFields.description = updateFields.description;
		if (
			updateFields.detailedSpecification !== undefined &&
			updateFields.detailedSpecification !== ''
		)
			dataFields.detailedSpecification = updateFields.detailedSpecification;
		if (updateFields.internalNotes !== undefined && updateFields.internalNotes !== '')
			dataFields.internalNotes = updateFields.internalNotes;
		if (updateFields.categoryId !== undefined && updateFields.categoryId !== '')
			dataFields.categoryId = updateFields.categoryId;
		if (updateFields.cost !== undefined) dataFields.cost = updateFields.cost;
		if (updateFields.minimumOrderQuantity !== undefined)
			dataFields.minimumOrderQuantity = updateFields.minimumOrderQuantity;
		if (updateFields.currency !== undefined) dataFields.currency = updateFields.currency;
		if (updateFields.showInCatalog !== undefined)
			dataFields.showInCatalog = updateFields.showInCatalog;
		if (updateFields.imageIdsToKeep !== undefined && updateFields.imageIdsToKeep !== '')
			dataFields.imageIdsToKeep = parseJsonParameter(
				ctx,
				updateFields.imageIdsToKeep as string,
				'imageIdsToKeep',
				i,
			) as string[];
		if (updateFields.imageOrder !== undefined && updateFields.imageOrder !== '')
			dataFields.imageOrder = parseJsonParameter(
				ctx,
				updateFields.imageOrder as string,
				'imageOrder',
				i,
			) as string[];

		const binaryPropertyNames = splitCsv(imageBinaryProperty);
		if (binaryPropertyNames.length > 0) {
			const images = await collectImageParts(ctx, i, binaryPropertyNames, 'product');
			const body: IDataObject = { data: JSON.stringify(dataFields), images };
			const result = await turboDocxApiRequest(
				ctx,
				{
					method: 'PATCH',
					endpoint: `/v1/products/${productId}`,
					body,
					multipart: true,
					unwrap: 'result',
				},
				i,
			);
			return [{ json: result }];
		}

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'PATCH', endpoint: `/v1/products/${productId}`, body: dataFields, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'delete') {
		const productId = ctx.getNodeParameter('productId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'DELETE', endpoint: `/v1/products/${productId}`, unwrap: 'smart' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'duplicate') {
		const productId = ctx.getNodeParameter('productId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: `/v1/products/${productId}/duplicate`,
				body: duplicateBody(ctx, i),
				unwrap: 'result',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'primaryImages') {
		const productIds = parseJsonParameter(
			ctx,
			ctx.getNodeParameter('productIds', i) as string,
			'productIds',
			i,
		) as string[];
		// POST /v1/products/primary-images -> { results: { [productId]: image | null } }
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: '/v1/products/primary-images',
				body: { productIds },
				unwrap: 'smart',
			},
			i,
		);
		const map = (result.results as IDataObject) ?? result;
		return [{ json: map }];
	}

	if (operation === 'quoteImages') {
		const productIds = parseJsonParameter(
			ctx,
			ctx.getNodeParameter('productIds', i) as string,
			'productIds',
			i,
		) as string[];
		// POST /v1/products/quote-images -> { results: { [productId]: image[] } } (up to three each)
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: '/v1/products/quote-images',
				body: { productIds },
				unwrap: 'smart',
			},
			i,
		);
		const map = (result.results as IDataObject) ?? result;
		return [{ json: map }];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown Product operation: ${operation}`, { itemIndex: i });
}

// =====================================================================================
// PRICE BOOK
// =====================================================================================

async function executePriceBook(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'list') {
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.query) baseQs.query = filters.query;
		if (filters.showInQuoteBuilder !== undefined)
			baseQs.showInQuoteBuilder = filters.showInQuoteBuilder;
		if (filters.priceBookTypeIds)
			baseQs.priceBookTypeIds = splitCsv(filters.priceBookTypeIds as string);
		applySort(ctx, i, baseQs);
		return paginateList(ctx, i, '/v1/pricebooks', baseQs);
	}

	if (operation === 'listProducts') {
		const priceBookId = ctx.getNodeParameter('priceBookId', i) as string;
		const filters = ctx.getNodeParameter('listProductsFilters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.query) baseQs.query = filters.query;
		if (filters.categoryIds) baseQs.categoryIds = splitCsv(filters.categoryIds as string);
		return paginateList(ctx, i, `/v1/pricebooks/${priceBookId}/products`, baseQs);
	}

	if (operation === 'bulkCreate') {
		return bulkCreate(ctx, i, '/v1/pricebooks/bulk');
	}

	if (operation === 'get') {
		const priceBookId = ctx.getNodeParameter('priceBookId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint: `/v1/pricebooks/${priceBookId}`, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'create') {
		const name = ctx.getNodeParameter('name', i) as string;
		const priceBookTypeId = ctx.getNodeParameter('priceBookTypeId', i) as string;
		const validFrom = ctx.getNodeParameter('validFrom', i) as string;
		const additionalFields = ctx.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const productPricingRaw = ctx.getNodeParameter('productPricing', i, '') as string;

		const body: IDataObject = {
			name,
			priceBookTypeId,
			validFrom,
			// Backend requires discountPercent on POST even though it documents a default of 0.
			discountPercent:
				additionalFields.discountPercent !== undefined
					? additionalFields.discountPercent
					: 0,
		};
		if (additionalFields.description !== undefined && additionalFields.description !== '')
			body.description = additionalFields.description;
		if (additionalFields.validTo !== undefined && additionalFields.validTo !== '')
			body.validTo = additionalFields.validTo;
		if (additionalFields.isDefault !== undefined) body.isDefault = additionalFields.isDefault;
		if (additionalFields.showInQuoteBuilder !== undefined)
			body.showInQuoteBuilder = additionalFields.showInQuoteBuilder;
		if (productPricingRaw !== undefined && productPricingRaw !== '' && productPricingRaw !== '[]') {
			body.productPricing = parseJsonParameter(
				ctx,
				productPricingRaw,
				'productPricing',
				i,
			) as IDataObject[];
		}

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: '/v1/pricebooks', body, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'update') {
		const priceBookId = ctx.getNodeParameter('priceBookId', i) as string;
		const updateFields = ctx.getNodeParameter('updateFields', i, {}) as IDataObject;

		const body: IDataObject = {};
		if (updateFields.name !== undefined && updateFields.name !== '') body.name = updateFields.name;
		if (updateFields.priceBookTypeId !== undefined && updateFields.priceBookTypeId !== '')
			body.priceBookTypeId = updateFields.priceBookTypeId;
		if (updateFields.description !== undefined && updateFields.description !== '')
			body.description = updateFields.description;
		if (updateFields.discountPercent !== undefined)
			body.discountPercent = updateFields.discountPercent;
		if (updateFields.validFrom !== undefined && updateFields.validFrom !== '')
			body.validFrom = updateFields.validFrom;
		if (updateFields.validTo !== undefined && updateFields.validTo !== '')
			body.validTo = updateFields.validTo;
		if (updateFields.isDefault !== undefined) body.isDefault = updateFields.isDefault;
		if (updateFields.showInQuoteBuilder !== undefined)
			body.showInQuoteBuilder = updateFields.showInQuoteBuilder;
		// Puts every product back on the book's discount (before any productPricing in this request)
		if (updateFields.resetProductPricing === true) body.resetProductPricing = true;
		if (
			updateFields.productPricing !== undefined &&
			updateFields.productPricing !== '' &&
			updateFields.productPricing !== '[]'
		) {
			body.productPricing = parseJsonParameter(
				ctx,
				updateFields.productPricing as string,
				'productPricing',
				i,
			) as IDataObject[];
		}

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'PATCH', endpoint: `/v1/pricebooks/${priceBookId}`, body, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'delete') {
		const priceBookId = ctx.getNodeParameter('priceBookId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'DELETE', endpoint: `/v1/pricebooks/${priceBookId}`, unwrap: 'smart' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'duplicate') {
		const priceBookId = ctx.getNodeParameter('priceBookId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: `/v1/pricebooks/${priceBookId}/duplicate`,
				body: duplicateBody(ctx, i),
				unwrap: 'result',
			},
			i,
		);
		return [{ json: result }];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown Price Book operation: ${operation}`, { itemIndex: i });
}

// =====================================================================================
// BUNDLE
// =====================================================================================

async function executeBundle(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'list') {
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.query) baseQs.query = filters.query;
		const currency = oneOrMany(filters.currency, filters.currencies);
		if (currency) baseQs.currency = currency;
		if (filters.showInCatalog !== undefined) baseQs.showInCatalog = filters.showInCatalog;
		if (filters.categoryIds) baseQs.categoryIds = splitCsv(filters.categoryIds as string);
		applySort(ctx, i, baseQs);
		return paginateList(ctx, i, '/v1/bundles', baseQs);
	}

	if (operation === 'bulkCreate') {
		return bulkCreate(ctx, i, '/v1/bundles/bulk');
	}

	if (operation === 'get') {
		const bundleId = ctx.getNodeParameter('bundleId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint: `/v1/bundles/${bundleId}`, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'create') {
		const name = ctx.getNodeParameter('name', i) as string;
		const categoryId = ctx.getNodeParameter('categoryId', i) as string;
		const additionalFields = ctx.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const itemsRaw = ctx.getNodeParameter('items', i, '') as string;

		const body: IDataObject = { name, categoryId };
		if (additionalFields.description !== undefined && additionalFields.description !== '')
			body.description = additionalFields.description;
		if (additionalFields.sku !== undefined && additionalFields.sku !== '')
			body.sku = additionalFields.sku;
		if (additionalFields.bundleDiscountPercent !== undefined)
			body.bundleDiscountPercent = additionalFields.bundleDiscountPercent;
		if (additionalFields.bundleDiscountType !== undefined)
			body.bundleDiscountType = additionalFields.bundleDiscountType;
		if (additionalFields.bundleDiscountAmount !== undefined)
			body.bundleDiscountAmount = additionalFields.bundleDiscountAmount;
		if (additionalFields.currency !== undefined) body.currency = additionalFields.currency;
		if (additionalFields.showItemsToEndUser !== undefined)
			body.showItemsToEndUser = additionalFields.showItemsToEndUser;
		if (additionalFields.showInCatalog !== undefined)
			body.showInCatalog = additionalFields.showInCatalog;
		if (additionalFields.syncWithProducts !== undefined)
			body.syncWithProducts = additionalFields.syncWithProducts;
		if (itemsRaw !== undefined && itemsRaw !== '' && itemsRaw !== '[]') {
			body.items = parseJsonParameter(ctx, itemsRaw, 'items', i) as IDataObject[];
		}

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: '/v1/bundles', body, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'update') {
		const bundleId = ctx.getNodeParameter('bundleId', i) as string;
		const updateFields = ctx.getNodeParameter('updateFields', i, {}) as IDataObject;

		const body: IDataObject = {};
		if (updateFields.name !== undefined && updateFields.name !== '') body.name = updateFields.name;
		if (updateFields.categoryId !== undefined && updateFields.categoryId !== '')
			body.categoryId = updateFields.categoryId;
		if (updateFields.description !== undefined && updateFields.description !== '')
			body.description = updateFields.description;
		if (updateFields.sku !== undefined && updateFields.sku !== '') body.sku = updateFields.sku;
		if (updateFields.bundleDiscountPercent !== undefined)
			body.bundleDiscountPercent = updateFields.bundleDiscountPercent;
		if (updateFields.bundleDiscountType !== undefined)
			body.bundleDiscountType = updateFields.bundleDiscountType;
		if (updateFields.bundleDiscountAmount !== undefined)
			body.bundleDiscountAmount = updateFields.bundleDiscountAmount;
		if (updateFields.currency !== undefined) body.currency = updateFields.currency;
		if (updateFields.showItemsToEndUser !== undefined)
			body.showItemsToEndUser = updateFields.showItemsToEndUser;
		if (updateFields.showInCatalog !== undefined)
			body.showInCatalog = updateFields.showInCatalog;
		if (updateFields.syncWithProducts !== undefined)
			body.syncWithProducts = updateFields.syncWithProducts;
		if (
			updateFields.items !== undefined &&
			updateFields.items !== '' &&
			updateFields.items !== '[]'
		) {
			body.items = parseJsonParameter(ctx, updateFields.items as string, 'items', i) as IDataObject[];
		}

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'PATCH', endpoint: `/v1/bundles/${bundleId}`, body, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'delete') {
		const bundleId = ctx.getNodeParameter('bundleId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'DELETE', endpoint: `/v1/bundles/${bundleId}`, unwrap: 'smart' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'duplicate') {
		const bundleId = ctx.getNodeParameter('bundleId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: `/v1/bundles/${bundleId}/duplicate`,
				body: duplicateBody(ctx, i),
				unwrap: 'result',
			},
			i,
		);
		return [{ json: result }];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown Bundle operation: ${operation}`, { itemIndex: i });
}

// =====================================================================================
// ENTRY POINT
// =====================================================================================

export async function executeCatalog(
	ctx: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	if (resource === 'product') return executeProduct(ctx, operation, i);
	if (resource === 'priceBook') return executePriceBook(ctx, operation, i);
	if (resource === 'bundle') return executeBundle(ctx, operation, i);
	throw new NodeOperationError(ctx.getNode(), `Unknown Catalog resource: ${resource}`, { itemIndex: i });
}
