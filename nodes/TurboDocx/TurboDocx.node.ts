import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	IDataObject,
} from 'n8n-workflow';

// Additional fields configuration
interface ITurboSignAdditionalFields {
	documentName?: string;
	documentDescription?: string;
	senderName?: string;
	senderEmail?: string;
	ccEmails?: string;
}

// Request body for TurboSign API
interface ITurboSignRequestBody extends IDataObject {
	recipients: string;
	fields: string;
	documentName?: string;
	documentDescription?: string;
	senderName?: string;
	senderEmail?: string;
	ccEmails?: string;
	file?: {
		value: Buffer;
		options: {
			filename: string;
			contentType: string;
		};
	};
	fileLink?: string;
	deliverableId?: string;
	templateId?: string;
}

// Validation error structure
interface IValidationError {
	path?: string[];
	message: string;
}

export class TurboDocx implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TurboDocx',
		name: 'turboDocx',
		icon: 'file:turbodocx.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
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
						name: 'TurboSign: Download Document',
						value: 'downloadDocument',
						description: 'Download the signed PDF document',
						action: 'Download signed document',
					},
					{
						name: 'TurboSign: Get Document Status',
						value: 'getStatus',
						description: 'Get the current status of a signature document',
						action: 'Get document status',
					},
					{
						name: 'TurboSign: Prepare for Review',
						value: 'prepareForReview',
						description:
							'Upload a document with fields and recipients, get preview URL (no emails sent)',
						action: 'Prepare document for review',
					},
					{
						name: 'TurboSign: Prepare for Signing',
						value: 'prepareForSigning',
						description:
							'Upload a document with fields and recipients, send signature request emails',
						action: 'Prepare document for signing',
					},
					{
						name: 'TurboSign: Resend Email',
						value: 'resendEmail',
						description: 'Resend signature request emails to specific recipients',
						action: 'Resend signature request email',
					},
					{
						name: 'TurboSign: Void Document',
						value: 'voidDocument',
						description: 'Cancel a signature request',
						action: 'Void signature document',
					},
				],

				default: 'prepareForSigning',
			},

			// ===============================
			// Prepare for Review / Prepare for Signing - Common Fields
			// ===============================
			{
				displayName: 'File Input Method',
				name: 'fileInputMethod',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['turboSign'],
						operation: ['prepareForReview', 'prepareForSigning'],
					},
				},
				options: [
					{
						name: 'Upload File',
						value: 'upload',
						description: 'Upload PDF, DOCX, or PPTX from binary data',
					},
					{
						name: 'File URL',
						value: 'url',
						description: 'Provide URL to hosted file (S3, Google Drive, etc.)',
					},
					{
						name: 'Deliverable',
						value: 'deliverable',
						description: 'Use existing TurboDocx deliverable (references generated PDF)',
					},
					{
						name: 'Template',
						value: 'template',
						description: 'Use TurboDocx template (converts DOCX/PPTX to PDF)',
					},
				],
				default: 'upload',
				description: 'How to provide the document file',
			},
			{
				displayName: 'File',
				name: 'pdfFile',
				type: 'string',
				requiresDataPath: 'single',
				displayOptions: {
					show: {
						resource: ['turboSign'],
						operation: ['prepareForReview', 'prepareForSigning'],
						fileInputMethod: ['upload'],
					},
				},
				default: 'data',
				description:
					'The input binary field containing the file to process (supports PDF, DOCX, PPTX)',
				required: true,
				hint: 'Select the binary field from a previous node (e.g., from Read Binary File node)',
			},
			{
				displayName: 'File URL',
				name: 'fileLink',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['turboSign'],
						operation: ['prepareForReview', 'prepareForSigning'],
						fileInputMethod: ['url'],
					},
				},
				default: '',
				description: 'URL to hosted file (e.g., https://my-bucket.s3.amazonaws.com/contract.pdf)',
				required: true,
			},
			{
				displayName: 'Deliverable ID',
				name: 'deliverableId',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['turboSign'],
						operation: ['prepareForReview', 'prepareForSigning'],
						fileInputMethod: ['deliverable'],
					},
				},
				default: '',
				description: 'UUID of existing TurboDocx deliverable to use for signature request',
				required: true,
			},
			{
				displayName: 'Template ID',
				name: 'templateId',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['turboSign'],
						operation: ['prepareForReview', 'prepareForSigning'],
						fileInputMethod: ['template'],
					},
				},
				default: '',
				description: 'UUID of TurboDocx template to use (will be converted to PDF)',
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
				description:
					'JSON array of recipients with name, email, signingOrder, and metadata (color, lightColor)',
				required: true,
				placeholder:
					'[{"name":"John Doe","email":"john@example.com","signingOrder":1,"metadata":{"color":"hsl(210, 50%, 50%)","lightColor":"hsl(210, 50%, 90%)"}}]',
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
				description:
					'JSON array of signature fields with recipientId, type, and coordinates or template anchor',
				required: true,
				placeholder:
					'[{"recipientId":"uuid","type":"signature","page":1,"x":100,"y":200,"width":150,"height":50}]',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['turboSign'],
						operation: ['prepareForReview', 'prepareForSigning'],
					},
				},
				options: [
					{
						displayName: 'CC Emails',
						name: 'ccEmails',
						type: 'json',
						default: '[]',
						description: 'JSON array of email addresses to CC when document is completed (max 10)',
						placeholder: '["admin@company.com", "records@company.com"]',
					},
					{
						displayName: 'Document Description',
						name: 'documentDescription',
						type: 'string',
						default: '',
						description: 'Description for the signature document',
					},
					{
						displayName: 'Document Name',
						name: 'documentName',
						type: 'string',
						default: '',
						description: 'Name for the signature document',
					},
					{
						displayName: 'Sender Email',
						name: 'senderEmail',
						type: 'string',
						default: '',
						description: 'Email address of the sender',
					},
					{
						displayName: 'Sender Name',
						name: 'senderName',
						type: 'string',
						default: '',
						description: 'Name of the sender (displayed in emails)',
					},
				],
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
		usableAsTool: true,
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
						const fileInputMethod = this.getNodeParameter('fileInputMethod', i) as string;
						const recipients = this.getNodeParameter('recipients', i) as string;
						const fields = this.getNodeParameter('fields', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i, {}) as ITurboSignAdditionalFields;

						// Build request body using n8n's built-in multipart/form-data support
						const requestBody: ITurboSignRequestBody = {
							recipients,
							fields,
						};
						if (additionalFields.documentName)
							requestBody.documentName = additionalFields.documentName;
						if (additionalFields.documentDescription)
							requestBody.documentDescription = additionalFields.documentDescription;
						if (additionalFields.senderName) requestBody.senderName = additionalFields.senderName;
						if (additionalFields.senderEmail)
							requestBody.senderEmail = additionalFields.senderEmail;
						if (additionalFields.ccEmails && additionalFields.ccEmails !== '')
							requestBody.ccEmails = additionalFields.ccEmails;

						// Handle file input based on method
						if (fileInputMethod === 'upload') {
							const pdfFileProp = this.getNodeParameter('pdfFile', i) as string;
							const binaryData = this.helpers.assertBinaryData(i, pdfFileProp);
							const fileBuffer = await this.helpers.getBinaryDataBuffer(i, pdfFileProp);

							// Add file with n8n binary data format
							requestBody.file = {
								value: fileBuffer,
								options: {
									filename: binaryData.fileName || 'document.pdf',
									contentType: binaryData.mimeType || 'application/pdf',
								},
							};
						} else if (fileInputMethod === 'url') {
							const fileLink = this.getNodeParameter('fileLink', i) as string;
							requestBody.fileLink = fileLink;
						} else if (fileInputMethod === 'deliverable') {
							const deliverableId = this.getNodeParameter('deliverableId', i) as string;
							requestBody.deliverableId = deliverableId;
						} else if (fileInputMethod === 'template') {
							const templateId = this.getNodeParameter('templateId', i) as string;
							requestBody.templateId = templateId;
						}

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

						returnData.push({ json: response as IDataObject });
					}

					// ===============================
					// Prepare for Signing
					// ===============================
					else if (operation === 'prepareForSigning') {
						const fileInputMethod = this.getNodeParameter('fileInputMethod', i) as string;
						const recipients = this.getNodeParameter('recipients', i) as string;
						const fields = this.getNodeParameter('fields', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i, {}) as ITurboSignAdditionalFields;

						// Build request body using n8n's built-in multipart/form-data support
						const requestBody: ITurboSignRequestBody = {
							recipients,
							fields,
						};
						if (additionalFields.documentName)
							requestBody.documentName = additionalFields.documentName;
						if (additionalFields.documentDescription)
							requestBody.documentDescription = additionalFields.documentDescription;
						if (additionalFields.senderName) requestBody.senderName = additionalFields.senderName;
						if (additionalFields.senderEmail)
							requestBody.senderEmail = additionalFields.senderEmail;
						if (additionalFields.ccEmails && additionalFields.ccEmails !== '')
							requestBody.ccEmails = additionalFields.ccEmails;

						// Handle file input based on method
						if (fileInputMethod === 'upload') {
							const pdfFileProp = this.getNodeParameter('pdfFile', i) as string;
							const binaryData = this.helpers.assertBinaryData(i, pdfFileProp);
							const fileBuffer = await this.helpers.getBinaryDataBuffer(i, pdfFileProp);

							// Add file with n8n binary data format
							requestBody.file = {
								value: fileBuffer,
								options: {
									filename: binaryData.fileName || 'document.pdf',
									contentType: binaryData.mimeType || 'application/pdf',
								},
							};
						} else if (fileInputMethod === 'url') {
							const fileLink = this.getNodeParameter('fileLink', i) as string;
							requestBody.fileLink = fileLink;
						} else if (fileInputMethod === 'deliverable') {
							const deliverableId = this.getNodeParameter('deliverableId', i) as string;
							requestBody.deliverableId = deliverableId;
						} else if (fileInputMethod === 'template') {
							const templateId = this.getNodeParameter('templateId', i) as string;
							requestBody.templateId = templateId;
						}

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

						returnData.push({ json: response as IDataObject });
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

						returnData.push({ json: response as IDataObject });
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

						returnData.push({ json: response as IDataObject });
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

						returnData.push({ json: response as IDataObject });
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
							statusCode: error.statusCode || error.httpCode,
							response: error.response?.body || error.response,
							fullError: JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error))),
						},
						pairedItem: {
							item: i,
						},
					});
					continue;
				}

				// Extract error details from various possible locations
				const statusCode = error.statusCode || error.httpCode || error.response?.status;
				const backendResponse =
					error.response?.body || error.cause?.response?.body || error.cause?.body;

				// Build user-friendly error message
				let errorMessage = error.message || 'Unknown error occurred';

				if (statusCode) {
					errorMessage += `\n\nStatus Code: ${statusCode}`;
				}

				// Check if this is a Joi ValidationError with detailed field errors
				if (backendResponse?.type === 'ValidationError' && backendResponse?.data?.errors) {
					errorMessage += '\n\nValidation Errors:';
					(backendResponse.data.errors as IValidationError[]).forEach((err) => {
						const fieldPath = err.path?.join('.') || 'unknown';
						errorMessage += `\n  • ${fieldPath}: ${err.message}`;
					});

					// Add full validation details for debugging
					errorMessage += '\n\nFull Validation Details:';
					errorMessage += `\n${JSON.stringify(backendResponse.data.errors, null, 2)}`;
				} else if (backendResponse) {
					// For non-validation errors, show the full backend response
					errorMessage += `\n\nBackend Response:\n${JSON.stringify(backendResponse, null, 2)}`;
				} else {
					// If we still don't have details, dump the entire error object
					const errorDetails = JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
					errorMessage += `\n\nFull Error Details:\n${JSON.stringify(errorDetails, null, 2)}`;
				}

				throw new NodeOperationError(this.getNode(), errorMessage, {
					itemIndex: i,
					description:
						backendResponse?.message ||
						error.description ||
						'Check the error details above for more information',
				});
			}
		}

		return [returnData];
	}
}
