import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { LinkedinIdentity } from './../src/linkedin/linkedin-identity.interface';
import { LinkedinService } from './../src/linkedin/linkedin.service';
import { PrismaService } from './../src/prisma/prisma.service';

interface FakeUser {
  id: string;
  linkedinId: string;
  name: string;
  avatarUrl?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

class FakePrismaService {
  onModuleInit = jest.fn();
  onModuleDestroy = jest.fn();

  private readonly usersByLinkedinId = new Map<string, FakeUser>();
  private readonly usersById = new Map<string, FakeUser>();
  private idCounter = 0;

  user = {
    upsert: jest.fn(
      async ({
        where,
        update,
        create,
      }: {
        where: { linkedinId: string };
        update: Partial<FakeUser>;
        create: Omit<FakeUser, 'id' | 'createdAt' | 'updatedAt'>;
      }): Promise<FakeUser> => {
        const existing = this.usersByLinkedinId.get(where.linkedinId);
        if (existing) {
          const updated: FakeUser = {
            ...existing,
            ...update,
            updatedAt: new Date(),
          };
          this.usersByLinkedinId.set(where.linkedinId, updated);
          this.usersById.set(updated.id, updated);
          return updated;
        }

        const id = `user-${++this.idCounter}`;
        const createdUser: FakeUser = {
          id,
          ...create,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.usersByLinkedinId.set(where.linkedinId, createdUser);
        this.usersById.set(id, createdUser);
        return createdUser;
      },
    ),
    findUnique: jest.fn(
      async ({
        where,
      }: {
        where: { id: string };
      }): Promise<FakeUser | null> => {
        return this.usersById.get(where.id) ?? null;
      },
    ),
  };
}

describe('Auth via LinkedIn (e2e)', () => {
  let app: INestApplication;
  const exchangeCodeForIdentityMock = jest.fn<
    Promise<LinkedinIdentity>,
    unknown[]
  >();
  const buildAuthorizationUrlMock = jest.fn<Promise<string>, unknown[]>();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(new FakePrismaService())
      .overrideProvider(LinkedinService)
      .useValue({
        buildAuthorizationUrl: buildAuthorizationUrlMock,
        exchangeCodeForIdentity: exchangeCodeForIdentityMock,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    exchangeCodeForIdentityMock.mockReset();
    buildAuthorizationUrlMock.mockReset();
  });

  describe('GET /api/v1/auth/linkedin', () => {
    it('redirects to the LinkedIn authorization url and sets state/nonce cookies', async () => {
      buildAuthorizationUrlMock.mockResolvedValue(
        'https://www.linkedin.com/oauth/v2/authorization?state=abc',
      );

      const res = await request(app.getHttpServer()).get(
        '/api/v1/auth/linkedin',
      );

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        'https://www.linkedin.com/oauth/v2/authorization?state=abc',
      );
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c) => c.startsWith('oidc_state='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('oidc_nonce='))).toBe(true);
    });
  });

  describe('GET /api/v1/auth/linkedin/callback', () => {
    it('rejects when LinkedIn reports an authorization error', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/auth/linkedin/callback?error=access_denied',
      );

      expect(res.status).toBe(401);
      expect(exchangeCodeForIdentityMock).not.toHaveBeenCalled();
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('rejects when the OIDC state cookie is missing', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/auth/linkedin/callback?code=abc123',
      );

      expect(res.status).toBe(401);
      expect(exchangeCodeForIdentityMock).not.toHaveBeenCalled();
    });

    it('rejects and does not set a session cookie when the code exchange fails', async () => {
      buildAuthorizationUrlMock.mockResolvedValue(
        'https://linkedin.example/authorize',
      );
      exchangeCodeForIdentityMock.mockRejectedValue(
        new UnauthorizedException('Invalid LinkedIn authorization response'),
      );

      const agent = request.agent(app.getHttpServer());
      await agent.get('/api/v1/auth/linkedin');

      const res = await agent.get(
        '/api/v1/auth/linkedin/callback?code=bad-code',
      );

      expect(res.status).toBe(401);
      const cookies = (res.headers['set-cookie'] as unknown as string[]) ?? [];
      expect(cookies.some((c) => c.startsWith('session='))).toBe(false);
    });

    it('establishes a session and redirects to FRONTEND_URL on success', async () => {
      buildAuthorizationUrlMock.mockResolvedValue(
        'https://linkedin.example/authorize',
      );
      exchangeCodeForIdentityMock.mockResolvedValue({
        sub: 'li-1',
        name: 'Jane Doe',
        picture: 'https://pic',
        email: 'jane@example.com',
      });

      const agent = request.agent(app.getHttpServer());
      await agent.get('/api/v1/auth/linkedin');

      const res = await agent.get(
        '/api/v1/auth/linkedin/callback?code=good-code',
      );

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('http://localhost:4200');
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c) => c.startsWith('session='))).toBe(true);
    });

    it('preserves a safe returnTo through the full round-trip', async () => {
      buildAuthorizationUrlMock.mockResolvedValue(
        'https://linkedin.example/authorize',
      );
      exchangeCodeForIdentityMock.mockResolvedValue({
        sub: 'li-return-to',
        name: 'Return To User',
      });

      const agent = request.agent(app.getHttpServer());
      await agent.get('/api/v1/auth/linkedin?returnTo=%2Farticles%2Fsome-slug');

      const res = await agent.get(
        '/api/v1/auth/linkedin/callback?code=good-code',
      );

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        'http://localhost:4200/articles/some-slug',
      );
    });

    it('falls back to bare FRONTEND_URL when returnTo is an absolute URL', async () => {
      buildAuthorizationUrlMock.mockResolvedValue(
        'https://linkedin.example/authorize',
      );
      exchangeCodeForIdentityMock.mockResolvedValue({
        sub: 'li-unsafe-return-to',
        name: 'Unsafe Return To User',
      });

      const agent = request.agent(app.getHttpServer());
      await agent.get(
        '/api/v1/auth/linkedin?returnTo=' +
          encodeURIComponent('https://evil.example'),
      );

      const res = await agent.get(
        '/api/v1/auth/linkedin/callback?code=good-code',
      );

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('http://localhost:4200');
    });

    it('falls back to bare FRONTEND_URL when returnTo is protocol-relative', async () => {
      buildAuthorizationUrlMock.mockResolvedValue(
        'https://linkedin.example/authorize',
      );
      exchangeCodeForIdentityMock.mockResolvedValue({
        sub: 'li-protocol-relative',
        name: 'Protocol Relative User',
      });

      const agent = request.agent(app.getHttpServer());
      await agent.get(
        '/api/v1/auth/linkedin?returnTo=' +
          encodeURIComponent('//evil.example'),
      );

      const res = await agent.get(
        '/api/v1/auth/linkedin/callback?code=good-code',
      );

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('http://localhost:4200');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 without a session cookie', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('returns the authenticated user with a valid session cookie', async () => {
      buildAuthorizationUrlMock.mockResolvedValue(
        'https://linkedin.example/authorize',
      );
      exchangeCodeForIdentityMock.mockResolvedValue({
        sub: 'li-2',
        name: 'John Roe',
        picture: 'https://pic2',
        email: 'john@example.com',
      });

      const agent = request.agent(app.getHttpServer());
      await agent.get('/api/v1/auth/linkedin');
      await agent.get('/api/v1/auth/linkedin/callback?code=good-code');

      const res = await agent.get('/api/v1/auth/me');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        name: 'John Roe',
        avatarUrl: 'https://pic2',
        email: 'john@example.com',
      });
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('clears the session so a subsequent /auth/me call returns 401', async () => {
      buildAuthorizationUrlMock.mockResolvedValue(
        'https://linkedin.example/authorize',
      );
      exchangeCodeForIdentityMock.mockResolvedValue({
        sub: 'li-3',
        name: 'Ada Lovelace',
      });

      const agent = request.agent(app.getHttpServer());
      await agent.get('/api/v1/auth/linkedin');
      await agent.get('/api/v1/auth/linkedin/callback?code=good-code');

      await agent.get('/api/v1/auth/me').expect(200);

      await agent.post('/api/v1/auth/logout').expect(204);

      await agent.get('/api/v1/auth/me').expect(401);
    });
  });
});
