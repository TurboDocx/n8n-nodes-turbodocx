import { IExecuteFunctions, INodeExecutionData, IDataObject, NodeOperationError } from 'n8n-workflow';
import {
	turboDocxApiRequest,
	turboDocxApiRequestBinary,
	parseJsonParameter,
	detectBinaryType,
	paginatedList,
} from '../../shared/GenericFunctions';

export async function executeDeliverable(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'generate') {
		const name = ctx.getNodeParameter('name', i) as string;
		const templateId = ctx.getNodeParameter('templateId', i) as string;
		const variables = parseJsonParameter(
			ctx,
			ctx.getNodeParameter('variables', i) as string,
			'variables',
			i,
		);
		const additionalFields = ctx.getNodeParameter('additionalFields', i, {}) as IDataObject;

		const body: IDataObject = { name, templateId, variables: variables as IDataObject[] };
		if (additionalFields.description) body.description = additionalFields.description;
		if (additionalFields.tags !== undefined && additionalFields.tags !== '') {
			body.tags = parseJsonParameter(ctx, additionalFields.tags as string, 'tags', i) as string[];
		}

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: '/v1/deliverable', body, unwrap: 'smart' },
			i,
		);
		// Backend returns { results: { deliverable: <record> } } after smart-unwrap;
		// peel both wrappers so the item matches the flat shape of `get`.
		const inner = (result.results as IDataObject) ?? result;
		const record = (inner.deliverable as IDataObject) ?? inner;
		return [{ json: record }];
	}

	if (operation === 'get') {
		const deliverableId = ctx.getNodeParameter('deliverableId', i) as string;
		const options = ctx.getNodeParameter('options', i, {}) as IDataObject;
		const qs: IDataObject = {};
		if (options.showTags !== undefined) qs.showTags = options.showTags;

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint: `/v1/deliverable/${deliverableId}`, qs, unwrap: 'smart' },
			i,
		);
		// getDeliverableDetails unwraps the `{ results: record }` envelope
		const record = (result.results as IDataObject) ?? result;
		return [{ json: record }];
	}

	if (operation === 'list') {
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.query) baseQs.query = filters.query;
		if (filters.showTags !== undefined) baseQs.showTags = filters.showTags;

		const records = await paginatedList(ctx, { endpoint: '/v1/deliverable', i, baseQs });
		return records.map((r) => ({ json: r }));
	}

	if (operation === 'update') {
		const deliverableId = ctx.getNodeParameter('deliverableId', i) as string;
		const updateFields = ctx.getNodeParameter('updateFields', i, {}) as IDataObject;
		const body: IDataObject = {};
		if (updateFields.name !== undefined && updateFields.name !== '') body.name = updateFields.name;
		if (updateFields.description !== undefined) body.description = updateFields.description;
		if (updateFields.tags !== undefined && updateFields.tags !== '') {
			body.tags = parseJsonParameter(ctx, updateFields.tags as string, 'tags', i) as string[];
		}

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'PATCH', endpoint: `/v1/deliverable/${deliverableId}`, body, unwrap: 'smart' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'delete') {
		const deliverableId = ctx.getNodeParameter('deliverableId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'DELETE', endpoint: `/v1/deliverable/${deliverableId}`, unwrap: 'smart' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'downloadPdf' || operation === 'downloadSource') {
		const deliverableId = ctx.getNodeParameter('deliverableId', i) as string;
		const endpoint =
			operation === 'downloadPdf'
				? `/v1/deliverable/file/pdf/${deliverableId}`
				: `/v1/deliverable/file/${deliverableId}`;
		const buffer = await turboDocxApiRequestBinary(ctx, { method: 'GET', endpoint }, i);

		const detected =
			operation === 'downloadPdf'
				? { extension: 'pdf', mimeType: 'application/pdf' }
				: detectBinaryType(buffer);
		const binaryData = await ctx.helpers.prepareBinaryData(
			buffer,
			`deliverable-${deliverableId}.${detected.extension}`,
			detected.mimeType,
		);
		return [
			{
				json: { deliverableId },
				binary: { data: binaryData },
			},
		];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown Deliverable operation: ${operation}`, { itemIndex: i });
}
