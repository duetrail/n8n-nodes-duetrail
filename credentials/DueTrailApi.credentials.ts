import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

/**
 * Workspace API key for the DueTrail public API.
 *
 * The key is created in DueTrail under Settings → API keys and sent as a
 * bearer token, which is what the Go service's APIKeyAuth middleware expects.
 * The base URL is duetrail.com rather than the API service directly: the Go
 * service is internal-only, and the documented public path is what stays
 * stable for published connectors.
 */
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

  // /me is the designated credential check: two cheap reads, no business data.
  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/me',
      method: 'GET',
    },
  };
}
