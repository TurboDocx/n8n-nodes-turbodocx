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
			description: 'Your TurboDocx API key (JWT token from Auth0)',
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
