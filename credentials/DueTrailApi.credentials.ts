import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

/** Workspace API key, created in DueTrail under Settings → API keys. */
export class DueTrailApi implements ICredentialType {
  name = 'dueTrailApi';

  displayName = 'DueTrail API';

  documentationUrl = 'https://duetrail.com/developers';

  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Create one in DueTrail under Settings → API keys. It is shown once.',
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://duetrail.com/api/public/v1',
      description: 'Change only if you run DueTrail on your own domain',
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
      url: '/me',
      method: 'GET',
    },
  };
}
