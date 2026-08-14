import { IExecuteFunctions, INodeExecutionData, IDataObject, NodeOperationError } from 'n8n-workflow';
import {
	turboDocxApiRequest,
	parseJsonParameter,
	CRED_PARTNER,
	paginatedList as sharedPaginatedList,
} from '../../shared/GenericFunctions';

/** Resolve the partner ID from the partner credential (it is not a node parameter). */
async function getPartnerId(ctx: IExecuteFunctions): Promise<string> {
	const creds = await ctx.getCredentials(CRED_PARTNER);
	return creds.partnerId as string;
}

/**
 * Run a paginated GET over a partner list endpoint.
 *
 * Partner list responses are `{ success, data: { results, totalRecords, limit, offset } }`.
 * `unwrap: 'data'` extracts the `data` object (smart unwrap would not, because `success`
 * is a sibling key), then we read `.results` from it.
 */
async function paginatedList(
	ctx: IExecuteFunctions,
	endpoint: string,
	baseQs: IDataObject,
	i: number,
): Promise<INodeExecutionData[]> {
	const records = await sharedPaginatedList(ctx, {
		endpoint,
		i,
		baseQs,
		credentialName: CRED_PARTNER,
		unwrap: 'data',
	});
	return records.map((r) => ({ json: r }));
}

// =====================================================================
// Partner Organization
// =====================================================================
async function executePartnerOrganization(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	const partnerId = await getPartnerId(ctx);

	if (operation === 'create') {
		const name = ctx.getNodeParameter('name', i) as string;
		const additionalFields = ctx.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const body: IDataObject = { name };
		if (additionalFields.metadata !== undefined && additionalFields.metadata !== '') {
			body.metadata = parseJsonParameter(
				ctx,
				additionalFields.metadata as string,
				'metadata',
				i,
			) as IDataObject;
		}
		if (additionalFields.features !== undefined && additionalFields.features !== '') {
			body.features = parseJsonParameter(
				ctx,
				additionalFields.features as string,
				'features',
				i,
			) as IDataObject;
		}
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: `/partner/${partnerId}/organization`,
				body,
				credentialName: CRED_PARTNER,
				unwrap: 'data',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'list') {
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.search) baseQs.search = filters.search;
		return paginatedList(ctx, `/partner/${partnerId}/organizations`, baseQs, i);
	}

	if (operation === 'get') {
		const organizationId = ctx.getNodeParameter('organizationId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'GET',
				endpoint: `/partner/${partnerId}/organizations/${organizationId}`,
				credentialName: CRED_PARTNER,
				unwrap: 'data',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'update') {
		const organizationId = ctx.getNodeParameter('organizationId', i) as string;
		const name = ctx.getNodeParameter('name', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'PATCH',
				endpoint: `/partner/${partnerId}/organizations/${organizationId}`,
				body: { name },
				credentialName: CRED_PARTNER,
				unwrap: 'data',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'updateEntitlements') {
		const organizationId = ctx.getNodeParameter('organizationId', i) as string;
		const featuresRaw = ctx.getNodeParameter('features', i, '') as string;
		const trackingRaw = ctx.getNodeParameter('tracking', i, '') as string;
		const body: IDataObject = {};
		if (featuresRaw !== undefined && featuresRaw !== '' && featuresRaw !== '{}') {
			body.features = parseJsonParameter(ctx, featuresRaw, 'features', i) as IDataObject;
		}
		if (trackingRaw !== undefined && trackingRaw !== '' && trackingRaw !== '{}') {
			body.tracking = parseJsonParameter(ctx, trackingRaw, 'tracking', i) as IDataObject;
		}
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'PATCH',
				endpoint: `/partner/${partnerId}/organizations/${organizationId}/entitlements`,
				body,
				credentialName: CRED_PARTNER,
				unwrap: 'data',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'getPreferences') {
		const organizationId = ctx.getNodeParameter('organizationId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'GET',
				endpoint: `/partner/${partnerId}/organizations/${organizationId}/preferences`,
				credentialName: CRED_PARTNER,
				unwrap: 'data',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'updatePreferences') {
		const organizationId = ctx.getNodeParameter('organizationId', i) as string;
		const preferences = ctx.getNodeParameter('preferences', i, {}) as IDataObject;
		// The backend requires at least one key (Joi `.min(1)`), so an untouched collection
		// would 400 on a round trip. Fail here with a message that names the fix instead.
		if (Object.keys(preferences).length === 0) {
			throw new NodeOperationError(
				ctx.getNode(),
				'No preferences to update. Add at least one preference under "Preferences".',
				{ itemIndex: i },
			);
		}
		// The toggles themselves always produce real booleans, but an n8n expression can
		// resolve to anything — and the API validates these strictly (a string "true" is a
		// 400, not a coerced true). Name the offending key here rather than surfacing an
		// opaque validation error from the server.
		for (const [key, value] of Object.entries(preferences)) {
			if (typeof value !== 'boolean') {
				throw new NodeOperationError(
					ctx.getNode(),
					`Preference "${key}" must be true or false, but got ${typeof value} (${JSON.stringify(value)}). If this comes from an expression, convert it to a boolean.`,
					{ itemIndex: i },
				);
			}
		}
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'PATCH',
				endpoint: `/partner/${partnerId}/organizations/${organizationId}/preferences`,
				body: { preferences },
				credentialName: CRED_PARTNER,
				unwrap: 'data',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'delete') {
		const organizationId = ctx.getNodeParameter('organizationId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'DELETE',
				endpoint: `/partner/${partnerId}/organizations/${organizationId}`,
				credentialName: CRED_PARTNER,
				unwrap: 'none',
			},
			i,
		);
		return [{ json: result }];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown Partner Organization operation: ${operation}`, { itemIndex: i });
}

// =====================================================================
// Partner Org User
// =====================================================================
async function executePartnerOrgUser(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	const partnerId = await getPartnerId(ctx);
	const organizationId = ctx.getNodeParameter('organizationId', i) as string;
	const base = `/partner/${partnerId}/organizations/${organizationId}/users`;

	if (operation === 'list') {
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.search) baseQs.search = filters.search;
		return paginatedList(ctx, base, baseQs, i);
	}

	if (operation === 'add') {
		const email = ctx.getNodeParameter('email', i) as string;
		const role = ctx.getNodeParameter('role', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: base, body: { email, role }, credentialName: CRED_PARTNER, unwrap: 'data' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'updateRole') {
		const userId = ctx.getNodeParameter('userId', i) as string;
		const role = ctx.getNodeParameter('role', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'PATCH',
				endpoint: `${base}/${userId}`,
				body: { role },
				credentialName: CRED_PARTNER,
				unwrap: 'data',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'remove') {
		const userId = ctx.getNodeParameter('userId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'DELETE', endpoint: `${base}/${userId}`, credentialName: CRED_PARTNER, unwrap: 'none' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'resendInvite') {
		const userId = ctx.getNodeParameter('userId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: `${base}/${userId}/resend-invitation`,
				credentialName: CRED_PARTNER,
				unwrap: 'none',
			},
			i,
		);
		return [{ json: result }];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown Partner Org User operation: ${operation}`, { itemIndex: i });
}

// =====================================================================
// Partner Org API Key
// =====================================================================
async function executePartnerOrgApiKey(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	const partnerId = await getPartnerId(ctx);
	const organizationId = ctx.getNodeParameter('organizationId', i) as string;
	const base = `/partner/${partnerId}/organizations/${organizationId}/apikeys`;

	if (operation === 'list') {
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.search) baseQs.search = filters.search;
		return paginatedList(ctx, base, baseQs, i);
	}

	if (operation === 'create') {
		const name = ctx.getNodeParameter('name', i) as string;
		const role = ctx.getNodeParameter('role', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: base, body: { name, role }, credentialName: CRED_PARTNER, unwrap: 'data' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'update') {
		const apiKeyId = ctx.getNodeParameter('apiKeyId', i) as string;
		const updateFields = ctx.getNodeParameter('updateFields', i, {}) as IDataObject;
		const body: IDataObject = {};
		if (updateFields.name !== undefined && updateFields.name !== '') body.name = updateFields.name;
		if (updateFields.role !== undefined && updateFields.role !== '') body.role = updateFields.role;
		// Update response carries the key at top-level `apiKey`, not `data` — keep raw body.
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'PATCH',
				endpoint: `${base}/${apiKeyId}`,
				body,
				credentialName: CRED_PARTNER,
				unwrap: 'none',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'revoke') {
		const apiKeyId = ctx.getNodeParameter('apiKeyId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'DELETE', endpoint: `${base}/${apiKeyId}`, credentialName: CRED_PARTNER, unwrap: 'none' },
			i,
		);
		return [{ json: result }];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown Partner Org API Key operation: ${operation}`, { itemIndex: i });
}

// =====================================================================
// Partner API Key
// =====================================================================
async function executePartnerApiKey(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	const partnerId = await getPartnerId(ctx);
	const base = `/partner/${partnerId}/api-keys`;

	if (operation === 'list') {
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.search) baseQs.search = filters.search;
		return paginatedList(ctx, base, baseQs, i);
	}

	if (operation === 'create') {
		const name = ctx.getNodeParameter('name', i) as string;
		const scopes = parseJsonParameter(
			ctx,
			ctx.getNodeParameter('scopes', i) as string,
			'scopes',
			i,
		);
		const additionalFields = ctx.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const body: IDataObject = { name, scopes: scopes as string[] };
		if (additionalFields.description !== undefined && additionalFields.description !== '') {
			body.description = additionalFields.description;
		}
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: base, body, credentialName: CRED_PARTNER, unwrap: 'data' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'update') {
		const apiKeyId = ctx.getNodeParameter('apiKeyId', i) as string;
		const updateFields = ctx.getNodeParameter('updateFields', i, {}) as IDataObject;
		const body: IDataObject = {};
		if (updateFields.name !== undefined && updateFields.name !== '') body.name = updateFields.name;
		if (updateFields.description !== undefined && updateFields.description !== '') {
			body.description = updateFields.description;
		}
		if (updateFields.scopes !== undefined && updateFields.scopes !== '' && updateFields.scopes !== '[]') {
			body.scopes = parseJsonParameter(ctx, updateFields.scopes as string, 'scopes', i) as string[];
		}
		// Update response carries the key at top-level `apiKey`, not `data` — keep raw body.
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'PATCH',
				endpoint: `${base}/${apiKeyId}`,
				body,
				credentialName: CRED_PARTNER,
				unwrap: 'none',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'revoke') {
		const apiKeyId = ctx.getNodeParameter('apiKeyId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'DELETE', endpoint: `${base}/${apiKeyId}`, credentialName: CRED_PARTNER, unwrap: 'none' },
			i,
		);
		return [{ json: result }];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown Partner API Key operation: ${operation}`, { itemIndex: i });
}

// =====================================================================
// Partner User
// =====================================================================
async function executePartnerUser(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	const partnerId = await getPartnerId(ctx);
	const base = `/partner/${partnerId}/users`;

	if (operation === 'list') {
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.search) baseQs.search = filters.search;
		return paginatedList(ctx, base, baseQs, i);
	}

	if (operation === 'add') {
		const email = ctx.getNodeParameter('email', i) as string;
		const role = ctx.getNodeParameter('role', i) as string;
		const permissions = parseJsonParameter(
			ctx,
			ctx.getNodeParameter('permissions', i) as string,
			'permissions',
			i,
		);
		const body: IDataObject = { email, role, permissions: permissions as IDataObject };
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint: base, body, credentialName: CRED_PARTNER, unwrap: 'data' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'updatePermissions') {
		const userId = ctx.getNodeParameter('userId', i) as string;
		const updateFields = ctx.getNodeParameter('updateFields', i, {}) as IDataObject;
		const body: IDataObject = {};
		if (updateFields.role !== undefined && updateFields.role !== '') body.role = updateFields.role;
		if (
			updateFields.permissions !== undefined &&
			updateFields.permissions !== '' &&
			updateFields.permissions !== '{}'
		) {
			body.permissions = parseJsonParameter(
				ctx,
				updateFields.permissions as string,
				'permissions',
				i,
			) as IDataObject;
		}
		// PartnerUserUpdateResponse is `{ success, data: { userId, role, permissions } }`.
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'PATCH',
				endpoint: `${base}/${userId}`,
				body,
				credentialName: CRED_PARTNER,
				unwrap: 'data',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'remove') {
		const userId = ctx.getNodeParameter('userId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'DELETE', endpoint: `${base}/${userId}`, credentialName: CRED_PARTNER, unwrap: 'none' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'resendInvite') {
		const userId = ctx.getNodeParameter('userId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: `${base}/${userId}/resend-invitation`,
				credentialName: CRED_PARTNER,
				unwrap: 'none',
			},
			i,
		);
		return [{ json: result }];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown Partner User operation: ${operation}`, { itemIndex: i });
}

// =====================================================================
// Partner Audit Log
// =====================================================================
async function executePartnerAuditLog(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	const partnerId = await getPartnerId(ctx);

	if (operation === 'list') {
		const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
		const baseQs: IDataObject = {};
		if (filters.action) baseQs.action = filters.action;
		if (filters.resourceType) baseQs.resourceType = filters.resourceType;
		if (filters.resourceId) baseQs.resourceId = filters.resourceId;
		if (filters.search) baseQs.search = filters.search;
		if (filters.startDate) baseQs.startDate = filters.startDate;
		if (filters.endDate) baseQs.endDate = filters.endDate;
		if (filters.success !== undefined) baseQs.success = filters.success;
		return paginatedList(ctx, `/partner/${partnerId}/audit-logs`, baseQs, i);
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown Partner Audit Log operation: ${operation}`, { itemIndex: i });
}

// =====================================================================
// Dispatcher
// =====================================================================
export async function executePartner(
	ctx: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	switch (resource) {
		case 'partnerOrganization':
			return executePartnerOrganization(ctx, operation, i);
		case 'partnerOrgUser':
			return executePartnerOrgUser(ctx, operation, i);
		case 'partnerOrgApiKey':
			return executePartnerOrgApiKey(ctx, operation, i);
		case 'partnerApiKey':
			return executePartnerApiKey(ctx, operation, i);
		case 'partnerUser':
			return executePartnerUser(ctx, operation, i);
		case 'partnerAuditLog':
			return executePartnerAuditLog(ctx, operation, i);
		default:
			throw new NodeOperationError(ctx.getNode(), `Unknown Partner resource: ${resource}`, { itemIndex: i });
	}
}
