import {
	IExecuteFunctions,
	INodeExecutionData,
	IDataObject,
	NodeOperationError,
} from 'n8n-workflow';
import {
	turboDocxApiRequest,
	fetchPresignedUrl,
	parseJsonParameter,
} from '../../shared/GenericFunctions';

const CONDITIONAL_OPERATORS = ['is_checked', 'is_not_checked'];
const CONDITIONAL_ACTIONS = ['show', 'unlock'];

/**
 * Lightweight SHAPE validation for conditional (IF/THEN) fields, mirroring the backend's
 * new 400 on `POST /turbosign/single/prepare-for-signing`. The `fields` parameter is a raw
 * JSON passthrough forwarded verbatim as a multipart part — so `metadata` reaches the backend
 * with zero serialization change and this only pre-flights the obviously malformed rules to
 * fail fast in the workflow rather than after a round-trip.
 *
 * A field carries a conditional rule under `metadata.conditional`:
 *   { controllingFieldKey: string, operator: "is_checked"|"is_not_checked", action: "show"|"unlock" }
 * where `controllingFieldKey` matches the `metadata.fieldKey` on some controlling checkbox.
 *
 * Deliberately does NOT throw on a DANGLING `controllingFieldKey` (one that names no existing
 * checkbox): the backend fails open by design, so a dangling ref is allowed.
 */
function validateConditionalFields(ctx: IExecuteFunctions, parsedFields: unknown, i: number): void {
	if (!Array.isArray(parsedFields)) return;

	for (const field of parsedFields) {
		if (!field || typeof field !== 'object') continue;
		const metadata = (field as IDataObject).metadata;
		if (!metadata || typeof metadata !== 'object') continue;
		const conditional = (metadata as IDataObject).conditional;
		if (!conditional || typeof conditional !== 'object') continue;

		const { controllingFieldKey, operator, action } = conditional as IDataObject;

		if (typeof controllingFieldKey !== 'string' || controllingFieldKey.trim() === '') {
			throw new NodeOperationError(
				ctx.getNode(),
				'A conditional field is missing metadata.conditional.controllingFieldKey. Set it to the metadata.fieldKey of the controlling checkbox.\n\nHTTP Status: 400',
				{ itemIndex: i },
			);
		}
		if (typeof operator !== 'string' || !CONDITIONAL_OPERATORS.includes(operator)) {
			throw new NodeOperationError(
				ctx.getNode(),
				`Invalid metadata.conditional.operator "${String(operator)}". Must be one of: ${CONDITIONAL_OPERATORS.join(', ')}.\n\nHTTP Status: 400`,
				{ itemIndex: i },
			);
		}
		if (typeof action !== 'string' || !CONDITIONAL_ACTIONS.includes(action)) {
			throw new NodeOperationError(
				ctx.getNode(),
				`Invalid metadata.conditional.action "${String(action)}". Must be one of: ${CONDITIONAL_ACTIONS.join(', ')}.\n\nHTTP Status: 400`,
				{ itemIndex: i },
			);
		}
	}
}

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

/** Copy the optional document/sender/cc fields from the Additional Fields collection onto the body. */
function attachAdditionalFields(
	requestBody: ITurboSignRequestBody,
	additionalFields: ITurboSignAdditionalFields,
): void {
	if (additionalFields.documentName) requestBody.documentName = additionalFields.documentName;
	if (additionalFields.documentDescription)
		requestBody.documentDescription = additionalFields.documentDescription;
	if (additionalFields.senderName) requestBody.senderName = additionalFields.senderName;
	if (additionalFields.senderEmail) requestBody.senderEmail = additionalFields.senderEmail;
	if (additionalFields.ccEmails && additionalFields.ccEmails !== '')
		requestBody.ccEmails = additionalFields.ccEmails;
}

/** Resolve the chosen File Input Method into the matching body field (binary part / link / id). */
async function attachFileInput(
	ctx: IExecuteFunctions,
	i: number,
	requestBody: ITurboSignRequestBody,
): Promise<void> {
	const fileInputMethod = ctx.getNodeParameter('fileInputMethod', i) as string;

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
}

/** Build the multipart/JSON body shared by prepareForReview and prepareForSigning. */
async function buildPrepareBody(ctx: IExecuteFunctions, i: number): Promise<ITurboSignRequestBody> {
	const recipients = ctx.getNodeParameter('recipients', i) as string;
	const fields = ctx.getNodeParameter('fields', i) as string;
	const additionalFields = ctx.getNodeParameter(
		'additionalFields',
		i,
		{},
	) as ITurboSignAdditionalFields;

	// Shape-check any conditional (IF/THEN) rules before the round-trip. `fields` itself is
	// still forwarded verbatim as a multipart part below — this parse is validation-only and
	// does not alter what reaches the backend.
	validateConditionalFields(ctx, parseJsonParameter(ctx, fields, 'fields', i), i);

	const requestBody: ITurboSignRequestBody = {
		recipients,
		fields,
	};
	attachAdditionalFields(requestBody, additionalFields);
	await attachFileInput(ctx, i, requestBody);

	return requestBody;
}

// ===============================
// Embedded signing helpers (mirror the SDK's TurboSign.createEmbeddedSignature)
// ===============================

/**
 * Shorthand anchor key → the concrete signature field type it emits plus its default size.
 * Mirrors the SDK's EMBEDDED_FIELD_SPECS. Note `initials` maps to the `'initial'` field type
 * (there is no `'initials'` literal in the API's field-type union).
 */
const EMBEDDED_FIELD_SPECS: Record<
	'signature' | 'date' | 'initials' | 'fullName',
	{ type: string; size: { width: number; height: number } }
> = {
	signature: { type: 'signature', size: { width: 100, height: 30 } },
	date: { type: 'date', size: { width: 75, height: 30 } },
	initials: { type: 'initial', size: { width: 50, height: 30 } },
	fullName: { type: 'full_name', size: { width: 150, height: 30 } },
};

/** One recipient row from the Create Embedded Signature fixedCollection. */
interface IEmbeddedRecipientRow {
	name?: string;
	email?: string;
	identityVerification?: 'none' | 'emailOtp' | 'smsOtp' | 'externalIdv' | 'override';
	phone?: string;
	provider?: string;
	reason?: string;
	signingOrder?: number;
	signature?: string;
	date?: string;
	initials?: string;
	fullName?: string;
}

/** A full recipient object as the prepare-for-signing `recipients` JSON expects it. */
interface IMappedRecipient extends IDataObject {
	name: string;
	email: string;
	signingOrder: number;
	phone?: string;
	identityVerification?: IDataObject;
}

/**
 * Map an ergonomic recipient row's identity/OTP choice to the API's identityVerification block.
 *
 * The OTP itself is entered by the SIGNER in the browser on the signing page — the org API key
 * cannot verify an OTP on the recipient's behalf, so this only configures the channel. The pending
 * OTP step is then reported back by Create Signing URL as `pendingChecks`.
 *
 * Validation mirrors the SDK's validateRecipientsIdentity: SMS OTP needs a phone, external IDV needs
 * a provider, and override needs a reason.
 */
function resolveEmbeddedIdentity(
	ctx: IExecuteFunctions,
	row: IEmbeddedRecipientRow,
	i: number,
): IDataObject | undefined {
	const mode = row.identityVerification ?? 'none';
	const email = row.email ?? '';
	if (mode === 'none') return undefined;
	if (mode === 'emailOtp') return { mode: 'otp', channel: 'email' };
	if (mode === 'smsOtp') {
		if (!row.phone || row.phone.trim() === '') {
			throw new NodeOperationError(
				ctx.getNode(),
				`Recipient "${email}" uses SMS OTP but has no phone number. Add an E.164 phone (e.g. +13055551234).\n\nHTTP Status: 400`,
				{ itemIndex: i },
			);
		}
		return { mode: 'otp', channel: 'sms' };
	}
	if (mode === 'externalIdv') {
		if (!row.provider || row.provider.trim() === '') {
			throw new NodeOperationError(
				ctx.getNode(),
				`Recipient "${email}" uses External IDV but has no provider. Set the IDV Provider name.\n\nHTTP Status: 400`,
				{ itemIndex: i },
			);
		}
		return { mode: 'external_idv', provider: row.provider.trim() };
	}
	// override
	if (!row.reason || row.reason.trim() === '') {
		throw new NodeOperationError(
			ctx.getNode(),
			`Recipient "${email}" uses Override but has no reason. A non-empty reason is required to skip identity verification.\n\nHTTP Status: 400`,
			{ itemIndex: i },
		);
	}
	return { mode: 'override', overrideIdentityVerification: true, reason: row.reason.trim() };
}

/** Expand a recipient row's anchor shorthand into full signature-field objects. */
function expandRecipientFields(row: IEmbeddedRecipientRow): IDataObject[] {
	const fields: IDataObject[] = [];
	for (const key of Object.keys(EMBEDDED_FIELD_SPECS) as Array<keyof typeof EMBEDDED_FIELD_SPECS>) {
		const anchor = row[key];
		if (!anchor) continue;
		const spec = EMBEDDED_FIELD_SPECS[key];
		fields.push({
			type: spec.type,
			recipientEmail: row.email,
			template: { anchor, placement: 'replace', size: spec.size },
		});
	}
	return fields;
}

/**
 * Backend refusal codes where the document WAS sent but this recipient's embed URL cannot be minted
 * in this one-call flow — a per-recipient "not yet", not a failure. Degrade to a null URL + status
 * so the caller re-mints later with Create Signing URL rather than the whole operation throwing.
 *
 *  - RecipientNotInTurn / NotSignersTurn: an earlier signer hasn't finished (sequential order).
 *  - RecipientAlreadySigned: this recipient already signed.
 *  - IdentityAssertionRequired: an external_idv recipient needs an identity assertion, which only
 *    Create Signing URL accepts — this one-call flow has none to supply.
 *  - ExternalIdvNotAllowed / IdentityOverrideNotAllowed: the org gate for that mode is off; mint the
 *    URL after enabling it (see Get Embedded Signing Settings).
 */
const NOT_YET_MINTABLE_CODES = [
	'RecipientNotInTurn',
	'NotSignersTurn',
	'RecipientAlreadySigned',
	'IdentityAssertionRequired',
	'ExternalIdvNotAllowed',
	'IdentityOverrideNotAllowed',
];

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
		const binaryData = await ctx.helpers.prepareBinaryData(buffer, fileName, 'application/pdf');
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
			{
				method: 'GET',
				endpoint: `/turbosign/documents/${documentId}/audit-trail`,
				unwrap: 'smart',
			},
			i,
		);
		return [{ json: result }];
	}

	// Mint a single-use embedded signing URL for one recipient of an already-sent document.
	// The endpoint replies `{ data: { results } }`, so unwrap to `results` (mirrors the SDK).
	// `pendingChecks` (e.g. email_otp / sms_otp) tells the workflow the signer must clear an OTP
	// in the browser before signing — the org API key does NOT verify the OTP on their behalf.
	if (operation === 'createSigningUrl') {
		const documentId = ctx.getNodeParameter('documentId', i) as string;
		const selector = ctx.getNodeParameter('recipientSelector', i) as 'recipientId' | 'externalId';
		const value = (ctx.getNodeParameter('recipientSelectorValue', i) as string) ?? '';
		const options = ctx.getNodeParameter('signingUrlOptions', i, {}) as {
			returnUrl?: string;
			identityAssertion?: string;
		};

		if (value.trim() === '') {
			throw new NodeOperationError(
				ctx.getNode(),
				'The Recipient Identifier is required. Provide exactly one of recipientId or externalId (chosen by "Select Recipient By").\n\nHTTP Status: 400',
				{ itemIndex: i },
			);
		}

		const body: IDataObject = { [selector]: value.trim() };

		if (options.returnUrl && options.returnUrl.trim() !== '') {
			if (!/^https:\/\//i.test(options.returnUrl.trim())) {
				throw new NodeOperationError(
					ctx.getNode(),
					'Return URL must be an https URL.\n\nHTTP Status: 400',
					{ itemIndex: i },
				);
			}
			body.returnUrl = options.returnUrl.trim();
		}

		if (options.identityAssertion && options.identityAssertion !== '') {
			const parsed = parseJsonParameter(ctx, options.identityAssertion, 'identityAssertion', i);
			if (parsed !== undefined) body.identityAssertion = parsed as IDataObject;
		}

		const result = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: `/turbosign/documents/${documentId}/signing-url`,
				body,
				unwrap: 'results',
			},
			i,
		);
		return [{ json: result }];
	}

	// Read the org's embedded-signing gates. `{ data: { results } }` → unwrap to `results`.
	if (operation === 'getEmbeddedSigningSettings') {
		const result = await turboDocxApiRequest(
			ctx,
			{ method: 'GET', endpoint: '/turbosign/embedded-signing-settings', unwrap: 'results' },
			i,
		);
		return [{ json: result }];
	}

	// Send a document AND mint a per-recipient embedded signing URL in one operation — the n8n
	// counterpart of the SDK's TurboSign.createEmbeddedSignature. Two-phase, like Download Document:
	//   1. POST prepare-for-signing (sendEmail defaults false: the host owns the signing UX).
	//   2. For each recipient IN SIGNING ORDER, POST signing-url to mint their embed URL.
	// Turn-aware: the backend refuses to mint a URL for a signer whose turn hasn't come
	// (RecipientNotInTurn) or who already signed (RecipientAlreadySigned). Those are expected
	// states, not failures — the recipient is returned with embedUrl:null and status pending/completed
	// so the caller can re-mint later with Create Signing URL. Any other error propagates.
	if (operation === 'createEmbeddedSignature') {
		const collection = ctx.getNodeParameter('embeddedRecipients', i, {}) as {
			recipient?: IEmbeddedRecipientRow[];
		};
		const rows = collection.recipient ?? [];
		if (rows.length === 0) {
			throw new NodeOperationError(
				ctx.getNode(),
				'At least one recipient is required for Create Embedded Signature.\n\nHTTP Status: 400',
				{ itemIndex: i },
			);
		}

		// 1. Map each row to a full recipient (identity + phone + order).
		const mappedRecipients: IMappedRecipient[] = rows.map((row, index) => {
			const identityVerification = resolveEmbeddedIdentity(ctx, row, i);
			const recipient: IMappedRecipient = {
				name: row.name ?? '',
				email: row.email ?? '',
				signingOrder: row.signingOrder && row.signingOrder > 0 ? row.signingOrder : index + 1,
			};
			if (row.phone && row.phone.trim() !== '') recipient.phone = row.phone.trim();
			if (identityVerification) recipient.identityVerification = identityVerification;
			return recipient;
		});

		// Full fields override (when provided) wins verbatim; otherwise expand each row's shorthand.
		const embeddedFieldsRaw = ctx.getNodeParameter('embeddedFields', i, '') as string;
		let fields: IDataObject[];
		if (embeddedFieldsRaw && embeddedFieldsRaw !== '') {
			const parsed = parseJsonParameter(ctx, embeddedFieldsRaw, 'embeddedFields', i);
			if (!Array.isArray(parsed)) {
				throw new NodeOperationError(
					ctx.getNode(),
					'Fields (Advanced Override) must be a JSON array of field objects.\n\nHTTP Status: 400',
					{ itemIndex: i },
				);
			}
			fields = parsed as IDataObject[];
		} else {
			fields = rows.flatMap((row) => expandRecipientFields(row));
		}

		const sendEmail = ctx.getNodeParameter('embeddedSendEmail', i, false) as boolean;
		const returnUrl = (ctx.getNodeParameter('embeddedReturnUrl', i, '') as string).trim();
		if (returnUrl !== '' && !/^https:\/\//i.test(returnUrl)) {
			throw new NodeOperationError(
				ctx.getNode(),
				'Return URL must be an https URL.\n\nHTTP Status: 400',
				{ itemIndex: i },
			);
		}
		const additionalFields = ctx.getNodeParameter(
			'additionalFields',
			i,
			{},
		) as ITurboSignAdditionalFields;

		// Build + send the signature request (multipart when a file is uploaded, else JSON).
		const sendBody: ITurboSignRequestBody = {
			recipients: JSON.stringify(mappedRecipients),
			fields: JSON.stringify(fields),
			sendEmail,
		};
		attachAdditionalFields(sendBody, additionalFields);
		await attachFileInput(ctx, i, sendBody);

		const sent = await turboDocxApiRequest(
			ctx,
			{
				method: 'POST',
				endpoint: '/turbosign/single/prepare-for-signing',
				body: sendBody,
				multipart: sendBody.file !== undefined,
			},
			i,
		);

		const documentId = sent.documentId as string;
		const sentRecipients = (sent.recipients as Array<{ id: string; email: string }>) ?? [];
		const recipientIdByEmail = new Map(sentRecipients.map((r) => [r.email, r.id]));

		// 2. Mint one embed URL per recipient, assembled IN SIGNING ORDER.
		const ordered = [...mappedRecipients].sort((a, b) => a.signingOrder - b.signingOrder);
		const resultRecipients: IDataObject[] = [];

		for (const recipient of ordered) {
			const recipientId = recipientIdByEmail.get(recipient.email);
			if (!recipientId) {
				throw new NodeOperationError(
					ctx.getNode(),
					`The document was created and sent (documentId ${documentId}), but its send response did not include a recipient matching "${recipient.email}", so an embed URL cannot be minted.\n\nHTTP Status: 500`,
					{ itemIndex: i },
				);
			}

			const urlBody: IDataObject = { recipientId };
			if (returnUrl !== '') urlBody.returnUrl = returnUrl;

			try {
				const link = await turboDocxApiRequest(
					ctx,
					{
						method: 'POST',
						endpoint: `/turbosign/documents/${documentId}/signing-url`,
						body: urlBody,
						unwrap: 'results',
					},
					i,
				);
				resultRecipients.push({
					recipientId,
					name: recipient.name,
					email: recipient.email,
					embedUrl: link.url ?? null,
					status: 'ready',
					identityVerificationMode: link.identityVerificationMode ?? null,
					pendingChecks: link.pendingChecks ?? [],
				});
			} catch (err) {
				const code = (err as { code?: string }).code ?? '';
				if (!NOT_YET_MINTABLE_CODES.includes(code)) {
					// The document WAS created and sent — surface its id so the workflow can void it or
					// mint the remaining URLs with Create Signing URL, rather than losing that fact.
					const reason = (err as { message?: string }).message ?? String(err);
					throw new NodeOperationError(
						ctx.getNode(),
						`The document was created and sent (documentId ${documentId}), but minting the embed URL for "${recipient.email}" failed: ${reason}`,
						{ itemIndex: i },
					);
				}
				resultRecipients.push({
					recipientId,
					name: recipient.name,
					email: recipient.email,
					embedUrl: null,
					status: code === 'RecipientAlreadySigned' ? 'completed' : 'pending',
					identityVerificationMode: (recipient.identityVerification?.mode as string) ?? null,
					pendingChecks: [],
				});
			}
		}

		return [{ json: { documentId, recipients: resultRecipients } }];
	}

	throw new NodeOperationError(ctx.getNode(), `Unknown TurboSign operation: ${operation}`, {
		itemIndex: i,
	});
}
