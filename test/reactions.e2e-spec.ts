import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { LinkedinIdentity } from './../src/linkedin/linkedin-identity.interface';
import { LinkedinService } from './../src/linkedin/linkedin.service';
import { PrismaService } from './../src/prisma/prisma.service';

type ReactionType = 'LIKE' | 'DISLIKE';

interface FakeUser {
  id: string;
  linkedinId: string;
  name: string;
  avatarUrl?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeReaction {
  id: string;
  userId: string;
  articleId: string;
  type: ReactionType;
  createdAt: Date;
  updatedAt: Date;
}

class FakePrismaService {
  onModuleInit = jest.fn();
  onModuleDestroy = jest.fn();

  private readonly usersByLinkedinId = new Map<string, FakeUser>();
  private readonly usersById = new Map<string, FakeUser>();
  private userIdCounter = 0;

  private readonly reactions = new Map<string, FakeReaction>();
  private reactionIdCounter = 0;

  private reactionKey(userId: string, articleId: string) {
    return `${userId}:${articleId}`;
  }

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

  reaction = {
    findUnique: jest.fn(
      async ({
        where,
      }: {
        where: { userId_articleId: { userId: string; articleId: string } };
      }): Promise<FakeReaction | null> => {
        const { userId, articleId } = where.userId_articleId;
        return this.reactions.get(this.reactionKey(userId, articleId)) ?? null;
      },
    ),
    create: jest.fn(
      async ({
        data,
      }: {
        data: { userId: string; articleId: string; type: ReactionType };
      }): Promise<FakeReaction> => {
        const id = `reaction-${++this.reactionIdCounter}`;
        const reaction: FakeReaction = {
          id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.reactions.set(
          this.reactionKey(data.userId, data.articleId),
          reaction,
        );
        return reaction;
      },
    ),
    update: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { type: ReactionType };
      }): Promise<FakeReaction> => {
        const entry = [...this.reactions.values()].find(
          (r) => r.id === where.id,
        );
        if (!entry) {
          throw new Error('Reaction not found');
        }
        const updated: FakeReaction = {
          ...entry,
          ...data,
          updatedAt: new Date(),
        };
        this.reactions.set(
          this.reactionKey(entry.userId, entry.articleId),
          updated,
        );
        return updated;
      },
    ),
    delete: jest.fn(async ({ where }: { where: { id: string } }) => {
      const entry = [...this.reactions.values()].find((r) => r.id === where.id);
      if (entry) {
        this.reactions.delete(this.reactionKey(entry.userId, entry.articleId));
      }
      return entry;
    }),
    deleteMany: jest.fn(
      async ({
        where,
      }: {
        where: { userId: string; articleId: string };
      }): Promise<{ count: number }> => {
        const key = this.reactionKey(where.userId, where.articleId);
        const existed = this.reactions.delete(key);
        return { count: existed ? 1 : 0 };
      },
    ),
    groupBy: jest.fn(
      async ({
        where,
      }: {
        where: { articleId: string };
      }): Promise<{ type: ReactionType; _count: { type: number } }[]> => {
        const counts: Partial<Record<ReactionType, number>> = {};
        for (const reaction of this.reactions.values()) {
          if (reaction.articleId === where.articleId) {
            counts[reaction.type] = (counts[reaction.type] ?? 0) + 1;
          }
        }
        return Object.entries(counts).map(([type, count]) => ({
          type: type as ReactionType,
          _count: { type: count as number },
        }));
      },
    ),
  };
}

describe('Article Reactions (e2e)', () => {
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

  describe('POST /api/v1/articles/:articleId/reactions', () => {
    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/articles/article-post-1/reactions')
        .send({ type: 'LIKE' })
        .expect(401);
    });

    it('creates a reaction for a first-time authenticated request', async () => {
      const agent = await loginAs('li-post-1', 'Poster One');

      const res = await agent
        .post('/api/v1/articles/article-post-1/reactions')
        .send({ type: 'LIKE' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ likes: 1, dislikes: 0, userReaction: 'LIKE' });
    });

    it('changes an existing reaction to the opposite type', async () => {
      const agent = await loginAs('li-post-2', 'Poster Two');
      await agent
        .post('/api/v1/articles/article-post-2/reactions')
        .send({ type: 'LIKE' });

      const res = await agent
        .post('/api/v1/articles/article-post-2/reactions')
        .send({ type: 'DISLIKE' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        likes: 0,
        dislikes: 1,
        userReaction: 'DISLIKE',
      });
    });

    it('removes the reaction when the same type is resubmitted', async () => {
      const agent = await loginAs('li-post-3', 'Poster Three');
      await agent
        .post('/api/v1/articles/article-post-3/reactions')
        .send({ type: 'LIKE' });

      const res = await agent
        .post('/api/v1/articles/article-post-3/reactions')
        .send({ type: 'LIKE' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ likes: 0, dislikes: 0, userReaction: null });
    });

    it('rejects an invalid reaction type', async () => {
      const agent = await loginAs('li-post-4', 'Poster Four');

      const res = await agent
        .post('/api/v1/articles/article-post-4/reactions')
        .send({ type: 'LOVE' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/articles/:articleId/reactions', () => {
    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/articles/article-delete-1/reactions')
        .expect(401);
    });

    it('removes an existing reaction', async () => {
      const agent = await loginAs('li-delete-1', 'Deleter One');
      await agent
        .post('/api/v1/articles/article-delete-1/reactions')
        .send({ type: 'LIKE' });

      await agent
        .delete('/api/v1/articles/article-delete-1/reactions')
        .expect(204);

      const summary = await agent.get(
        '/api/v1/articles/article-delete-1/reactions',
      );
      expect(summary.body).toEqual({
        likes: 0,
        dislikes: 0,
        userReaction: null,
      });
    });

    it('behaves idempotently when no reaction exists', async () => {
      const agent = await loginAs('li-delete-2', 'Deleter Two');

      await agent
        .delete('/api/v1/articles/article-delete-2/reactions')
        .expect(204);
    });
  });

  describe('Authorization', () => {
    it("does not let one user affect another user's reaction on the same article", async () => {
      const userA = await loginAs('li-auth-a', 'User A');
      const userB = await loginAs('li-auth-b', 'User B');

      await userA
        .post('/api/v1/articles/article-auth-1/reactions')
        .send({ type: 'LIKE' })
        .expect(201);

      // userB deletes on the same article - should only affect userB's own
      // (nonexistent) reaction, never userA's.
      await userB
        .delete('/api/v1/articles/article-auth-1/reactions')
        .expect(204);

      const summary = await request(app.getHttpServer()).get(
        '/api/v1/articles/article-auth-1/reactions',
      );
      expect(summary.body).toEqual({
        likes: 1,
        dislikes: 0,
        userReaction: null,
      });
    });
  });

  describe('GET /api/v1/articles/:articleId/reactions', () => {
    it("returns counts and the caller's reaction for an authenticated reacting user", async () => {
      const agent = await loginAs('li-get-1', 'Getter One');
      await agent
        .post('/api/v1/articles/article-get-1/reactions')
        .send({ type: 'DISLIKE' });

      const res = await agent.get('/api/v1/articles/article-get-1/reactions');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        likes: 0,
        dislikes: 1,
        userReaction: 'DISLIKE',
      });
    });

    it('returns a null userReaction for an authenticated non-reacting user', async () => {
      const agent = await loginAs('li-get-2', 'Getter Two');

      const res = await agent.get('/api/v1/articles/article-get-2/reactions');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ likes: 0, dislikes: 0, userReaction: null });
    });

    it('returns counts and a null userReaction for an unauthenticated request', async () => {
      const agent = await loginAs('li-get-3', 'Getter Three');
      await agent
        .post('/api/v1/articles/article-get-3/reactions')
        .send({ type: 'LIKE' });

      const res = await request(app.getHttpServer()).get(
        '/api/v1/articles/article-get-3/reactions',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ likes: 1, dislikes: 0, userReaction: null });
    });
  });
});
