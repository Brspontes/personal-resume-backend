import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Issuer } from 'openid-client';
import { LinkedinService } from './linkedin.service';

jest.mock('openid-client', () => ({
  Issuer: { discover: jest.fn() },
}));

describe('LinkedinService', () => {
  let service: LinkedinService;

  const authorizationUrlMock = jest.fn();
  const callbackParamsMock = jest.fn();
  const callbackMock = jest.fn();
  const userinfoMock = jest.fn();

  const fakeClientCtor = jest.fn().mockImplementation(() => ({
    authorizationUrl: authorizationUrlMock,
    callbackParams: callbackParamsMock,
    callback: callbackMock,
    userinfo: userinfoMock,
  }));

  beforeEach(async () => {
    jest.clearAllMocks();
    (Issuer.discover as jest.Mock).mockResolvedValue({
      Client: fakeClientCtor,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkedinService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string> = {
                LINKEDIN_CLIENT_ID: 'client-id',
                LINKEDIN_CLIENT_SECRET: 'client-secret',
                LINKEDIN_CALLBACK_URL:
                  'http://localhost:3000/api/v1/auth/linkedin/callback',
              };
              return values[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get(LinkedinService);
  });

  it('builds an authorization url with the openid profile email scope', async () => {
    authorizationUrlMock.mockReturnValue(
      'https://www.linkedin.com/oauth/v2/authorization?state=state-1',
    );

    const url = await service.buildAuthorizationUrl('state-1', 'nonce-1');

    expect(url).toBe(
      'https://www.linkedin.com/oauth/v2/authorization?state=state-1',
    );
    expect(authorizationUrlMock).toHaveBeenCalledWith({
      scope: 'openid profile email',
      state: 'state-1',
      nonce: 'nonce-1',
    });
  });

  it('maps a successful code exchange into a LinkedIn identity', async () => {
    callbackParamsMock.mockReturnValue({ code: 'abc' });
    callbackMock.mockResolvedValue({ access_token: 'token-123' });
    userinfoMock.mockResolvedValue({
      sub: 'li-1',
      name: 'Jane',
      picture: 'https://pic',
      email: 'jane@example.com',
    });

    const identity = await service.exchangeCodeForIdentity({} as never, {
      state: 's',
      nonce: 'n',
    });

    expect(identity).toEqual({
      sub: 'li-1',
      name: 'Jane',
      picture: 'https://pic',
      email: 'jane@example.com',
    });
  });

  it('throws Unauthorized when the token exchange fails', async () => {
    callbackParamsMock.mockReturnValue({ code: 'bad' });
    callbackMock.mockRejectedValue(new Error('invalid_grant'));

    await expect(
      service.exchangeCodeForIdentity({} as never, { state: 's', nonce: 'n' }),
    ).rejects.toThrow('Invalid LinkedIn authorization response');
  });

  it('throws BadGateway when retrieving the LinkedIn user info fails', async () => {
    callbackParamsMock.mockReturnValue({ code: 'abc' });
    callbackMock.mockResolvedValue({ access_token: 'token-123' });
    userinfoMock.mockRejectedValue(new Error('network error'));

    await expect(
      service.exchangeCodeForIdentity({} as never, { state: 's', nonce: 'n' }),
    ).rejects.toThrow('Failed to retrieve LinkedIn user information');
  });
});
