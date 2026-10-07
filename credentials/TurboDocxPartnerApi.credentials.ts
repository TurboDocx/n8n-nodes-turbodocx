import type { Icon } from 'n8n-workflow';
import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TurboDocxPartnerApi implements ICredentialType {
	name = 'turboDocxPartnerApi';
	displayName = 'TurboDocx Partner API';
	documentationUrl = 'https://docs.turbodocx.com';
	icon: Icon = {
		light: 'file:../nodes/TurboDocx/turbodocx.svg',
		dark: 'file:../nodes/TurboDocx/turbodocx.dark.svg',
	};
	properties: INodeProperties[] = [
		{
			displayName: 'Partner API Key',
			name: 'partnerApiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'Your TurboDocx Partner API key',
			hint: 'Partner API keys start with TDXP-',
		},
		{
			displayName: 'Partner ID',
			name: 'partnerId',
			type: 'string',
			default: '',
			required: true,
			description: 'Your TurboDocx Partner ID (UUID)',
			placeholder: 'e.g., 123e4567-e89b-12d3-a456-426614174000',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.turbodocx.com',
			required: true,
			description: 'The base URL for the TurboDocx API',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.partnerApiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '=/partner/{{$credentials.partnerId}}/organizations?limit=1',
			method: 'GET',
		},
	};
}
