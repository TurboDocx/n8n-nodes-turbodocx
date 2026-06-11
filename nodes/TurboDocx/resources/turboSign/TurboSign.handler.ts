import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import {
	turboDocxApiRequest,
	turboDocxApiRequestBinary,
	parseJsonParameter,
} from '../../shared/GenericFunctions';

interface ITurboSignAdditionalFields {
	documentName?: string;
	documentDescription?: string;
	senderName?: string;
	senderEmail?: string;
	ccEmails?: string;
}

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

/** Build the multipart/JSON body shared by prepareForReview and prepareForSigning. */
async function buildPrepareBody(
	ctx: IExecuteFunctions,
	i: number,
): Promise<ITurboSignRequestBody> {
	const fileInputMethod = ctx.getNodeParameter('fileInputMethod', i) as string;
	const recipients = ctx.getNodeParameter('recipients', i) as string;
	const fields = ctx.getNodeParameter('fields', i) as string;
	const additionalFields = ctx.getNodeParameter('additionalFields', i, {}) as ITurboSignAdditionalFields;

	const requestBody: ITurboSignRequestBody = {
		recipients,
		fields,
	};
	if (additionalFields.documentName) requestBody.documentName = additionalFields.documentName;
	if (additionalFields.documentDescription)
		requestBody.documentDescription = additionalFields.documentDescription;
	if (additionalFields.senderName) requestBody.senderName = additionalFields.senderName;
	if (additionalFields.senderEmail) requestBody.senderEmail = additionalFields.senderEmail;
	if (additionalFields.ccEmails && additionalFields.ccEmails !== '')
		requestBody.ccEmails = additionalFields.ccEmails;

	if (fileInputMethod === 'upload') {
		const pdfFileProp = ctx.getNodeParameter('pdfFile', i) as string;
		const binaryData = ctx.helpers.assertBinaryData(i, pdfFileProp);
		const fileBuffer = await ctx.helpers.getBinaryDataBuffer(i, pdfFileProp);

		requestBody.file = {
			value: fileBuffer,
			options: {
				filename: binaryData.fileName || 'document.pdf',
				contentType: binaryData.mimeType || 'application/pdf',
			},
		};
	} else if (fileInputMethod === 'url') {
		requestBody.fileLink = ctx.getNodeParameter('fileLink', i) as string;
	} else if (fileInputMethod === 'deliverable') {
		requestBody.deliverableId = ctx.getNodeParameter('deliverableId', i) as string;
	} else if (fileInputMethod === 'template') {
		requestBody.templateId = ctx.getNodeParameter('templateId', i) as string;
	}

	return requestBody;
}

export async function executeTurboSign(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData> {
	if (operation === 'prepareForReview' || operation === 'prepareForSigning') {
		const endpoint =
			operation === 'prepareForReview'
				? '/turbosign/single/prepare-for-review'
				: '/turbosign/single/prepare-for-signing';
		const body = await buildPrepareBody(ctx, i);
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'POST', endpoint, body, multipart: true },
			i,
		);
		return { json: result };
	}

	if (operation === 'getStatus') {
		const documentId = ctx.getNodeParameter('documentId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint: `/turbosign/documents/${documentId}/status` },
			i,
		);
		return { json: result };
	}

	if (operation === 'downloadDocument') {
		const documentId = ctx.getNodeParameter('documentId', i) as string;
		const buffer = await turboDocxApiRequestBinary(
			ctx,
			{ method: 'GET', endpoint: `/turbosign/documents/${documentId}/download` },
			i,
		);
		const binaryData = await ctx.helpers.prepareBinaryData(
			buffer,
			`signed-document-${documentId}.pdf`,
			'application/pdf',
		);
		return {
			json: { documentId },
			binary: { data: binaryData },
		};
	}

	if (operation === 'voidDocument') {
		const documentId = ctx.getNodeParameter('documentId', i) as string;
		const voidReason = ctx.getNodeParameter('voidReason', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: `/turbosign/documents/${documentId}/void`,
				body: { reason: voidReason },
			},
			i,
		);
		return { json: result };
	}

	if (operation === 'resendEmail') {
		const documentId = ctx.getNodeParameter('documentId', i) as string;
		const recipientIds = ctx.getNodeParameter('recipientIds', i) as string;
		const parsedRecipientIds = parseJsonParameter(ctx, recipientIds, 'recipientIds', i);
		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: `/turbosign/documents/${documentId}/resend-email`,
				body: { recipientIds: parsedRecipientIds as string[] },
			},
			i,
		);
		return { json: result };
	}

	if (operation === 'getAuditTrail') {
		const documentId = ctx.getNodeParameter('documentId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint: `/turbosign/documents/${documentId}/audit-trail` },
			i,
		);
		return { json: result };
	}

	throw new Error(`Unknown TurboSign operation: ${operation}`);
}
