import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class TurboDocx implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TurboDocx',
		name: 'turboDocx',
		icon: 'file:turbodocx.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with TurboDocx API for document generation and TurboSign digital signatures',
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
			// Resource selector
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'TurboSign',
						value: 'turboSign',
					},
				],
				default: 'turboSign',
			},

			// ===============================
			// TurboSign Operations
			// ===============================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['turboSign'],
					},
				},
				options: [
					{
						name: 'TurboSign: Prepare for Review',
						value: 'prepareForReview',
						description: 'Upload a document with fields and recipients, get preview URL (no emails sent)',
						action: 'Prepare document for review',
					},
					{
						name: 'TurboSign: Prepare for Signing',
						value: 'prepareForSigning',
						description: 'Upload a document with fields and recipients, send signature request emails',
						action: 'Prepare document for signing',
					},
					{
						name: 'TurboSign: Get Document Status',
						value: 'getStatus',
						description: 'Get the current status of a signature document',
						action: 'Get document status',
					},
					{
						name: 'TurboSign: Download Document',
						value: 'downloadDocument',
						description: 'Download the signed PDF document',
						action: 'Download signed document',
					},
					{
						name: 'TurboSign: Void Document',
						value: 'voidDocument',
						description: 'Cancel a signature request',
						action: 'Void signature document',
					},
					{
						name: 'TurboSign: Resend Email',
						value: 'resendEmail',
						description: 'Resend signature request emails to specific recipients',
						action: 'Resend signature request email',
					},
				],
				default: 'prepareForSigning',
			},

			// ===============================
			// Prepare for Review / Prepare for Signing - Common Fields
			// ===============================
			{
				displayName: 'PDF File',
				name: 'pdfFile',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['turboSign'],
						operation: ['prepareForReview', 'prepareForSigning'],
					},
				},
				default: '',
				description: 'Binary data property name containing the PDF file (e.g., "data" from Read Binary File)',
				required: true,
			},
			{
				displayName: 'Recipients',
				name: 'recipients',
				type: 'json',
				displayOptions: {
					show: {
						resource: ['turboSign'],
						operation: ['prepareForReview', 'prepareForSigning'],
					},
				},
				default: '[]',
				description: 'JSON array of recipients with name, email, signingOrder, and metadata (color, lightColor)',
				required: true,
				placeholder: '[{"name":"John Doe","email":"john@example.com","signingOrder":1,"metadata":{"color":"hsl(210, 50%, 50%)","lightColor":"hsl(210, 50%, 90%)"}}]',
			},
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'json',
				displayOptions: {
					show: {
						resource: ['turboSign'],
						operation: ['prepareForReview', 'prepareForSigning'],
					},
				},
				default: '[]',
				description: 'JSON array of signature fields with recipientId, type, and coordinates or template anchor',
				required: true,
				placeholder: '[{"recipientId":"uuid","type":"signature","page":1,"x":100,"y":200,"width":150,"height":50}]',
			},
			{
				displayName: 'Document Name',
				name: 'documentName',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['turboSign'],
						operation: ['prepareForReview', 'prepareForSigning'],
					},
				},
				default: '',
				description: 'Name for the signature document',
			},
			{
				displayName: 'Document Description',
				name: 'documentDescription',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['turboSign'],
						operation: ['prepareForReview', 'prepareForSigning'],
					},
				},
				default: '',
				description: 'Description for the signature document',
			},
			{
				displayName: 'Sender Name',
				name: 'senderName',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['turboSign'],
						operation: ['prepareForReview', 'prepareForSigning'],
					},
				},
				default: '',
				description: 'Name of the sender (displayed in emails)',
			},
			{
				displayName: 'Sender Email',
				name: 'senderEmail',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['turboSign'],
						operation: ['prepareForReview', 'prepareForSigning'],
					},
				},
				default: '',
				description: 'Email address of the sender',
			},
			{
				displayName: 'CC Emails',
				name: 'ccEmails',
				type: 'json',
				displayOptions: {
					show: {
						resource: ['turboSign'],
						operation: ['prepareForReview', 'prepareForSigning'],
					},
				},
				default: '[]',
				description: 'JSON array of email addresses to CC when document is completed (max 10)',
				placeholder: '["admin@company.com", "records@company.com"]',
			},

			// ===============================
			// Get Document Status Fields
			// ===============================
			{
				displayName: 'Document ID',
				name: 'documentId',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['turboSign'],
						operation: ['getStatus', 'downloadDocument', 'voidDocument', 'resendEmail'],
					},
				},
				default: '',
				description: 'UUID of the signature document',
				required: true,
			},

			// ===============================
			// Void Document Fields
			// ===============================
			{
				displayName: 'Void Reason',
				name: 'voidReason',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['turboSign'],
						operation: ['voidDocument'],
					},
				},
				default: '',
				description: 'Reason for voiding the document (required, max 500 characters)',
				required: true,
			},

			// ===============================
			// Resend Email Fields
			// ===============================
			{
				displayName: 'Recipient IDs',
				name: 'recipientIds',
				type: 'json',
				displayOptions: {
					show: {
						resource: ['turboSign'],
						operation: ['resendEmail'],
					},
				},
				default: '[]',
				description: 'JSON array of recipient UUIDs to resend emails to',
				required: true,
				placeholder: '["uuid1", "uuid2"]',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const credentials = await this.getCredentials('turboDocxApi');
		const baseUrl = credentials.baseUrl as string;

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'turboSign') {
					// ===============================
					// Prepare for Review
					// ===============================
					if (operation === 'prepareForReview') {
						const pdfFileProp = this.getNodeParameter('pdfFile', i) as string;
						const recipients = this.getNodeParameter('recipients', i) as string;
						const fields = this.getNodeParameter('fields', i) as string;
						const documentName = this.getNodeParameter('documentName', i, '') as string;
						const documentDescription = this.getNodeParameter('documentDescription', i, '') as string;
						const senderName = this.getNodeParameter('senderName', i, '') as string;
						const senderEmail = this.getNodeParameter('senderEmail', i, '') as string;
						const ccEmails = this.getNodeParameter('ccEmails', i, '[]') as string;

						// Get binary data
						const binaryData = this.helpers.assertBinaryData(i, pdfFileProp);
						const fileBuffer = await this.helpers.getBinaryDataBuffer(i, pdfFileProp);

						// Build request body using n8n's built-in multipart/form-data support
						const requestBody: any = {
							recipients,
							fields,
						};
						if (documentName) requestBody.documentName = documentName;
						if (documentDescription) requestBody.documentDescription = documentDescription;
						if (senderName) requestBody.senderName = senderName;
						if (senderEmail) requestBody.senderEmail = senderEmail;
						if (ccEmails && ccEmails !== '[]') requestBody.ccEmails = ccEmails;

						// Add file with n8n binary data format
						requestBody.file = {
							value: fileBuffer,
							options: {
								filename: binaryData.fileName || 'document.pdf',
								contentType: binaryData.mimeType || 'application/pdf',
							},
						};

						// Make API request - n8n handles multipart encoding automatically
						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'turboDocxApi',
							{
								method: 'POST',
								url: `${baseUrl}/turbosign/single/prepare-for-review`,
								body: requestBody,
								headers: {
									'Content-Type': 'multipart/form-data',
								},
							},
						);

						returnData.push({ json: response as any });
					}

					// ===============================
					// Prepare for Signing
					// ===============================
					else if (operation === 'prepareForSigning') {
						const pdfFileProp = this.getNodeParameter('pdfFile', i) as string;
						const recipients = this.getNodeParameter('recipients', i) as string;
						const fields = this.getNodeParameter('fields', i) as string;
						const documentName = this.getNodeParameter('documentName', i, '') as string;
						const documentDescription = this.getNodeParameter('documentDescription', i, '') as string;
						const senderName = this.getNodeParameter('senderName', i, '') as string;
						const senderEmail = this.getNodeParameter('senderEmail', i, '') as string;
						const ccEmails = this.getNodeParameter('ccEmails', i, '[]') as string;

						// Get binary data
						const binaryData = this.helpers.assertBinaryData(i, pdfFileProp);
						const fileBuffer = await this.helpers.getBinaryDataBuffer(i, pdfFileProp);

						// Build request body using n8n's built-in multipart/form-data support
						const requestBody: any = {
							recipients,
							fields,
						};
						if (documentName) requestBody.documentName = documentName;
						if (documentDescription) requestBody.documentDescription = documentDescription;
						if (senderName) requestBody.senderName = senderName;
						if (senderEmail) requestBody.senderEmail = senderEmail;
						if (ccEmails && ccEmails !== '[]') requestBody.ccEmails = ccEmails;

						// Add file with n8n binary data format
						requestBody.file = {
							value: fileBuffer,
							options: {
								filename: binaryData.fileName || 'document.pdf',
								contentType: binaryData.mimeType || 'application/pdf',
							},
						};

						// Make API request - n8n handles multipart encoding automatically
						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'turboDocxApi',
							{
								method: 'POST',
								url: `${baseUrl}/turbosign/single/prepare-for-signing`,
								body: requestBody,
								headers: {
									'Content-Type': 'multipart/form-data',
								},
							},
						);

						returnData.push({ json: response as any });
					}

					// ===============================
					// Get Document Status
					// ===============================
					else if (operation === 'getStatus') {
						const documentId = this.getNodeParameter('documentId', i) as string;

						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'turboDocxApi',
							{
								method: 'GET',
								url: `${baseUrl}/turbosign/documents/${documentId}/status`,
							},
						);

						returnData.push({ json: response as any });
					}

					// ===============================
					// Download Document
					// ===============================
					else if (operation === 'downloadDocument') {
						const documentId = this.getNodeParameter('documentId', i) as string;

						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'turboDocxApi',
							{
								method: 'GET',
								url: `${baseUrl}/turbosign/documents/${documentId}/download`,
								encoding: 'arraybuffer',
								json: false,
							},
						);

						const binaryData = await this.helpers.prepareBinaryData(
							response as Buffer,
							`signed-document-${documentId}.pdf`,
							'application/pdf',
						);

						returnData.push({
							json: { documentId },
							binary: {
								data: binaryData,
							},
						});
					}

					// ===============================
					// Void Document
					// ===============================
					else if (operation === 'voidDocument') {
						const documentId = this.getNodeParameter('documentId', i) as string;
						const voidReason = this.getNodeParameter('voidReason', i) as string;

						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'turboDocxApi',
							{
								method: 'POST',
								url: `${baseUrl}/turbosign/documents/${documentId}/void`,
								body: {
									reason: voidReason,
								},
								json: true,
							},
						);

						returnData.push({ json: response as any });
					}

					// ===============================
					// Resend Email
					// ===============================
					else if (operation === 'resendEmail') {
						const documentId = this.getNodeParameter('documentId', i) as string;
						const recipientIds = this.getNodeParameter('recipientIds', i) as string;

						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'turboDocxApi',
							{
								method: 'POST',
								url: `${baseUrl}/turbosign/documents/${documentId}/resend-email`,
								body: {
									recipientIds: JSON.parse(recipientIds),
								},
								json: true,
							},
						);

						returnData.push({ json: response as any });
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
						},
						pairedItem: {
							item: i,
						},
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error.message, {
					itemIndex: i,
				});
			}
		}

		return [returnData];
	}
}
