import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
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

interface FakeAnalyticsEvent {
  id: string;
  articleId: string;
  eventType: string;
  sessionId: string;
  userId: string | null;
  progress?: number;
  durationSeconds?: number;
  maxProgress?: number;
  createdAt: Date;
}

class FakePrismaService {
  onModuleInit = jest.fn();
  onModuleDestroy = jest.fn();

  private readonly usersByLinkedinId = new Map<string, FakeUser>();
  private readonly usersById = new Map<string, FakeUser>();
  private userIdCounter = 0;

  readonly analyticsEvents: FakeAnalyticsEvent[] = [];
  private eventIdCounter = 0;

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
        const id = `user-${++this.userIdCounter}`;
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
      async ({ where }: { where: { id: string } }): Promise<FakeUser | null> =>
        this.usersById.get(where.id) ?? null,
    ),
  };

  analyticsEvent = {
    create: jest.fn(
      async ({
        data,
      }: {
        data: Omit<FakeAnalyticsEvent, 'id' | 'createdAt'>;
      }): Promise<FakeAnalyticsEvent> => {
        const event: FakeAnalyticsEvent = {
          id: `event-${++this.eventIdCounter}`,
          ...data,
          createdAt: new Date(),
        };
        this.analyticsEvents.push(event);
        return event;
      },
    ),
    findFirst: jest.fn(
      async ({
        where,
      }: {
        where: {
          articleId: string;
          sessionId: string;
          eventType: string;
          createdAt?: { gte: Date };
          progress?: number;
        };
      }): Promise<FakeAnalyticsEvent | null> => {
        const match = this.analyticsEvents.find((event) => {
          if (event.articleId !== where.articleId) return false;
          if (event.sessionId !== where.sessionId) return false;
          if (event.eventType !== where.eventType) return false;
          if (where.createdAt && event.createdAt < where.createdAt.gte) {
            return false;
          }
          if (
            where.progress !== undefined &&
            event.progress !== where.progress
          ) {
            return false;
          }
          return true;
        });
        return match ?? null;
      },
    ),
  };
}

describe('Article Analytics (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrismaService;
  const exchangeCodeForIdentityMock = jest.fn<
    Promise<LinkedinIdentity>,
    unknown[]
  >();
  const buildAuthorizationUrlMock = jest.fn<Promise<string>, unknown[]>();

  beforeAll(async () => {
    prisma = new FakePrismaService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(LinkedinService)
      .useValue({
        buildAuthorizationUrl: buildAuthorizationUrlMock,
        exchangeCodeForIdentity: exchangeCodeForIdentityMock,
      })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
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

    buildAuthorizationUrlMock.mockResolvedValue(
      'https://linkedin.example/authorize',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginAs(sub: string, name: string) {
    const agent = request.agent(app.getHttpServer());
    exchangeCodeForIdentityMock.mockResolvedValueOnce({ sub, name });
    await agent.get('/api/v1/auth/linkedin');
    await agent.get('/api/v1/auth/linkedin/callback?code=good-code');
    return agent;
  }

  describe('POST /api/v1/analytics/events', () => {
    it('accepts an anonymous ARTICLE_VIEW event without a session cookie', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          event: 'ARTICLE_VIEW',
          articleId: 'article-anon-1',
          sessionId: 'session-anon-1',
        })
        .expect(204);

      const event = prisma.analyticsEvents.find(
        (e) => e.articleId === 'article-anon-1',
      );
      expect(event).toBeDefined();
      expect(event?.userId).toBeNull();
    });

    it('accepts an ARTICLE_PROGRESS event', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          event: 'ARTICLE_PROGRESS',
          articleId: 'article-progress-1',
          sessionId: 'session-progress-1',
          progress: 50,
        })
        .expect(204);

      const event = prisma.analyticsEvents.find(
        (e) => e.articleId === 'article-progress-1',
      );
      expect(event?.progress).toBe(50);
    });

    it('accepts an ARTICLE_READ event', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          event: 'ARTICLE_READ',
          articleId: 'article-read-1',
          sessionId: 'session-read-1',
          duration: 248,
          maxProgress: 87,
        })
        .expect(204);

      const event = prisma.analyticsEvents.find(
        (e) => e.articleId === 'article-read-1',
      );
      expect(event?.durationSeconds).toBe(248);
      expect(event?.maxProgress).toBe(87);
    });

    it('associates the event with the authenticated user when a valid session is present', async () => {
      const agent = await loginAs('li-analytics-1', 'Reader One');

      await agent
        .post('/api/v1/analytics/events')
        .send({
          event: 'ARTICLE_VIEW',
          articleId: 'article-auth-1',
          sessionId: 'session-auth-1',
        })
        .expect(204);

      const event = prisma.analyticsEvents.find(
        (e) => e.articleId === 'article-auth-1',
      );
      expect(event?.userId).toBeDefined();
      expect(event?.userId).not.toBeNull();
    });

    it('rejects a malformed payload with an unsupported event type', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          event: 'ARTICLE_DELETE',
          articleId: 'article-bad-1',
          sessionId: 'session-bad-1',
        })
        .expect(400);
    });

    it('rejects an ARTICLE_READ event with a negative duration', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          event: 'ARTICLE_READ',
          articleId: 'article-bad-2',
          sessionId: 'session-bad-2',
          duration: -10,
          maxProgress: 50,
        })
        .expect(400);
    });

    it('does not expose authentication details in the response', async () => {
      const agent = await loginAs('li-analytics-2', 'Reader Two');

      const res = await agent.post('/api/v1/analytics/events').send({
        event: 'ARTICLE_VIEW',
        articleId: 'article-noauth-1',
        sessionId: 'session-noauth-1',
      });

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('rejects an oversized payload', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          event: 'ARTICLE_VIEW',
          articleId: 'a'.repeat(2 * 1024 * 1024),
          sessionId: 'session-oversized-1',
        })
        .expect((res) => {
          expect(res.status).toBeGreaterThanOrEqual(400);
          expect(res.status).toBeLessThan(500);
        });
    });
  });

  describe('View deduplication', () => {
    it('records only one event for two views within the dedup window', async () => {
      const payload = {
        event: 'ARTICLE_VIEW',
        articleId: 'article-dedup-view-1',
        sessionId: 'session-dedup-view-1',
      };

      await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send(payload)
        .expect(204);
      await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send(payload)
        .expect(204);

      const events = prisma.analyticsEvents.filter(
        (e) => e.articleId === 'article-dedup-view-1',
      );
      expect(events).toHaveLength(1);
    });
  });

  describe('Progress deduplication', () => {
    it('ignores a repeated milestone but records a new one', async () => {
      const articleId = 'article-dedup-progress-1';
      const sessionId = 'session-dedup-progress-1';

      await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          event: 'ARTICLE_PROGRESS',
          articleId,
          sessionId,
          progress: 25,
        })
        .expect(204);
      await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          event: 'ARTICLE_PROGRESS',
          articleId,
          sessionId,
          progress: 25,
        })
        .expect(204);
      await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          event: 'ARTICLE_PROGRESS',
          articleId,
          sessionId,
          progress: 50,
        })
        .expect(204);

      const events = prisma.analyticsEvents.filter(
        (e) => e.articleId === articleId,
      );
      expect(events).toHaveLength(2);
      expect(events.map((e) => e.progress).sort()).toEqual([25, 50]);
    });
  });
});
