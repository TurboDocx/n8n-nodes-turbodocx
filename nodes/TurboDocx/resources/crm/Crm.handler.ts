import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { turboDocxApiRequest, parseJsonParameter } from '../../shared/GenericFunctions';

/** Page size used when "Return All" is enabled. */
const PAGE_SIZE = 100;

/**
 * Paginate a TurboQuote-style list endpoint (`{ data: { results, totalRecords } }`).
 * Lists use `unwrap: 'smart'` so the handler reads `.results` off the unwrapped body.
 */
async function paginateList(
	ctx: IExecuteFunctions,
	endpoint: string,
	baseQs: IDataObject,
	returnAll: boolean,
	limit: number,
	i: number,
): Promise<INodeExecutionData[]> {
	const out: INodeExecutionData[] = [];

	if (returnAll) {
		let offset = 0;
		let total = Infinity;
		while (offset < total) {
			const page = await turboDocxApiRequest(
				ctx,
				{ method: 'GET', endpoint, qs: { ...baseQs, limit: PAGE_SIZE, offset }, unwrap: 'smart' },
				i,
			);
			const results = (page.results as IDataObject[]) ?? [];
			total = (page.totalRecords as number) ?? results.length;
			for (const r of results) out.push({ json: r });
			if (results.length === 0) break;
			offset += results.length;
		}
	} else {
		const page = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint, qs: { ...baseQs, limit, offset: 0 }, unwrap: 'smart' },
			i,
		);
		const results = (page.results as IDataObject[]) ?? [];
		for (const r of results) out.push({ json: r });
	}

	return out;
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
		const returnAll = ctx.getNodeParameter('returnAll', i, false) as boolean;
		const limit = ctx.getNodeParameter('limit', i, 50) as number;
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.query) baseQs.query = filters.query;
		if (filters.industryIds !== undefined && filters.industryIds !== '') {
			baseQs.industryIds = (filters.industryIds as string)
				.split(',')
				.map((s) => s.trim())
				.filter((s) => s !== '');
		}
		return paginateList(ctx, '/v1/companies', baseQs, returnAll, limit, i);
	}

	if (operation === 'listContacts') {
		const companyId = ctx.getNodeParameter('companyId', i) as string;
		const returnAll = ctx.getNodeParameter('returnAll', i, false) as boolean;
		const limit = ctx.getNodeParameter('limit', i, 50) as number;
		const filters = ctx.getNodeParameter('contactFilters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.query) baseQs.query = filters.query;
		return paginateList(ctx, `/v1/companies/${companyId}/contacts`, baseQs, returnAll, limit, i);
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

	throw new Error(`Unknown Company operation: ${operation}`);
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
		const returnAll = ctx.getNodeParameter('returnAll', i, false) as boolean;
		const limit = ctx.getNodeParameter('limit', i, 50) as number;
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.query) baseQs.query = filters.query;
		if (filters.companyId !== undefined && filters.companyId !== '')
			baseQs.companyId = filters.companyId;
		return paginateList(ctx, '/v1/contacts', baseQs, returnAll, limit, i);
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

	throw new Error(`Unknown Contact operation: ${operation}`);
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
		const returnAll = ctx.getNodeParameter('returnAll', i, false) as boolean;
		const limit = ctx.getNodeParameter('limit', i, 50) as number;
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.query) baseQs.query = filters.query;
		return paginateList(ctx, '/v1/quote-templates', baseQs, returnAll, limit, i);
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

	throw new Error(`Unknown Quote Template operation: ${operation}`);
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
		const returnAll = ctx.getNodeParameter('returnAll', i, false) as boolean;
		const limit = ctx.getNodeParameter('limit', i, 50) as number;
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.query) baseQs.query = filters.query;
		if (filters.categoryType !== undefined && filters.categoryType !== '')
			baseQs.categoryType = filters.categoryType;
		if (filters.includeUsage !== undefined) baseQs.includeUsage = filters.includeUsage;
		return paginateList(ctx, '/v1/types', baseQs, returnAll, limit, i);
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

	throw new Error(`Unknown Quote Type operation: ${operation}`);
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

	throw new Error(`Unknown CRM resource: ${resource}`);
}
