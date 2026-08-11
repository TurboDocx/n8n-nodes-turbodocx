import { IExecuteFunctions, INodeExecutionData, IDataObject, NodeOperationError } from 'n8n-workflow';
import {
	turboDocxApiRequest,
	fetchPresignedUrl,
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
): Promise<INodeExecutionData[]> {
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
		return [{ json: result }];
	}

	if (operation === 'getStatus') {
		const documentId = ctx.getNodeParameter('documentId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint: `/turbosign/documents/${documentId}/status`, unwrap: 'smart' },
			i,
		);
		return [{ json: result }];
	}

	// Returns { document, recipients, summary }. Each recipient carries BOTH `status`
	// (the raw pending/viewed/completed value) and `effectiveStatus` (the same with the
	// document's terminal state layered on, so voided/expired are possible). Branch on
	// effectiveStatus — on a voided document an unsigned signer still reads "pending"
	// in the raw status.
	//
	// Two `delivery` fields are also easy to misread in a workflow condition:
	// `reminderCount` counts AUTOMATIC (scheduled) reminders only, so a manual "remind
	// now" leaves it at 0 while still bumping `totalSent`; and `lastRemindedAt` is a
	// cadence clock stamped at the initial send (and by warnings), not a record of a
	// reminder. A freshly-sent document reads a non-null lastRemindedAt with
	// reminderCount 0. Use `totalSent` to test "have we emailed this person".
	if (operation === 'getRecipients') {
		const documentId = ctx.getNodeParameter('documentId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint: `/turbosign/documents/${documentId}/recipients`, unwrap: 'smart' },
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'downloadDocument') {
		const documentId = ctx.getNodeParameter('documentId', i) as string;

		// Two-step download. This endpoint does NOT stream the PDF — it returns
		// `{ downloadUrl, fileName }` where downloadUrl is a short-lived presigned S3
		// link. Reading it as a buffer would hand back the JSON bytes mislabelled as a
		// PDF, producing a file that downloads but never opens.
		const meta = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint: `/turbosign/documents/${documentId}/download` },
			i,
		);

		const downloadUrl = meta.downloadUrl as string | undefined;
		if (!downloadUrl) {
			throw new NodeOperationError(
				ctx.getNode(),
				`TurboSign did not return a download URL for document ${documentId}. A document can only be downloaded once it is completed.`,
				{ itemIndex: i },
			);
		}

		const buffer = await fetchPresignedUrl(ctx, downloadUrl, i);
		const fileName = (meta.fileName as string) || `signed-document-${documentId}.pdf`;
		const binaryData = await ctx.helpers.prepareBinaryData(
			buffer,
			fileName,
			'application/pdf',
		);
		return [
			{
				json: { documentId, fileName },
				binary: { data: binaryData },
			},
		];
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
				unwrap: 'smart',
			},
			i,
		);
		return [{ json: result }];
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
				unwrap: 'smart',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'sendReminder') {
		const documentId = ctx.getNodeParameter('documentId', i) as string;
		const recipientIds = ctx.getNodeParameter('reminderRecipientIds', i, '') as string;

		// The filter is optional: leaving it empty reminds every signer whose turn it is. Only
		// include the key when it actually names someone — the API requires at least one id when
		// `recipientIds` is present, so sending an empty array would guarantee a 400.
		const body: IDataObject = {};
		if (recipientIds && recipientIds.trim() !== '') {
			const parsed = parseJsonParameter(ctx, recipientIds, 'reminderRecipientIds', i) as string[];
			if (Array.isArray(parsed) && parsed.length > 0) {
				body.recipientIds = parsed;
			}
		}

		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: `/turbosign/documents/${documentId}/send-reminder`,
				body,
				unwrap: 'smart',
			},
			i,
		);
		return [{ json: result }];
	}

	if (operation === 'getAuditTrail') {
		const documentId = ctx.getNodeParameter('documentId', i) as string;
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint: `/turbosign/documents/${documentId}/audit-trail`, unwrap: 'smart' },
			i,
		);
		return [{ json: result }];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown TurboSign operation: ${operation}`, { itemIndex: i });
}
