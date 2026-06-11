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
import { normalizeUnexpectedError } from './shared/GenericFunctions';

const resourceSelector: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{
			name: 'Deliverable',
			value: 'deliverable',
		},
		{
			name: 'TurboSign',
			value: 'turboSign',
		},
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
		subtitle: '={{ $parameter["operation"] === "downloadDocument" ? "Download signed document" : $parameter["operation"] === "getStatus" ? "Get document status" : $parameter["operation"] === "getAuditTrail" ? "Get document audit trail" : $parameter["operation"] === "prepareForReview" ? "Prepare document for review" : $parameter["operation"] === "prepareForSigning" ? "Prepare document for signing" : $parameter["operation"] === "resendEmail" ? "Resend signature request email" : $parameter["operation"] === "voidDocument" ? "Void signature document" : "TurboDocx" }}',
		description:
			'Interact with TurboDocx API for document generation and TurboSign digital signatures',
		defaults: {
			name: 'TurboDocx',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'turboDocxApi',
				required: true,
			},
		],
		properties: [
			resourceSelector,

			// ===============================
			// TurboSign
			// ===============================
			...turboSignOperations,
			...turboSignFields,

			// ===============================
			// Deliverable
			// ===============================
			...deliverableOperations,
			...deliverableFields,
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
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported resource: ${resource}`,
						{ itemIndex: i },
					);
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
