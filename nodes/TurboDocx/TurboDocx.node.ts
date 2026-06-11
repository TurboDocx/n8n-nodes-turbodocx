import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	INodeProperties,
	NodeOperationError,
} from 'n8n-workflow';

import { turboSignOperations, turboSignFields } from './resources/turboSign/TurboSign.description';
import { executeTurboSign } from './resources/turboSign/TurboSign.handler';
import {
	deliverableOperations,
	deliverableFields,
} from './resources/deliverable/Deliverable.description';
import { executeDeliverable } from './resources/deliverable/Deliverable.handler';
import {
	quoteOperations,
	quoteFields,
	quoteLineItemOperations,
	quoteLineItemFields,
} from './resources/quote/Quote.description';
import { executeQuote } from './resources/quote/Quote.handler';
import {
	productOperations,
	productFields,
	priceBookOperations,
	priceBookFields,
	bundleOperations,
	bundleFields,
} from './resources/catalog/Catalog.description';
import { executeCatalog } from './resources/catalog/Catalog.handler';
import {
	companyOperations,
	companyFields,
	contactOperations,
	contactFields,
	quoteTemplateOperations,
	quoteTemplateFields,
	quoteTypeOperations,
	quoteTypeFields,
} from './resources/crm/Crm.description';
import { executeCrm } from './resources/crm/Crm.handler';
import {
	partnerOrganizationOperations,
	partnerOrganizationFields,
	partnerOrgUserOperations,
	partnerOrgUserFields,
	partnerOrgApiKeyOperations,
	partnerOrgApiKeyFields,
	partnerApiKeyOperations,
	partnerApiKeyFields,
	partnerUserOperations,
	partnerUserFields,
	partnerAuditLogOperations,
	partnerAuditLogFields,
} from './resources/partner/Partner.description';
import { executePartner } from './resources/partner/Partner.handler';
import { webhookOperations, webhookFields } from './resources/webhook/Webhook.description';
import { executeWebhook } from './resources/webhook/Webhook.handler';
import { normalizeUnexpectedError } from './shared/GenericFunctions';

/** Resources authenticated with the standard org API key (apiKey + orgId). */
const STANDARD_RESOURCES = [
	'turboSign',
	'deliverable',
	'quote',
	'quoteLineItem',
	'product',
	'priceBook',
	'bundle',
	'company',
	'contact',
	'quoteTemplate',
	'quoteType',
	'webhook',
];

/** Resources authenticated with the partner API key (TDXP- + partnerId). */
const PARTNER_RESOURCES = [
	'partnerOrganization',
	'partnerOrgUser',
	'partnerOrgApiKey',
	'partnerApiKey',
	'partnerUser',
	'partnerAuditLog',
];

const resourceSelector: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Bundle', value: 'bundle' },
		{ name: 'Company', value: 'company' },
		{ name: 'Contact', value: 'contact' },
		{ name: 'Deliverable', value: 'deliverable' },
		{ name: 'Partner API Key', value: 'partnerApiKey' },
		{ name: 'Partner Audit Log', value: 'partnerAuditLog' },
		{ name: 'Partner Org API Key', value: 'partnerOrgApiKey' },
		{ name: 'Partner Org User', value: 'partnerOrgUser' },
		{ name: 'Partner Organization', value: 'partnerOrganization' },
		{ name: 'Partner User', value: 'partnerUser' },
		{ name: 'Price Book', value: 'priceBook' },
		{ name: 'Product', value: 'product' },
		{ name: 'Quote', value: 'quote' },
		{ name: 'Quote Line Item', value: 'quoteLineItem' },
		{ name: 'Quote Template', value: 'quoteTemplate' },
		{ name: 'Quote Type', value: 'quoteType' },
		{ name: 'TurboSign', value: 'turboSign' },
		{ name: 'Webhook', value: 'webhook' },
	],
	default: 'turboSign',
};

export class TurboDocx implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TurboDocx',
		name: 'turboDocx',
		icon: 'file:turbodocx.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] === "downloadDocument" ? "Download signed document" : $parameter["operation"] === "getStatus" ? "Get document status" : $parameter["operation"] === "getAuditTrail" ? "Get document audit trail" : $parameter["operation"] === "prepareForReview" ? "Prepare document for review" : $parameter["operation"] === "prepareForSigning" ? "Prepare document for signing" : $parameter["operation"] === "resendEmail" ? "Resend signature request email" : $parameter["operation"] === "voidDocument" ? "Void signature document" : $parameter["resource"] + ": " + $parameter["operation"] }}',
		description:
			'Interact with TurboDocx for document generation, e-signatures (TurboSign), quotes (TurboQuote), partner management, and webhooks',
		defaults: {
			name: 'TurboDocx',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'turboDocxApi',
				required: true,
				displayOptions: {
					show: {
						resource: STANDARD_RESOURCES,
					},
				},
			},
			{
				name: 'turboDocxPartnerApi',
				required: true,
				displayOptions: {
					show: {
						resource: PARTNER_RESOURCES,
					},
				},
			},
		],
		properties: [
			resourceSelector,

			// TurboSign
			...turboSignOperations,
			...turboSignFields,

			// Deliverable
			...deliverableOperations,
			...deliverableFields,

			// Quote
			...quoteOperations,
			...quoteFields,
			...quoteLineItemOperations,
			...quoteLineItemFields,

			// Catalog (product / price book / bundle)
			...productOperations,
			...productFields,
			...priceBookOperations,
			...priceBookFields,
			...bundleOperations,
			...bundleFields,

			// CRM (company / contact / quote template / quote type)
			...companyOperations,
			...companyFields,
			...contactOperations,
			...contactFields,
			...quoteTemplateOperations,
			...quoteTemplateFields,
			...quoteTypeOperations,
			...quoteTypeFields,

			// Partner
			...partnerOrganizationOperations,
			...partnerOrganizationFields,
			...partnerOrgUserOperations,
			...partnerOrgUserFields,
			...partnerOrgApiKeyOperations,
			...partnerOrgApiKeyFields,
			...partnerApiKeyOperations,
			...partnerApiKeyFields,
			...partnerUserOperations,
			...partnerUserFields,
			...partnerAuditLogOperations,
			...partnerAuditLogFields,

			// Webhook (management)
			...webhookOperations,
			...webhookFields,
		],
		usableAsTool: true,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let result: INodeExecutionData[];

				if (resource === 'turboSign') {
					result = await executeTurboSign(this, operation, i);
				} else if (resource === 'deliverable') {
					result = await executeDeliverable(this, operation, i);
				} else if (resource === 'quote' || resource === 'quoteLineItem') {
					result = await executeQuote(this, resource, operation, i);
				} else if (resource === 'product' || resource === 'priceBook' || resource === 'bundle') {
					result = await executeCatalog(this, resource, operation, i);
				} else if (
					resource === 'company' ||
					resource === 'contact' ||
					resource === 'quoteTemplate' ||
					resource === 'quoteType'
				) {
					result = await executeCrm(this, resource, operation, i);
				} else if (
					resource === 'partnerOrganization' ||
					resource === 'partnerOrgUser' ||
					resource === 'partnerOrgApiKey' ||
					resource === 'partnerApiKey' ||
					resource === 'partnerUser' ||
					resource === 'partnerAuditLog'
				) {
					result = await executePartner(this, resource, operation, i);
				} else if (resource === 'webhook') {
					result = await executeWebhook(this, resource, operation, i);
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported resource: ${resource}`, {
						itemIndex: i,
					});
				}

				returnData.push(...result);
			} catch (error) {
				// Re-throw NodeOperationError as-is (already formatted)
				if (error instanceof NodeOperationError) {
					if (this.continueOnFail()) {
						returnData.push({
							json: { error: error.message },
							pairedItem: { item: i },
						});
						continue;
					}
					throw error;
				}

				// Handle unexpected errors (network issues, n8n-wrapped API errors)
				const normalized = normalizeUnexpectedError(error);

				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: normalized.message.split('\n')[0],
							code: normalized.code,
							statusCode: normalized.statusCode,
						},
						pairedItem: { item: i },
					});
					continue;
				}

				throw new NodeOperationError(this.getNode(), normalized.message, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
