import { IExecuteFunctions, INodeExecutionData, IDataObject, NodeOperationError } from 'n8n-workflow';
import {
	turboDocxApiRequest,
	turboDocxApiRequestBinary,
	parseJsonParameter,
	paginatedList,
} from '../../shared/GenericFunctions';

/**
 * `renewalPeriod` is coupled to `termDays`: the backend's quote schemas accept it only for an
 * auto-renewal term (`termDays === -1`) and demand `null` otherwise, so a mismatched pair is a
 * 400. Both fields are optional collection entries, so the user typed the renewal period on
 * purpose — dropping it silently would send a quote with terms they did not ask for. Fail loudly
 * with the fix instead.
 */
function assertRenewalPeriodMatchesTerm(
	ctx: IExecuteFunctions,
	fields: IDataObject,
	i: number,
	collectionName: string,
): void {
	if (!fields.renewalPeriod || fields.termDays === -1) return;
	throw new NodeOperationError(
		ctx.getNode(),
		`Renewal Period only applies to auto-renewing quotes. Add Term Days to ${collectionName} and set it to -1, or remove Renewal Period.\n\nHTTP Status: 400`,
		{ itemIndex: i },
	);
}

/** Split a comma/space separated email string into a trimmed array. */
function parseCcEmails(raw: string): string[] {
	return raw
		.split(',')
		.map((e) => e.trim())
		.filter((e) => e !== '');
}

/**
 * Per-quote reminder/expiration schedule collected on the Send / Send With Deliverable operations.
 * Every property is optional: because it is a `collection` option, a field reads `undefined` until
 * the user adds it, which distinguishes "inherit the org default" from a deliberately-set value
 * (including a meaningful `maxReminders` of 0 or -1, or `expirationWarning` of 0). Durations are
 * captured as a numeric value + an 'hours'/'days' unit and re-assembled into `{ value, unit }`.
 */
interface IQuoteScheduleFields {
	remindersEnabled?: boolean;
	maxReminders?: number;
	reminderDelayValue?: number;
	reminderDelayUnit?: string;
	reminderIntervalValue?: number;
	reminderIntervalUnit?: string;
	expirationEnabled?: boolean;
	expireAfterValue?: number;
	expireAfterUnit?: string;
	expirationWarningValue?: number;
	expirationWarningUnit?: string;
	expirationWarningIntervalValue?: number;
	expirationWarningIntervalUnit?: string;
}

/**
 * Append a schedule Duration to the quote's JSON body as a native `{ value, unit }` OBJECT (the
 * quote-send endpoints are application/json, unlike the multipart signature-send path — so no
 * JSON.stringify here). Only emitted when the user actually supplied a value.
 *
 * `allowZero` mirrors the backend's per-field rule: every window must be positive EXCEPT
 * `expirationWarning`, where 0 is meaningful ("never warn"). A 0 on any other duration is a
 * degenerate window and is dropped rather than sent.
 */
function appendQuoteDuration(
	body: IDataObject,
	key: 'reminderDelay' | 'reminderInterval' | 'expireAfter' | 'expirationWarning' | 'expirationWarningInterval',
	value: number | undefined,
	unit: string | undefined,
	allowZero = false,
): void {
	if (typeof value !== 'number') return;
	if (value < 0) return;
	if (value === 0 && !allowZero) return;
	body[key] = { value, unit: unit ?? 'days' };
}

/**
 * Merge the optional quote-send reminder/expiration schedule into a JSON send body. Native types
 * throughout: booleans as booleans, `maxReminders` as a number, durations as `{ value, unit }`
 * objects. Each field is added only when the user set it, so anything left unset inherits the org
 * default. Quote-specific constraint: expiry is pinned to the quote's `validUntil`, so the backend
 * ignores `expireAfter` when expiration is on; `expirationEnabled` still applies per quote, and the
 * reminder/warning cadence must fit inside `validUntil` or the send is rejected with a 400.
 */
function applyQuoteSchedule(ctx: IExecuteFunctions, body: IDataObject, i: number): void {
	const schedule = ctx.getNodeParameter('signatureSchedule', i, {}) as IQuoteScheduleFields;

	if (schedule.remindersEnabled !== undefined) body.remindersEnabled = schedule.remindersEnabled;
	if (schedule.maxReminders !== undefined) body.maxReminders = schedule.maxReminders;
	appendQuoteDuration(body, 'reminderDelay', schedule.reminderDelayValue, schedule.reminderDelayUnit);
	appendQuoteDuration(
		body,
		'reminderInterval',
		schedule.reminderIntervalValue,
		schedule.reminderIntervalUnit,
	);

	if (schedule.expirationEnabled !== undefined) body.expirationEnabled = schedule.expirationEnabled;
	// expireAfter is ignored by the quote backend (expiry follows validUntil) but is forwarded for
	// parity; expirationWarning permits 0 ("never warn"), the only duration accepted as zero.
	appendQuoteDuration(body, 'expireAfter', schedule.expireAfterValue, schedule.expireAfterUnit);
	appendQuoteDuration(
		body,
		'expirationWarning',
		schedule.expirationWarningValue,
		schedule.expirationWarningUnit,
		true,
	);
	appendQuoteDuration(
		body,
		'expirationWarningInterval',
		schedule.expirationWarningIntervalValue,
		schedule.expirationWarningIntervalUnit,
	);
}

// ===================================================================
// Quote resource
// ===================================================================

async function executeQuoteResource(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'create') {
		const name = ctx.getNodeParameter('name', i) as string;
		const companyId = ctx.getNodeParameter('companyId', i) as string;
		const contactId = ctx.getNodeParameter('contactId', i) as string;
		const additionalFields = ctx.getNodeParameter('additionalFields', i, {}) as IDataObject;

		assertRenewalPeriodMatchesTerm(ctx, additionalFields, i, 'Additional Fields');

		const body: IDataObject = { name, companyId, contactId };
		if (additionalFields.currency) body.currency = additionalFields.currency;
		if (additionalFields.termDays !== undefined) body.termDays = additionalFields.termDays;
		if (additionalFields.renewalPeriod) body.renewalPeriod = additionalFields.renewalPeriod;
		if (additionalFields.validUntil) body.validUntil = additionalFields.validUntil;
		if (additionalFields.taxRate !== undefined) body.taxRate = additionalFields.taxRate;
		if (additionalFields.priceBookId) body.priceBookId = additionalFields.priceBookId;

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: '/v1/quotes', body, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'get') {
		const quoteId = ctx.getNodeParameter('quoteId', i) as string;
		// This endpoint returns `{ result, statusInfo, preparedBy }` — `statusInfo` and
		// `preparedBy` are SIBLINGS of `result`, so unwrap: 'result' would drop them entirely.
		// Unwrap the `{ data }` layer only, then merge, mirroring the SDK's getQuote.
		// `preparedBy` is the resolved "Prepared by" identity ({ name, email }) shown on the
		// quote PDF; prefer it over `creator` (which may be the internal API service account).
		const body = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint: `/v1/quotes/${quoteId}`, unwrap: 'smart' },
			i,
		);
		const quote = (body.result as IDataObject) ?? body;
		if (body.statusInfo !== undefined) quote.statusInfo = body.statusInfo;
		if (body.preparedBy !== undefined) quote.preparedBy = body.preparedBy;
		return [{ json: quote }];
	}

	if (operation === 'list') {
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.query) baseQs.query = filters.query;
		if (filters.companyId) baseQs.companyId = filters.companyId;
		if (filters.contactId) baseQs.contactId = filters.contactId;
		if (filters.currency) baseQs.currency = filters.currency;
		if (Array.isArray(filters.statuses) && filters.statuses.length > 0) {
			baseQs.statuses = filters.statuses;
		}

		const records = await paginatedList(ctx, { endpoint: '/v1/quotes', i, baseQs });
		return records.map((r) => ({ json: r }));
	}

	if (operation === 'update') {
		const quoteId = ctx.getNodeParameter('quoteId', i) as string;
		const updateFields = ctx.getNodeParameter('updateFields', i, {}) as IDataObject;
		const body: IDataObject = {};

		if (updateFields.name !== undefined && updateFields.name !== '') body.name = updateFields.name;
		if (updateFields.companyId !== undefined && updateFields.companyId !== '')
			body.companyId = updateFields.companyId;
		if (updateFields.contactId !== undefined && updateFields.contactId !== '')
			body.contactId = updateFields.contactId;
		if (updateFields.currency) body.currency = updateFields.currency;
		if (updateFields.termDays !== undefined) body.termDays = updateFields.termDays;

		// Nullable fields: explicit clear toggles send null; otherwise include only when set.
		//
		// renewalPeriod is conditional on termDays (see assertRenewalPeriodMatchesTerm): sending
		// one without the other is a 400, so say why instead of failing opaquely at the API.
		if (updateFields.clearRenewalPeriod === true) body.renewalPeriod = null;
		else if (updateFields.renewalPeriod) {
			assertRenewalPeriodMatchesTerm(ctx, updateFields, i, 'Update Fields');
			body.renewalPeriod = updateFields.renewalPeriod;
		}

		if (updateFields.clearValidUntil === true) body.validUntil = null;
		else if (updateFields.validUntil) body.validUntil = updateFields.validUntil;

		if (updateFields.clearTaxRate === true) body.taxRate = null;
		else if (updateFields.taxRate !== undefined) body.taxRate = updateFields.taxRate;

		if (updateFields.clearPriceBook === true) body.priceBookId = null;
		else if (updateFields.priceBookId) body.priceBookId = updateFields.priceBookId;

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'PATCH', endpoint: `/v1/quotes/${quoteId}`, body, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'delete') {
		const quoteId = ctx.getNodeParameter('quoteId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'DELETE', endpoint: `/v1/quotes/${quoteId}`, unwrap: 'smart' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'duplicate') {
		const quoteId = ctx.getNodeParameter('quoteId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: `/v1/quotes/${quoteId}/duplicate`, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'applyPriceBook') {
		const quoteId = ctx.getNodeParameter('quoteId', i) as string;
		const priceBookId = ctx.getNodeParameter('priceBookId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: `/v1/quotes/${quoteId}/apply-pricebook`,
				body: { priceBookId },
				unwrap: 'smart',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'removePriceBook') {
		const quoteId = ctx.getNodeParameter('quoteId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: `/v1/quotes/${quoteId}/remove-pricebook`, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'downloadPdf') {
		const quoteId = ctx.getNodeParameter('quoteId', i) as string;
		const buffer = await turboDocxApiRequestBinary(
			ctx,
			{ method: 'GET', endpoint: `/v1/quotes/${quoteId}/pdf` },
			i,
		);
		const binaryData = await ctx.helpers.prepareBinaryData(
			buffer,
			`quote-${quoteId}.pdf`,
			'application/pdf',
		);
		return [
			{
				json: { quoteId },
				binary: { data: binaryData },
			},
		];
	}

	if (operation === 'send') {
		const quoteId = ctx.getNodeParameter('quoteId', i) as string;
		const sendOptions = ctx.getNodeParameter('sendOptions', i, {}) as IDataObject;
		const body: IDataObject = {};
		if (sendOptions.ccEmails && sendOptions.ccEmails !== '')
			body.ccEmails = parseCcEmails(sendOptions.ccEmails as string);
		if (sendOptions.validUntil) body.validUntil = sendOptions.validUntil;
		applyQuoteSchedule(ctx, body, i);

		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: `/v1/quotes/${quoteId}/send`, body, unwrap: 'smart' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'sendWithDeliverable') {
		const quoteId = ctx.getNodeParameter('quoteId', i) as string;
		const deliverableId = ctx.getNodeParameter('deliverableId', i) as string;
		const mergePosition = ctx.getNodeParameter('mergePosition', i) as string;
		const sendOptions = ctx.getNodeParameter('sendWithDeliverableOptions', i, {}) as IDataObject;

		const body: IDataObject = { deliverableId, mergePosition };
		if (sendOptions.ccEmails && sendOptions.ccEmails !== '')
			body.ccEmails = parseCcEmails(sendOptions.ccEmails as string);
		applyQuoteSchedule(ctx, body, i);

		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: `/v1/quotes/${quoteId}/send-with-deliverable`,
				body,
				unwrap: 'smart',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'decline') {
		const quoteId = ctx.getNodeParameter('quoteId', i) as string;
		const reason = ctx.getNodeParameter('reason', i) as string;
		// A draft has no reason to give, so send the key only when the user actually filled it in.
		const body = reason?.trim() ? { reason } : {};
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: `/v1/quotes/${quoteId}/decline`, body, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'void') {
		const quoteId = ctx.getNodeParameter('quoteId', i) as string;
		// Void keeps its own required field — only decline's reason became optional.
		const reason = ctx.getNodeParameter('voidReason', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: `/v1/quotes/${quoteId}/void`, body: { reason }, unwrap: 'result' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'handleExpired') {
		const quoteId = ctx.getNodeParameter('quoteId', i) as string;
		const action = ctx.getNodeParameter('expiredAction', i) as string;
		const reason = ctx.getNodeParameter('expiredReason', i) as string;
		const newValidUntil = ctx.getNodeParameter('newValidUntil', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: `/v1/quotes/${quoteId}/handle-expired-sent`,
				body: { action, reason, newValidUntil },
				unwrap: 'result',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'createAndSend') {
		const name = ctx.getNodeParameter('name', i) as string;
		const companyId = ctx.getNodeParameter('companyId', i) as string;
		const contactId = ctx.getNodeParameter('contactId', i) as string;
		const fields = ctx.getNodeParameter('createAndSendFields', i, {}) as IDataObject;

		assertRenewalPeriodMatchesTerm(ctx, fields, i, 'Create and Send Fields');

		// 1) Create the quote.
		const createBody: IDataObject = { name, companyId, contactId };
		if (fields.currency) createBody.currency = fields.currency;
		if (fields.termDays !== undefined) createBody.termDays = fields.termDays;
		if (fields.renewalPeriod) createBody.renewalPeriod = fields.renewalPeriod;
		if (fields.validUntil) createBody.validUntil = fields.validUntil;
		if (fields.taxRate !== undefined) createBody.taxRate = fields.taxRate;
		if (fields.priceBookId) createBody.priceBookId = fields.priceBookId;

		const created = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: '/v1/quotes', body: createBody, unwrap: 'result' },
			i,
		);
		const quoteId = created.id as string;

		// 2) Add product line items (always an array body).
		const items = parseJsonParameter(
			ctx,
			ctx.getNodeParameter('items', i, '[]') as string,
			'items',
			i,
		) as IDataObject[] | undefined;
		if (Array.isArray(items) && items.length > 0) {
			await turboDocxApiRequest(
				ctx,
				{ method: 'POST', endpoint: `/v1/quotes/${quoteId}/items`, body: items as unknown as IDataObject, unwrap: 'smart' },
				i,
			);
		}

		// 3) Add bundle line items (always an array body).
		const bundleItems = parseJsonParameter(
			ctx,
			ctx.getNodeParameter('bundleItems', i, '[]') as string,
			'bundleItems',
			i,
		) as IDataObject[] | undefined;
		if (Array.isArray(bundleItems) && bundleItems.length > 0) {
			await turboDocxApiRequest(
				ctx,
				{
					method: 'POST',
					endpoint: `/v1/quotes/${quoteId}/items/bundle`,
					body: bundleItems as unknown as IDataObject,
					unwrap: 'smart',
				},
				i,
			);
		}

		// 4) Send the quote. The macro ends in the same send endpoint, so it carries the optional
		// reminder/expiration schedule too (mirrors the SDK's nested `send: SendQuoteRequest`).
		const sendBody: IDataObject = {};
		if (fields.ccEmails && fields.ccEmails !== '')
			sendBody.ccEmails = parseCcEmails(fields.ccEmails as string);
		if (fields.sendValidUntil) sendBody.validUntil = fields.sendValidUntil;
		applyQuoteSchedule(ctx, sendBody, i);

		const sent = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: `/v1/quotes/${quoteId}/send`, body: sendBody, unwrap: 'smart' },
			i,
		);
		return [{ json: sent }];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown Quote operation: ${operation}`, { itemIndex: i });
}

// ===================================================================
// Quote Line Item resource
// ===================================================================

async function executeQuoteLineItemResource(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	const quoteId = ctx.getNodeParameter('quoteId', i) as string;

	if (operation === 'list') {
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.lineItemType) baseQs.lineItemType = filters.lineItemType;
		if (filters.billingFrequency) baseQs.billingFrequency = filters.billingFrequency;
		if (filters.parentLineItemId) baseQs.parentLineItemId = filters.parentLineItemId;

		const records = await paginatedList(ctx, {
			endpoint: `/v1/quotes/${quoteId}/items`,
			i,
			baseQs,
		});
		return records.map((r) => ({ json: r }));
	}

	if (operation === 'add') {
		const items = parseJsonParameter(
			ctx,
			ctx.getNodeParameter('items', i) as string,
			'items',
			i,
		);
		const payload = Array.isArray(items) ? items : [items];
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: `/v1/quotes/${quoteId}/items`,
				body: payload as unknown as IDataObject,
				unwrap: 'smart',
			},
			i,
		);
		const results = (result.results as IDataObject[]) ?? [];
		return results.map((r) => ({ json: r }));
	}

	if (operation === 'addBundle') {
		const items = parseJsonParameter(
			ctx,
			ctx.getNodeParameter('bundleItemsJson', i) as string,
			'bundleItemsJson',
			i,
		);
		const payload = Array.isArray(items) ? items : [items];
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: `/v1/quotes/${quoteId}/items/bundle`,
				body: payload as unknown as IDataObject,
				unwrap: 'smart',
			},
			i,
		);
		const results = (result.results as IDataObject[]) ?? [];
		return results.map((r) => ({ json: r }));
	}

	if (operation === 'update') {
		const itemId = ctx.getNodeParameter('itemId', i) as string;
		const updateFields = ctx.getNodeParameter('updateFields', i, {}) as IDataObject;
		const body: IDataObject = {};

		if (updateFields.quantity !== undefined) body.quantity = updateFields.quantity;
		if (updateFields.unitPrice !== undefined) body.unitPrice = updateFields.unitPrice;
		if (updateFields.discountPercent !== undefined) body.discountPercent = updateFields.discountPercent;
		if (updateFields.discountType) body.discountType = updateFields.discountType;
		if (updateFields.discountAmount !== undefined) body.discountAmount = updateFields.discountAmount;
		if (updateFields.billingFrequency) body.billingFrequency = updateFields.billingFrequency;
		if (updateFields.showItemsToEndUser !== undefined)
			body.showItemsToEndUser = updateFields.showItemsToEndUser;
		if (updateFields.productName !== undefined && updateFields.productName !== '')
			body.productName = updateFields.productName;

		// Nullable fields: explicit clear toggles send null; otherwise include only when set.
		if (updateFields.displayOrder !== undefined) body.displayOrder = updateFields.displayOrder;

		if (updateFields.clearCategoryId === true) body.categoryId = null;
		else if (updateFields.categoryId) body.categoryId = updateFields.categoryId;

		if (updateFields.clearCategoryName === true) body.categoryName = null;
		else if (updateFields.categoryName) body.categoryName = updateFields.categoryName;

		if (updateFields.clearCost === true) body.cost = null;
		else if (updateFields.cost !== undefined) body.cost = updateFields.cost;

		if (updateFields.productSku !== undefined && updateFields.productSku !== '')
			body.productSku = updateFields.productSku;
		if (updateFields.productDescription !== undefined && updateFields.productDescription !== '')
			body.productDescription = updateFields.productDescription;

		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'PATCH',
				endpoint: `/v1/quotes/${quoteId}/items/${itemId}`,
				body,
				unwrap: 'result',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'remove') {
		const itemId = ctx.getNodeParameter('itemId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'DELETE', endpoint: `/v1/quotes/${quoteId}/items/${itemId}`, unwrap: 'smart' },
			i,
		);
		return [{ json: result }];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown Quote Line Item operation: ${operation}`, { itemIndex: i });
}

// ===================================================================
// Quote Number Config resource (org-wide singleton, no quoteId)
// ===================================================================

async function executeQuoteNumberConfigResource(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	// The /number-config endpoints return a PLURAL `{ results: ... }` envelope,
	// so unwrap 'smart' and read `.results` manually (unwrap 'result' would miss it).
	if (operation === 'get') {
		const body = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint: '/v1/quotes/number-config', unwrap: 'smart' },
			i,
		);
		return [{ json: (body.results as IDataObject) ?? body }];
	}

	if (operation === 'update') {
		const requestBody: IDataObject = {
			prefix: ctx.getNodeParameter('prefix', i, '') as string,
			yearToken: ctx.getNodeParameter('yearToken', i, 'none') as string,
			monthToken: ctx.getNodeParameter('monthToken', i, 'off') as string,
			separator: ctx.getNodeParameter('separator', i, '-') as string,
			padWidth: ctx.getNodeParameter('padWidth', i, 4) as number,
			suffix: ctx.getNodeParameter('suffix', i, '') as string,
			startNumber: ctx.getNodeParameter('startNumber', i, 1) as number,
			resetCadence: ctx.getNodeParameter('resetCadence', i, 'never') as string,
		};
		const body = await turboDocxApiRequest(
			ctx,
			{ method: 'PATCH', endpoint: '/v1/quotes/number-config', body: requestBody, unwrap: 'smart' },
			i,
		);
		return [{ json: (body.results as IDataObject) ?? body }];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown Quote Number Config operation: ${operation}`, { itemIndex: i });
}

// ===================================================================
// Entry point
// ===================================================================

export async function executeQuote(
	ctx: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	if (resource === 'quoteLineItem') {
		return executeQuoteLineItemResource(ctx, operation, i);
	}
	if (resource === 'quoteNumberConfig') {
		return executeQuoteNumberConfigResource(ctx, operation, i);
	}
	return executeQuoteResource(ctx, operation, i);
}
