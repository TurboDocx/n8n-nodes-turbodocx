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

export class TurboDocx implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TurboDocx',
		name: 'turboDocx',
		icon: 'file:turbodocx.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] === "generateDeliverable" ? "Generate deliverable from template" : $parameter["operation"] === "downloadDocument" ? "Download signed document" : $parameter["operation"] === "getStatus" ? "Get document status" : $parameter["operation"] === "prepareForReview" ? "Prepare document for review" : $parameter["operation"] === "prepareForSigning" ? "Prepare document for signing" : $parameter["operation"] === "resendEmail" ? "Resend signature request email" : $parameter["operation"] === "voidDocument" ? "Void signature document" : "TurboDocx" }}',
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
			// ===============================
			// Operations
			// ===============================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
				{
					name: 'Download Document',
					value: 'downloadDocument',
					description: 'Download the signed PDF document',
					action: 'Download signed document',
				},
				{
					name: 'Generate Deliverable',
					value: 'generateDeliverable',
					description: 'Generate a document from a template with variables',
					action: 'Generate deliverable from template',
				},
				{
					name: 'Get Document Status',
					value: 'getStatus',
					description: 'Get the current status of a signature document',
					action: 'Get document status',
				},
				{
					name: 'Prepare For Review',
					value: 'prepareForReview',
					description:
						'Upload a document with fields and recipients, get preview URL (no emails sent)',
					action: 'Prepare document for review',
				},
				{
					name: 'Prepare For Signing',
					value: 'prepareForSigning',
					description:
						'Upload a document with fields and recipients, send signature request emails',
					action: 'Prepare document for signing',
				},
				{
					name: 'Resend Signature Request Email',
					value: 'resendEmail',
					description: 'Resend signature request emails to specific recipients',
					action: 'Resend signature request email',
				},
				{
					name: 'Void Document',
					value: 'voidDocument',
					description: 'Cancel a signature request',
					action: 'Void signature document',
				},

			],
			default: 'generateDeliverable',
			},

			// ===============================
			// TurboDocx: Generate Deliverable - Parameters
			// ===============================
			{
				displayName: 'Template ID',
				name: 'templateId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						operation: ['generateDeliverable'],
					},
				},
				default: '',
				placeholder: 'e.g., 550e8400-e29b-41d4-a716-446655440000',
				description: 'The UUID of the template to use for generation. Find this in your TurboDocx dashboard.',
			},
			{
				displayName: 'Variables Input Mode',
				name: 'variablesMode',
				type: 'options',
				displayOptions: {
					show: {
						operation: ['generateDeliverable'],
					},
				},
				options: [
					{
						name: 'JSON',
						value: 'json',
						description: 'Provide variables as a JSON array (recommended for complex data)',
					},
					{
						name: 'Define Below',
						value: 'fields',
						description: 'Define variables using form fields (easier for simple variables)',
					},
				],
				default: 'json',
				description: 'How to provide the template variables',
			},
			{
				displayName: 'Variables (JSON)',
				name: 'variablesJson',
				type: 'json',
				required: true,
				displayOptions: {
					show: {
						operation: ['generateDeliverable'],
						variablesMode: ['json'],
					},
				},
				default: '[\n  {\n    "name": "customerName",\n    "placeholder": "{name}",\n    "mimeType": "text",\n    "value": "John Doe"\n  }\n]',
				placeholder: 'See examples in description',
				description: 'Array of variable objects. Each variable must have "name" and "placeholder" fields. <a href="https://docs.turbodocx.com/docs/TurboDocx%20Templating/Advanced%20Templating%20Engine/" target="_blank">View Advanced Templating Docs</a>',
				hint: 'Example: [{"name": "user", "placeholder": "{user}", "mimeType": "json", "value": {"firstName": "Jane", "email": "jane@example.com"}, "usesAdvancedTemplatingEngine": true}]',
			},
			{
				displayName: 'Variables',
				name: 'variablesFields',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						operation: ['generateDeliverable'],
						variablesMode: ['fields'],
					},
				},
				default: {},
				placeholder: 'Add Variable',
				options: [
					{
						name: 'variable',
						displayName: 'Variable',
						values: [
							{
								displayName: 'Mime Type',
								name: 'mimeType',
								type: 'options',
								options: [
									{
										name: 'HTML',
										value: 'html',
									},
									{
										name: 'Image',
										value: 'image/*',
									},
									{
										name: 'JSON (for Nested Objects/arrays)',
										value: 'json',
									},
									{
										name: 'Markdown',
										value: 'markdown',
									},
									{
										name: 'Text',
										value: 'text',
									},
								],
								default: 'text',
								description: 'The type of data for this variable',
								required: true,
							},
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								placeholder: 'e.g., customerName',
								description: 'Variable identifier (required)',
								required: true,
							},
							{
								displayName: 'Placeholder',
								name: 'placeholder',
								type: 'string',
								default: '',
								placeholder: 'e.g.,	{name}',
								description: 'The placeholder in the template (include curly braces, required)',
								required: true,
							},
							{
								displayName: 'Uses Advanced Templating',
								name: 'usesAdvancedTemplatingEngine',
								type: 'boolean',
								default: false,
								description: 'Whether to enable advanced templating features (conditionals, loops, arithmetic). Automatically enabled for mimeType \'JSON\'. Required when using JSON values with mimeType \'text\'.',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								placeholder: 'Variable value or JSON object',
								description: 'The value to replace the placeholder with. For mimeType \'text\', use primitive values (string/number/boolean). For JSON objects with text mimeType, enable Advanced Templating.',
							},
						],
					},
				],
				description: 'Add variables to populate the template. <a href="https://docs.turbodocx.com/docs/TurboDocx%20Templating/Advanced%20Templating%20Engine/" target="_blank">View Advanced Templating Docs</a>.',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						operation: ['generateDeliverable'],
					},
				},
				options: [
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						description: 'Name for the generated deliverable',
						placeholder: 'e.g., Contract for Acme Corp',
					},
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						default: '',
						description: 'Description of the deliverable',
						placeholder: 'e.g., Employment agreement for new hire',
					},
				],
			},

			// ===============================
			// ===============================
			// Prepare for Review / Prepare for Signing - Common Fields
			// ===============================
			{
				displayName: 'File Input Method',
				name: 'fileInputMethod',
				type: 'options',
				displayOptions: {
					show: {
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
						operation: ['prepareForReview', 'prepareForSigning'],
					},
				},
				default: '',
				description:
					'JSON array of recipients with name, email, signingOrder, and metadata (color, lightColor)',
				required: true,
				placeholder:
					'[{"name":"Sales Rep","email":"sales@example.com","signingOrder":1},{"name":"Client Name","email":"client@example.com","signingOrder":2}]',
				hint: 'Example: [{"name":"Sales Rep","email":"sales@example.com","signingOrder":1},{"name":"Client Name","email":"client@example.com","signingOrder":2}]',
			},
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'json',
				displayOptions: {
					show: {
						operation: ['prepareForReview', 'prepareForSigning'],
					},
				},
				default: '',
				description:
					'JSON array of signature fields with recipientEmail, type, and template anchor',
				required: true,
				placeholder:
					'[{"recipientEmail":"sales@example.com","type":"signature","template":{"anchor":"{Signature1}","placement":"replace","size":{"width":200,"height":50}}}]',
				hint: 'Example: [{"recipientEmail":"sales@example.com","type":"signature","template":{"anchor":"{SalesSigner}","placement":"replace","size":{"width":200,"height":50}}},{"recipientEmail":"client@example.com","type":"signature","template":{"anchor":"{ClientSigner}","placement":"replace","size":{"width":200,"height":50}}}]',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
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
						operation: ['resendEmail'],
					},
				},
				default: '',
				description: 'JSON array of recipient UUIDs to resend emails to',
				required: true,
				placeholder: '["5f673f37-9912-4e72-85aa-8f3649760f6b"]',
				hint: 'Example: ["5f673f37-9912-4e72-85aa-8f3649760f6b"]',
			},
		],
		usableAsTool: true,
	};
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		const credentials = await this.getCredentials('turboDocxApi');
		const baseUrl = credentials.baseUrl as string;

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'generateDeliverable') {
					// Get required parameters
					const templateId = this.getNodeParameter('templateId', i) as string;
					const variablesMode = this.getNodeParameter('variablesMode', i) as string;

					// Get optional fields
					const additionalFields = this.getNodeParameter('additionalFields', i, {}) as {
						name?: string;
						description?: string;
					};

					// Parse and validate variables based on mode
					let variables: Array<{
						name: string;
						placeholder: string;
						mimeType: string;
						value: string | number | boolean | object | unknown[];
						usesAdvancedTemplatingEngine?: boolean;
					}>;

					if (variablesMode === 'json') {
						// JSON mode - parse JSON string
						const variablesString = this.getNodeParameter('variablesJson', i) as string;

						try {
							variables = JSON.parse(variablesString);

							// Validate it's an array
							if (!Array.isArray(variables)) {
								throw new NodeOperationError(
									this.getNode(),
									'Variables must be a JSON array',
									{ itemIndex: i },
								);
							}

							// Validate each variable has required fields
							for (let j = 0; j < variables.length; j++) {
								const variable = variables[j];

								// Check for required name field
								if (!variable.name || typeof variable.name !== 'string') {
									throw new NodeOperationError(
										this.getNode(),
										`Variable at index ${j} is missing required "name" field`,
										{ itemIndex: i },
									);
								}

								// Check for required placeholder field
								if (!variable.placeholder || typeof variable.placeholder !== 'string') {
									throw new NodeOperationError(
										this.getNode(),
										`Variable at index ${j} is missing required "placeholder" field`,
										{ itemIndex: i },
									);
								}

								// Check for required mimeType field
								if (!variable.mimeType || typeof variable.mimeType !== 'string') {
									throw new NodeOperationError(
										this.getNode(),
										`Variable at index ${j} is missing required "mimeType" field`,
										{ itemIndex: i },
									);
								}

								// Validate mimeType "text" constraints
								if (variable.mimeType === 'text') {
									const valueType = typeof variable.value;
									const isPrimitive = valueType === 'string' || valueType === 'number' || valueType === 'boolean';

									// If value is an object/array and usesAdvancedTemplatingEngine is not true, throw error
									if (!isPrimitive && !variable.usesAdvancedTemplatingEngine) {
										throw new NodeOperationError(
											this.getNode(),
											`Variable at index ${j} ("${variable.name}"): mimeType "text" with JSON object/array value requires "usesAdvancedTemplatingEngine: true"`,
											{ itemIndex: i },
										);
									}
								}
							}
						} catch (parseError) {
							throw new NodeOperationError(
								this.getNode(),
								`Invalid JSON in variables: ${(parseError as Error).message}\n\nHTTP Status: 400`,
								{ itemIndex: i },
							);
						}
					} else {
						// Fields mode - get from fixedCollection
						const variablesFields = this.getNodeParameter('variablesFields', i, {}) as {
							variable?: Array<{
								name: string;
								placeholder: string;
								mimeType: string;
								value: string;
								usesAdvancedTemplatingEngine?: boolean;
							}>;
						};

						if (!variablesFields.variable || !Array.isArray(variablesFields.variable)) {
							variables = [];
						} else {
							variables = variablesFields.variable.map((v, j) => {
								// Validate required fields
								if (!v.name || !v.placeholder) {
									throw new NodeOperationError(
										this.getNode(),
										`Variable at position ${j + 1}: Both "name" and "placeholder" are required`,
										{ itemIndex: i },
									);
								}

								// Parse value if mimeType is json
								let parsedValue: string | number | boolean | object | unknown[] = v.value;
								if (v.mimeType === 'json') {
									try {
										parsedValue = JSON.parse(v.value);
									} catch (parseError) {
										throw new NodeOperationError(
											this.getNode(),
											`Invalid JSON in variable "${v.name}" (${v.placeholder}) value: ${(parseError as Error).message}`,
											{ itemIndex: i },
										);
									}
								} else if (v.mimeType === 'text') {
									// For text mimeType, try to parse the value
									// If it's a JSON object/array, check for usesAdvancedTemplatingEngine
									try {
										const testParse = JSON.parse(v.value);
										if (typeof testParse === 'object' && testParse !== null) {
											// Value is a JSON object/array
											if (!v.usesAdvancedTemplatingEngine) {
												throw new NodeOperationError(
													this.getNode(),
													`Variable "${v.name}" (${v.placeholder}): mimeType "text" with JSON object/array value requires "Uses Advanced Templating" to be enabled`,
													{ itemIndex: i },
												);
											}
											parsedValue = testParse;
										} else {
											// Primitive value parsed from JSON (number, boolean, null)
											parsedValue = testParse;
										}
									} catch {
										// Not valid JSON, keep as string (which is fine for text mimeType)
										parsedValue = v.value;
									}
								}

								return {
									name: v.name,
									placeholder: v.placeholder,
									mimeType: v.mimeType,
									value: parsedValue,
									usesAdvancedTemplatingEngine: v.usesAdvancedTemplatingEngine,
								};
							});
						}

						// Validate we have at least one variable
						if (variables.length === 0) {
							throw new NodeOperationError(
								this.getNode(),
								'At least one variable is required. Please add variables in the "Variables" section.',
								{ itemIndex: i },
							);
						}
					}

					// Build request body
					const requestBody: {
						templateId: string;
						variables: Array<{
							name: string;
							placeholder: string;
							mimeType: string;
							value: string | number | boolean | object | unknown[];
							usesAdvancedTemplatingEngine?: boolean;
						}>;
						name?: string;
						description?: string;
					} = {
						templateId,
						variables,
					};

					// Add optional fields if provided
					if (additionalFields.name) {
						requestBody.name = additionalFields.name;
					}
					if (additionalFields.description) {
						requestBody.description = additionalFields.description;
					}

					// Make API request
					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'turboDocxApi',
						{
							method: 'POST',
							url: `${baseUrl}/v1/deliverables`,
							body: requestBody,
							json: true,
							ignoreHttpStatusErrors: true,
							returnFullResponse: true,
						},
					);

					// Handle response
					const fullResponse = response as { statusCode: number; body: unknown };

					// Check for errors (status >= 400)
					if (fullResponse.statusCode >= 400) {
						let errorBody = fullResponse.body as Record<string, unknown> | string;

						// Parse error body if it's a string
						if (typeof errorBody === 'string') {
							try {
								errorBody = JSON.parse(errorBody) as Record<string, unknown>;
							} catch {
								// Keep as string if parsing fails
							}
						}

						// Extract error message
						let errorMessage = 'Failed to generate deliverable';
						let errorCode = '';

						if (typeof errorBody === 'object' && errorBody !== null) {
							// Check for validation errors (Celebrate/Joi format)
							if (errorBody.data && typeof errorBody.data === 'object') {
								const dataObj = errorBody.data as Record<string, unknown>;
								if (dataObj.errors && Array.isArray(dataObj.errors)) {
									const validationErrors = dataObj.errors
										.map((err: Record<string, unknown>) => `${err.path || 'field'}: ${err.message || 'validation error'}`)
										.join('; ');
									errorMessage = `Validation error: ${validationErrors}`;
								}
							}

							// Check for standard error message
							if (errorBody.message && typeof errorBody.message === 'string') {
								errorMessage = errorBody.message;
							} else if (errorBody.error && typeof errorBody.error === 'string') {
								errorMessage = errorBody.error;
							}

							// Extract error code
							if (errorBody.type && typeof errorBody.type === 'string') {
								errorCode = errorBody.type;
							} else if (errorBody.code && typeof errorBody.code === 'string') {
								errorCode = errorBody.code;
							}
						} else if (typeof errorBody === 'string') {
							errorMessage = errorBody;
						}

						throw new NodeOperationError(
							this.getNode(),
							`${errorMessage}${errorCode ? ` [${errorCode}]` : ''}\n\nHTTP Status: ${fullResponse.statusCode}`,
							{ itemIndex: i },
						);
					}

					// Success - return the response
					returnData.push({
						json: fullResponse.body as IDataObject,
						pairedItem: { item: i },
					});
				}
				else if (operation === 'prepareForReview') {
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
							ignoreHttpStatusErrors: true,
							returnFullResponse: true,
						},
					);

					// Check for HTTP errors and throw with proper message
					const fullResponse = response as { statusCode: number; body: unknown };
					if (fullResponse.statusCode >= 400) {
						let errorBody = fullResponse.body as Record<string, unknown> | string;

						// Parse body if it's a string
						if (typeof errorBody === 'string') {
							try {
								errorBody = JSON.parse(errorBody) as Record<string, unknown>;
							} catch {
								// Keep as string if not valid JSON
							}
						}

						// Extract detailed error message from TurboDocx API response format
						// Format: { message: "...", type: "...", data?: { errors: [...] } }
						let errorMessage = 'Request failed';
						const errorCode = typeof errorBody === 'object' ? ((errorBody?.type as string) || (errorBody?.code as string) || '') : '';

						// Check for validation errors with detailed error list
						if (typeof errorBody === 'object' && errorBody?.data && typeof errorBody.data === 'object' && Array.isArray((errorBody.data as { errors?: unknown[] }).errors)) {
							const errorDetails = ((errorBody.data as { errors: { message?: string }[] }).errors)
								.map((e: { message?: string }) => e.message || JSON.stringify(e))
								.join('; ');
							errorMessage = errorDetails || (errorBody?.message as string) || 'Validation failed';
						} else if (typeof errorBody === 'object' && errorBody?.error) {
							// Some endpoints use { error: "...", code: "..." }
							errorMessage = errorBody.error as string;
						} else if (typeof errorBody === 'object' && errorBody?.message) {
							// Standard format { message: "...", type: "..." }
							errorMessage = errorBody.message as string;
						}

						throw new NodeOperationError(
							this.getNode(),
							`${errorMessage}${errorCode ? ` [${errorCode}]` : ''}\n\nHTTP Status: ${fullResponse.statusCode}`,
							{ itemIndex: i },
						);
					}

					returnData.push({ json: fullResponse.body as IDataObject });
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
							ignoreHttpStatusErrors: true,
							returnFullResponse: true,
						},
					);

					// Check for HTTP errors and throw with proper message
					const fullResponse = response as { statusCode: number; body: unknown };
					if (fullResponse.statusCode >= 400) {
						let errorBody = fullResponse.body as Record<string, unknown> | string;

						// Parse body if it's a string
						if (typeof errorBody === 'string') {
							try {
								errorBody = JSON.parse(errorBody) as Record<string, unknown>;
							} catch {
								// Keep as string if not valid JSON
							}
						}

						// Extract detailed error message from TurboDocx API response format
						let errorMessage = 'Request failed';
						const errorCode = typeof errorBody === 'object' ? ((errorBody?.type as string) || (errorBody?.code as string) || '') : '';

						if (typeof errorBody === 'object' && errorBody?.data && typeof errorBody.data === 'object' && Array.isArray((errorBody.data as { errors?: unknown[] }).errors)) {
							const errorDetails = ((errorBody.data as { errors: { message?: string }[] }).errors)
								.map((e: { message?: string }) => e.message || JSON.stringify(e))
								.join('; ');
							errorMessage = errorDetails || (errorBody?.message as string) || 'Validation failed';
						} else if (typeof errorBody === 'object' && errorBody?.error) {
							errorMessage = errorBody.error as string;
						} else if (typeof errorBody === 'object' && errorBody?.message) {
							errorMessage = errorBody.message as string;
						}

						throw new NodeOperationError(
							this.getNode(),
							`${errorMessage}${errorCode ? ` [${errorCode}]` : ''}\n\nHTTP Status: ${fullResponse.statusCode}`,
							{ itemIndex: i },
						);
					}

					returnData.push({ json: fullResponse.body as IDataObject });
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
							ignoreHttpStatusErrors: true,
							returnFullResponse: true,
						},
					);

					const fullResponse = response as { statusCode: number; body: unknown };
					if (fullResponse.statusCode >= 400) {
						let errorBody = fullResponse.body as Record<string, unknown>;

						if (typeof errorBody === 'string') {
							try {
								errorBody = JSON.parse(errorBody) as Record<string, unknown>;
							} catch {
								// Keep as string
							}
						}

						let errorMessage = 'Request failed';
						const errorCode = (errorBody?.type as string) || (errorBody?.code as string) || '';

						if (errorBody?.data && typeof errorBody.data === 'object' && Array.isArray((errorBody.data as { errors?: unknown[] }).errors)) {
							const errorDetails = ((errorBody.data as { errors: { message?: string }[] }).errors)
								.map((e: { message?: string }) => e.message || JSON.stringify(e))
								.join('; ');
							errorMessage = errorDetails || (errorBody?.message as string) || 'Validation failed';
						} else if (errorBody?.error) {
							errorMessage = errorBody.error as string;
						} else if (errorBody?.message) {
							errorMessage = errorBody.message as string;
						}

						throw new NodeOperationError(
							this.getNode(),
							`${errorMessage}${errorCode ? ` [${errorCode}]` : ''}\n\nHTTP Status: ${fullResponse.statusCode}`,
							{ itemIndex: i },
						);
					}

					returnData.push({ json: fullResponse.body as IDataObject });
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
							ignoreHttpStatusErrors: true,
							returnFullResponse: true,
						},
					);

					const fullResponse = response as { statusCode: number; body: unknown; headers: unknown };
					if (fullResponse.statusCode >= 400) {
						let errorBody: string | Record<string, unknown> = fullResponse.body as string | Record<string, unknown>;

						// Try to parse error body if it's a buffer/string
						if (Buffer.isBuffer(errorBody)) {
							errorBody = errorBody.toString('utf-8');
						}
						if (typeof errorBody === 'string') {
							try {
								errorBody = JSON.parse(errorBody) as Record<string, unknown>;
							} catch {
								// Keep as string
							}
						}

						// Extract detailed error message (same pattern as other operations)
						let errorMessage = 'Request failed';
						const errorCode = typeof errorBody === 'object' ? ((errorBody?.type as string) || (errorBody?.code as string) || '') : '';

						if (typeof errorBody === 'object' && errorBody?.data && typeof errorBody.data === 'object' && Array.isArray((errorBody.data as { errors?: unknown[] }).errors)) {
							const errorDetails = ((errorBody.data as { errors: { message?: string }[] }).errors)
								.map((e: { message?: string }) => e.message || JSON.stringify(e))
								.join('; ');
							errorMessage = errorDetails || (errorBody?.message as string) || 'Download failed';
						} else if (typeof errorBody === 'object' && errorBody?.error) {
							errorMessage = errorBody.error as string;
						} else if (typeof errorBody === 'object' && errorBody?.message) {
							errorMessage = errorBody.message as string;
						}

						throw new NodeOperationError(
							this.getNode(),
							`${errorMessage}${errorCode ? ` [${errorCode}]` : ''}\n\nHTTP Status: ${fullResponse.statusCode}`,
							{ itemIndex: i },
						);
					}

					// Success - extract buffer from response body
					const binaryData = await this.helpers.prepareBinaryData(
						fullResponse.body as Buffer,
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
							ignoreHttpStatusErrors: true,
							returnFullResponse: true,
						},
					);

					const fullResponse = response as { statusCode: number; body: unknown };
					if (fullResponse.statusCode >= 400) {
						let errorBody = fullResponse.body as Record<string, unknown>;

						if (typeof errorBody === 'string') {
							try {
								errorBody = JSON.parse(errorBody) as Record<string, unknown>;
							} catch {
								// Keep as string
							}
						}

						let errorMessage = 'Request failed';
						const errorCode = (errorBody?.type as string) || (errorBody?.code as string) || '';

						if (errorBody?.data && typeof errorBody.data === 'object' && Array.isArray((errorBody.data as { errors?: unknown[] }).errors)) {
							const errorDetails = ((errorBody.data as { errors: { message?: string }[] }).errors)
								.map((e: { message?: string }) => e.message || JSON.stringify(e))
								.join('; ');
							errorMessage = errorDetails || (errorBody?.message as string) || 'Validation failed';
						} else if (errorBody?.error) {
							errorMessage = errorBody.error as string;
						} else if (errorBody?.message) {
							errorMessage = errorBody.message as string;
						}

						throw new NodeOperationError(
							this.getNode(),
							`${errorMessage}${errorCode ? ` [${errorCode}]` : ''}\n\nHTTP Status: ${fullResponse.statusCode}`,
							{ itemIndex: i },
						);
					}

					returnData.push({ json: fullResponse.body as IDataObject });
				}

				// ===============================
				// Resend Email
				// ===============================
				else if (operation === 'resendEmail') {
					const documentId = this.getNodeParameter('documentId', i) as string;
					const recipientIds = this.getNodeParameter('recipientIds', i) as string;

					// Parse recipientIds with error handling
					let parsedRecipientIds: string[];
					try {
						parsedRecipientIds = JSON.parse(recipientIds);
					} catch (parseError) {
						throw new NodeOperationError(
							this.getNode(),
							`Invalid JSON in recipientIds: ${(parseError as Error).message}\n\nHTTP Status: 400`,
							{ itemIndex: i },
						);
					}

					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'turboDocxApi',
						{
							method: 'POST',
							url: `${baseUrl}/turbosign/documents/${documentId}/resend-email`,
							body: {
								recipientIds: parsedRecipientIds,
							},
							json: true,
							ignoreHttpStatusErrors: true,
							returnFullResponse: true,
						},
					);

					const fullResponse2 = response as { statusCode: number; body: unknown };
					if (fullResponse2.statusCode >= 400) {
						let errorBody = fullResponse2.body as Record<string, unknown>;

						if (typeof errorBody === 'string') {
							try {
								errorBody = JSON.parse(errorBody) as Record<string, unknown>;
							} catch {
								// Keep as string
							}
						}

						let errorMessage = 'Request failed';
						const errorCode = (errorBody?.type as string) || (errorBody?.code as string) || '';

						if (errorBody?.data && typeof errorBody.data === 'object' && Array.isArray((errorBody.data as { errors?: unknown[] }).errors)) {
							const errorDetails = ((errorBody.data as { errors: { message?: string }[] }).errors)
								.map((e: { message?: string }) => e.message || JSON.stringify(e))
								.join('; ');
							errorMessage = errorDetails || (errorBody?.message as string) || 'Validation failed';
						} else if (errorBody?.error) {
							errorMessage = errorBody.error as string;
						} else if (errorBody?.message) {
							errorMessage = errorBody.message as string;
						}

						throw new NodeOperationError(
							this.getNode(),
							`${errorMessage}${errorCode ? ` [${errorCode}]` : ''}\n\nHTTP Status: ${fullResponse2.statusCode}`,
							{ itemIndex: i },
						);
					}

					returnData.push({ json: fullResponse2.body as IDataObject });
				}
			} catch (error) {
				// Re-throw NodeOperationError as-is (already formatted)
				if (error instanceof NodeOperationError) {
					if (this.continueOnFail()) {
						returnData.push({
							json: {
								error: error.message,
							},
							pairedItem: { item: i },
						});
						continue;
					}
					throw error;
				}

				// Handle unexpected errors (e.g., from download endpoint or network issues)
				const errorObj = error as {
					httpCode?: number;
					statusCode?: number;
					cause?: { httpCode?: number; statusCode?: number; error?: unknown; response?: { body?: unknown } };
					error?: unknown;
					response?: { body?: unknown };
					message?: string;
				};
				const statusCode =
					errorObj.httpCode ||
					errorObj.statusCode ||
					errorObj.cause?.httpCode ||
					errorObj.cause?.statusCode ||
					400;

				// Try to extract API response body from n8n's error structure
				let backendResponse: Record<string, unknown> | null = null;
				if (errorObj.error && typeof errorObj.error === 'object') {
					backendResponse = errorObj.error as Record<string, unknown>;
				} else if (errorObj.cause?.error && typeof errorObj.cause.error === 'object') {
					backendResponse = errorObj.cause.error as Record<string, unknown>;
				} else if (errorObj.response?.body) {
					backendResponse = errorObj.response.body as Record<string, unknown>;
				} else if (errorObj.cause?.response?.body) {
					backendResponse = errorObj.cause.response.body as Record<string, unknown>;
				}

				const apiErrorMessage = (backendResponse?.error as string) || (backendResponse?.message as string);
				const apiErrorCode = backendResponse?.code as string;

				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: apiErrorMessage || errorObj.message,
							code: apiErrorCode || 'UnknownError',
							statusCode,
						},
						pairedItem: { item: i },
					});
					continue;
				}

				let errorMessage = apiErrorMessage || errorObj.message || 'Request failed';
				const errorCode = (backendResponse?.type as string) || apiErrorCode || '';

				// Handle validation errors from Celebrate/Joi - extract detailed messages
				if (backendResponse?.data && typeof backendResponse.data === 'object' && Array.isArray((backendResponse.data as { errors?: unknown[] }).errors)) {
					const errorDetails = ((backendResponse.data as { errors: { path?: string[]; message?: string }[] }).errors)
						.map((e: { path?: string[]; message?: string }) => {
							const fieldPath = e.path?.join('.') || 'unknown';
							return `${fieldPath}: ${e.message}`;
						})
						.join('; ');

					if (errorDetails) {
						errorMessage = errorDetails;
					}
				}

				if (errorCode) {
					errorMessage += ` [${errorCode}]`;
				}
				errorMessage += `\n\nHTTP Status: ${statusCode}`;

				throw new NodeOperationError(this.getNode(), errorMessage, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
