import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { turboDocxApiRequest, parseJsonParameter } from '../../shared/GenericFunctions';

/** Fixed webhook name baked into every signature-webhook path. */
const SIGNATURE = 'signature';

/** Page size used when "Return All" is enabled for delivery listing. */
const PAGE_SIZE = 100;

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
		if (updateFields.urls !== undefined && updateFields.urls !== '') {
			body.urls = parseJsonParameter(ctx, updateFields.urls as string, 'urls', i) as string[];
		}
		if (updateFields.events !== undefined) body.events = updateFields.events as string[];
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
		const returnAll = ctx.getNodeParameter('returnAll', i, false) as boolean;
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.eventType !== undefined && filters.eventType !== '') {
			baseQs.eventType = filters.eventType;
		}
		if (filters.isDelivered !== undefined) baseQs.isDelivered = filters.isDelivered;
		if (filters.httpStatus !== undefined) baseQs.httpStatus = filters.httpStatus;

		const out: INodeExecutionData[] = [];
		const endpoint = `/api/webhooks/${SIGNATURE}/deliveries`;

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
			const limit = ctx.getNodeParameter('limit', i, 50) as number;
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

	throw new Error(`Unknown Webhook operation: ${operation}`);
}
