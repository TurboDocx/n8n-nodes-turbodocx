import { IExecuteFunctions, INodeExecutionData, IDataObject, NodeOperationError } from 'n8n-workflow';
import {
	turboDocxApiRequest,
	parseJsonParameter,
	paginatedList,
} from '../../shared/GenericFunctions';

/**
 * Paginate a TurboQuote-style list endpoint (`{ data: { results, totalRecords } }`).
 * Lists use `unwrap: 'smart'` so the handler reads `.results` off the unwrapped body.
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
 * Apply a nullable scalar from a collection to a PATCH body.
 * - key absent           → field omitted (user didn't touch it)
 * - value === ''         → send explicit `null` to clear the field
 * - otherwise            → send the value
 */
function applyNullableScalar(body: IDataObject, src: IDataObject, key: string): void {
	if (src[key] === undefined) return;
	body[key] = src[key] === '' ? null : src[key];
}

/** Apply a non-nullable scalar: include only when present and non-empty. */
function applyScalar(body: IDataObject, src: IDataObject, key: string): void {
	if (src[key] !== undefined && src[key] !== '') body[key] = src[key];
}

async function executeCompany(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'create') {
		const name = ctx.getNodeParameter('name', i) as string;
		const contacts = parseJsonParameter(
			ctx,
			ctx.getNodeParameter('contacts', i) as string,
			'contacts',
			i,
		);
		const additionalFields = ctx.getNodeParameter('additionalFields', i, {}) as IDataObject;

		const body: IDataObject = { name, contacts: contacts as IDataObject[] };
		if (additionalFields.phone !== undefined && additionalFields.phone !== '')
			body.phone = additionalFields.phone;
		if (additionalFields.city !== undefined && additionalFields.city !== '')
			body.city = additionalFields.city;
		if (additionalFields.state !== undefined && additionalFields.state !== '')
			body.state = additionalFields.state;
		if (additionalFields.country !== undefined && additionalFields.country !== '')
			body.country = additionalFields.country;
		if (additionalFields.industryId !== undefined && additionalFields.industryId !== '')
			body.industryId = additionalFields.industryId;

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: '/v1/companies', body, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'get') {
		const companyId = ctx.getNodeParameter('companyId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint: `/v1/companies/${companyId}`, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'list') {
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.query) baseQs.query = filters.query;
		if (filters.industryIds !== undefined && filters.industryIds !== '') {
			baseQs.industryIds = (filters.industryIds as string)
				.split(',')
				.map((s) => s.trim())
				.filter((s) => s !== '');
		}
		return paginateList(ctx, i, '/v1/companies', baseQs);
	}

	if (operation === 'listContacts') {
		const companyId = ctx.getNodeParameter('companyId', i) as string;
		const filters = ctx.getNodeParameter('contactFilters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.query) baseQs.query = filters.query;
		return paginateList(ctx, i, `/v1/companies/${companyId}/contacts`, baseQs);
	}

	if (operation === 'update') {
		const companyId = ctx.getNodeParameter('companyId', i) as string;
		const updateFields = ctx.getNodeParameter('updateFields', i, {}) as IDataObject;
		const body: IDataObject = {};
		applyScalar(body, updateFields, 'name');
		applyNullableScalar(body, updateFields, 'phone');
		applyNullableScalar(body, updateFields, 'city');
		applyNullableScalar(body, updateFields, 'state');
		applyNullableScalar(body, updateFields, 'country');
		applyNullableScalar(body, updateFields, 'industryId');

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'PATCH', endpoint: `/v1/companies/${companyId}`, body, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'delete') {
		const companyId = ctx.getNodeParameter('companyId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'DELETE', endpoint: `/v1/companies/${companyId}`, unwrap: 'smart' },
			i,
		);
		return [{ json: result }];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown Company operation: ${operation}`, { itemIndex: i });
}

async function executeContact(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'create') {
		const name = ctx.getNodeParameter('name', i) as string;
		const companyId = ctx.getNodeParameter('companyId', i) as string;
		const additionalFields = ctx.getNodeParameter('additionalFields', i, {}) as IDataObject;

		const body: IDataObject = { name, companyId };
		if (additionalFields.email !== undefined && additionalFields.email !== '')
			body.email = additionalFields.email;
		if (additionalFields.phone !== undefined && additionalFields.phone !== '')
			body.phone = additionalFields.phone;
		if (additionalFields.title !== undefined && additionalFields.title !== '')
			body.title = additionalFields.title;

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: '/v1/contacts', body, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'list') {
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.query) baseQs.query = filters.query;
		if (filters.companyId !== undefined && filters.companyId !== '')
			baseQs.companyId = filters.companyId;
		return paginateList(ctx, i, '/v1/contacts', baseQs);
	}

	if (operation === 'update') {
		const contactId = ctx.getNodeParameter('contactId', i) as string;
		const updateFields = ctx.getNodeParameter('updateFields', i, {}) as IDataObject;
		const body: IDataObject = {};
		applyScalar(body, updateFields, 'name');
		applyNullableScalar(body, updateFields, 'email');
		applyNullableScalar(body, updateFields, 'phone');
		applyNullableScalar(body, updateFields, 'title');

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'PATCH', endpoint: `/v1/contacts/${contactId}`, body, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'delete') {
		const contactId = ctx.getNodeParameter('contactId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'DELETE', endpoint: `/v1/contacts/${contactId}`, unwrap: 'smart' },
			i,
		);
		return [{ json: result }];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown Contact operation: ${operation}`, { itemIndex: i });
}

/** Keys accepted by the quote-template create/update body. */
const QUOTE_TEMPLATE_KEYS = [
	'logoUrl',
	'primaryColor',
	'primaryTextColor',
	'disclaimer',
	'termsAndConditions',
	'closingMessage',
	'senderName',
	'senderPhone',
	'senderEmail',
	'contactEmail',
];

async function executeQuoteTemplate(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'list') {
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.query) baseQs.query = filters.query;
		return paginateList(ctx, i, '/v1/quote-templates', baseQs);
	}

	if (operation === 'getDefault') {
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint: '/v1/quote-template', unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'get') {
		const quoteTemplateId = ctx.getNodeParameter('quoteTemplateId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint: `/v1/quote-templates/${quoteTemplateId}`, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'create') {
		const createFields = ctx.getNodeParameter('createFields', i, {}) as IDataObject;
		const body: IDataObject = {};
		for (const key of QUOTE_TEMPLATE_KEYS) applyScalar(body, createFields, key);

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: '/v1/quote-templates', body, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'update') {
		const quoteTemplateId = ctx.getNodeParameter('quoteTemplateId', i) as string;
		const updateFields = ctx.getNodeParameter('updateFields', i, {}) as IDataObject;
		const body: IDataObject = {};
		for (const key of QUOTE_TEMPLATE_KEYS) applyScalar(body, updateFields, key);

		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'PATCH',
				endpoint: `/v1/quote-templates/${quoteTemplateId}`,
				body,
				unwrap: 'result',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'delete') {
		const quoteTemplateId = ctx.getNodeParameter('quoteTemplateId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'DELETE', endpoint: `/v1/quote-templates/${quoteTemplateId}`, unwrap: 'smart' },
			i,
		);
		return [{ json: result }];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown Quote Template operation: ${operation}`, { itemIndex: i });
}

async function executeQuoteType(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'create') {
		const name = ctx.getNodeParameter('name', i) as string;
		const categoryType = ctx.getNodeParameter('categoryType', i) as string;
		const body: IDataObject = { name, categoryType };

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: '/v1/types', body, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'list') {
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.query) baseQs.query = filters.query;
		if (filters.categoryType !== undefined && filters.categoryType !== '')
			baseQs.categoryType = filters.categoryType;
		if (filters.includeUsage !== undefined) baseQs.includeUsage = filters.includeUsage;
		return paginateList(ctx, i, '/v1/types', baseQs);
	}

	if (operation === 'update') {
		const quoteTypeId = ctx.getNodeParameter('quoteTypeId', i) as string;
		const updateFields = ctx.getNodeParameter('updateFields', i, {}) as IDataObject;
		const body: IDataObject = {};
		applyScalar(body, updateFields, 'name');

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'PATCH', endpoint: `/v1/types/${quoteTypeId}`, body, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'delete') {
		const quoteTypeId = ctx.getNodeParameter('quoteTypeId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'DELETE', endpoint: `/v1/types/${quoteTypeId}`, unwrap: 'smart' },
			i,
		);
		return [{ json: result }];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown Quote Type operation: ${operation}`, { itemIndex: i });
}

export async function executeCrm(
	ctx: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	if (resource === 'company') return executeCompany(ctx, operation, i);
	if (resource === 'contact') return executeContact(ctx, operation, i);
	if (resource === 'quoteTemplate') return executeQuoteTemplate(ctx, operation, i);
	if (resource === 'quoteType') return executeQuoteType(ctx, operation, i);

	throw new NodeOperationError(ctx.getNode(), `Unknown CRM resource: ${resource}`, { itemIndex: i });
}
