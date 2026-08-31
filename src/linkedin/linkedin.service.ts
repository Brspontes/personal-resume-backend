import {
  BadGatewayException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Client } from 'openid-client';
import { Issuer } from 'openid-client';
import { LinkedinIdentity } from './linkedin-identity.interface';

export interface LinkedinCallbackChecks {
  state: string;
  // Accepted but not enforced against the ID token - LinkedIn never echoes the nonce claim back.
  nonce: string;
}

const LINKEDIN_ISSUER_URL = 'https://www.linkedin.com/oauth';
const LINKEDIN_SCOPE = 'openid profile email';

@Injectable()
export class LinkedinService {
  private readonly logger = new Logger(LinkedinService.name);
  private clientPromise?: Promise<Client>;

  constructor(private readonly configService: ConfigService) {}

  async buildAuthorizationUrl(state: string, nonce: string): Promise<string> {
    const client = await this.getClient();
    return client.authorizationUrl({
      scope: LINKEDIN_SCOPE,
      state,
      nonce,
    });
  }

  async exchangeCodeForIdentity(
    req: Request,
    checks: LinkedinCallbackChecks,
  ): Promise<LinkedinIdentity> {
    const client = await this.getClient();
    const callbackUrl = this.configService.get<string>(
      'LINKEDIN_CALLBACK_URL',
    ) as string;
    const params = client.callbackParams(req);

    let tokenSet;
    try {
      tokenSet = await client.callback(callbackUrl, params, {
        state: checks.state,
      });
    } catch (err) {
      this.logger.warn(
        `LinkedIn token exchange failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new UnauthorizedException(
        'Invalid LinkedIn authorization response',
      );
    }

    if (!tokenSet.access_token) {
      throw new UnauthorizedException(
        'LinkedIn did not return an access token',
      );
    }

    let userinfo;
    try {
      userinfo = await client.userinfo(tokenSet.access_token);
    } catch (err) {
      this.logger.warn(
        `LinkedIn userinfo request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadGatewayException(
        'Failed to retrieve LinkedIn user information',
      );
    }

    if (!userinfo.sub) {
      throw new UnauthorizedException(
        'LinkedIn identity is missing a subject identifier',
      );
    }

    return {
      sub: userinfo.sub,
      name: userinfo.name ?? '',
      picture: userinfo.picture,
      email: userinfo.email,
    };
  }

  private getClient(): Promise<Client> {
    if (!this.clientPromise) {
      this.clientPromise = this.discoverClient();
    }
    return this.clientPromise;
  }

  private async discoverClient(): Promise<Client> {
    try {
      const issuer = await Issuer.discover(LINKEDIN_ISSUER_URL);
      return new issuer.Client({
        client_id: this.configService.get<string>(
          'LINKEDIN_CLIENT_ID',
        ) as string,
        client_secret: this.configService.get<string>(
          'LINKEDIN_CLIENT_SECRET',
        ) as string,
        redirect_uris: [
          this.configService.get<string>('LINKEDIN_CALLBACK_URL') as string,
        ],
        response_types: ['code'],
        // LinkedIn's token endpoint only accepts the client secret in the
        // POST body, not via HTTP Basic auth (openid-client's default).
        token_endpoint_auth_method: 'client_secret_post',
      });
    } catch (err) {
      this.logger.warn(
        `LinkedIn OIDC discovery failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadGatewayException('Unable to reach LinkedIn');
    }
  }
}
