import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { turboSignFields, turboSignOperations } from '../TurboSign.description';

/**
 * The embedded-signing field and operation descriptions are the only documentation most n8n users
 * read, so they are pinned to the API's current contract:
 *  - a recipient without identity verification takes the org's default channel (API sends included);
 *  - an explicit channel other than the default is rejected with OtpOverrideNotAllowed when the org
 *    locked it (allowChannelOverride false);
 *  - sendEmail:false also suppresses reminder and expiry emails;
 *  - an empty allowedFrameAncestors denies framing everywhere;
 *  - only external_idv / override URLs are single-use; otp / no-verification links are reusable.
 */
const operationOptions = (turboSignOperations[0].options ?? []) as INodePropertyOptions[];
const operation = (value: string) => operationOptions.find((o) => o.value === value)!;
const field = (name: string) => turboSignFields.find((f) => f.name === name)!;

const recipientValues = (
	(field('embeddedRecipients').options ?? []) as Array<{ values: INodeProperties[] }>
)[0].values;
const recipientValue = (name: string) => recipientValues.find((v) => v.name === name)!;
const identityOption = (value: string) =>
	((recipientValue('identityVerification').options ?? []) as INodePropertyOptions[]).find(
		(o) => o.value === value,
	)!;

describe('TurboSign embedded-signing descriptions', () => {
	it('Get Embedded Signing Settings mentions allowChannelOverride and the empty-ancestors rule', () => {
		const description = operation('getEmbeddedSigningSettings').description ?? '';
		expect(description).toMatch(/allowChannelOverride/);
		expect(description).toMatch(/empty.*den/i);
	});

	it('Create Signing URL does not claim every URL is single-use', () => {
		const description = operation('createSigningUrl').description ?? '';
		expect(description).not.toMatch(/^Mint a single-use/);
	});

	it('the None identity option says the org default applies', () => {
		expect(identityOption('none').description).toMatch(/org(anization)?'s default/i);
	});

	it('the Email OTP and SMS OTP options name OtpOverrideNotAllowed', () => {
		expect(identityOption('emailOtp').description).toMatch(/OtpOverrideNotAllowed/);
		expect(identityOption('smsOtp').description).toMatch(/OtpOverrideNotAllowed/);
	});

	it('the phone field names OtpPhoneInvalid', () => {
		expect(recipientValue('phone').description).toMatch(/OtpPhoneInvalid/);
	});

	it('Send Email says reminder and expiry emails are suppressed too', () => {
		const description = field('embeddedSendEmail').description ?? '';
		expect(description).toMatch(/^Whether/);
		expect(description).toMatch(/reminder/i);
		expect(description).toMatch(/expir/i);
	});

	it('Identity Assertion lists the optional audit-trail keys', () => {
		const assertion = (
			(field('signingUrlOptions').options ?? []) as INodeProperties[]
		).find((o) => o.name === 'identityAssertion')!;
		for (const key of ['method', 'assuranceLevel', 'verifiedName', 'evidenceUrl', 'overrideEmailMatching']) {
			expect(assertion.description).toContain(key);
		}
	});

	it('no embedded-signing description contains an em-dash', () => {
		const embeddedOps = ['createEmbeddedSignature', 'createSigningUrl', 'getEmbeddedSigningSettings'];
		const embeddedFields = turboSignFields.filter((f) =>
			(f.displayOptions?.show?.operation as string[] | undefined)?.some((op) =>
				embeddedOps.includes(op),
			),
		);
		const text = JSON.stringify([embeddedOps.map(operation), embeddedFields]);
		expect(text).not.toContain('—');
	});
});
