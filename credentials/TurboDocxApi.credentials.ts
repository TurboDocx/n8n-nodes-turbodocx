import type { Icon } from 'n8n-workflow';
import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TurboDocxApi implements ICredentialType {
	name = 'turboDocxApi';
	displayName = 'TurboDocx API';
	documentationUrl = 'https://docs.turbodocx.com';
	icon: Icon = 'file:../nodes/TurboDocx/turbodocx.svg';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'Your TurboDocx API key',
		},
		{
			displayName: 'Organization ID',
			name: 'orgId',
			type: 'string',
			default: '',
			required: true,
			description: 'Your TurboDocx Organization ID (UUID)',
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
				Authorization: '=Bearer {{$credentials.apiKey}}',
				'x-rapiddocx-org-id': '={{$credentials.orgId}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/turbosign/documents/signature-documents?limit=1',
			method: 'GET',
		},
	};
}
