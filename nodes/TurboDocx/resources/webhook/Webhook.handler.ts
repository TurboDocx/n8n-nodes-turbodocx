import { IExecuteFunctions, INodeExecutionData, IDataObject, NodeOperationError } from 'n8n-workflow';
import {
	turboDocxApiRequest,
	parseJsonParameter,
	paginatedList,
} from '../../shared/GenericFunctions';

/** Fixed webhook name baked into every signature-webhook path. */
const SIGNATURE = 'signature';

export async function executeWebhook(
	ctx: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'create') {
		const urls = parseJsonParameter(
			ctx,
			ctx.getNodeParameter('urls', i) as string,
			'urls',
			i,
		) as string[];
		const events = ctx.getNodeParameter('events', i, []) as string[];

		const body: IDataObject = { name: SIGNATURE, urls, events };
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: '/api/webhooks', body, unwrap: 'data' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'get') {
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint: `/api/webhooks/${SIGNATURE}`, unwrap: 'smart' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'update') {
		const updateFields = ctx.getNodeParameter('updateFields', i, {}) as IDataObject;
		const body: IDataObject = {};

		// The backend requires `.min(1)` on both arrays, so an EMPTY one is a 400 rather than a
		// no-op. Adding the field in the UI and leaving it untouched yields `[]` — omit that
		// instead of forwarding it, so an untouched field means "don't change this".
		if (updateFields.urls !== undefined && updateFields.urls !== '') {
			const urls = parseJsonParameter(ctx, updateFields.urls as string, 'urls', i) as string[];
			if (Array.isArray(urls) && urls.length > 0) body.urls = urls;
		}
		if (Array.isArray(updateFields.events) && updateFields.events.length > 0) {
			body.events = updateFields.events as string[];
		}
		if (updateFields.isActive !== undefined) body.isActive = updateFields.isActive;

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'PATCH', endpoint: `/api/webhooks/${SIGNATURE}`, body, unwrap: 'data' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'delete') {
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'DELETE', endpoint: `/api/webhooks/${SIGNATURE}`, unwrap: 'smart' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'test' || operation === 'notify') {
		const eventType = ctx.getNodeParameter('eventType', i) as string;
		const payload = parseJsonParameter(
			ctx,
			ctx.getNodeParameter('payload', i, '{}') as string,
			'payload',
			i,
		) as IDataObject;

		const endpoint =
			operation === 'test'
				? `/api/webhooks/${SIGNATURE}/test`
				: `/api/webhooks/${SIGNATURE}/notify`;
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint,
				body: { eventType, payload: payload ?? {} },
				unwrap: 'data',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'regenerateSecret') {
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: `/api/webhooks/${SIGNATURE}/regenerate`, unwrap: 'data' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'replayDelivery') {
		const deliveryId = ctx.getNodeParameter('deliveryId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: `/api/webhooks/${SIGNATURE}/replay`,
				body: { deliveryId },
				unwrap: 'data',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'listDeliveries') {
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.eventType !== undefined && filters.eventType !== '') {
			baseQs.eventType = filters.eventType;
		}
		if (filters.isDelivered !== undefined) baseQs.isDelivered = filters.isDelivered;
		if (filters.httpStatus !== undefined) baseQs.httpStatus = filters.httpStatus;

		const endpoint = `/api/webhooks/${SIGNATURE}/deliveries`;
		const records = await paginatedList(ctx, { endpoint, i, baseQs });
		return records.map((r) => ({ json: r }));
	}

	if (operation === 'getStats') {
		const options = ctx.getNodeParameter('options', i, {}) as IDataObject;
		const qs: IDataObject = {};
		if (options.days !== undefined) qs.days = options.days;

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint: `/api/webhooks/${SIGNATURE}/stats`, qs, unwrap: 'smart' },
			i,
		);
		return [{ json: result }];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown Webhook operation: ${operation}`, { itemIndex: i });
}
