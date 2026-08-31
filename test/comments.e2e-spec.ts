import { INestApplication, ValidationPipe } from '@nestjs/common';
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

interface FakeComment {
  id: string;
  articleId: string;
  userId: string;
  parentCommentId: string | null;
  content: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

class FakePrismaService {
  onModuleInit = jest.fn();
  onModuleDestroy = jest.fn();

  private readonly usersByLinkedinId = new Map<string, FakeUser>();
  private readonly usersById = new Map<string, FakeUser>();
  private userIdCounter = 0;

  private readonly comments = new Map<string, FakeComment>();
  private commentIdCounter = 0;

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

  comment = {
    create: jest.fn(
      async ({
        data,
      }: {
        data: {
          articleId: string;
          userId: string;
          content: string;
          parentCommentId?: string;
        };
      }): Promise<FakeComment> => {
        const id = `comment-${++this.commentIdCounter}`;
        const comment: FakeComment = {
          id,
          articleId: data.articleId,
          userId: data.userId,
          content: data.content,
          parentCommentId: data.parentCommentId ?? null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.comments.set(id, comment);
        return comment;
      },
    ),
    findUnique: jest.fn(
      async ({
        where,
      }: {
        where: { id: string };
      }): Promise<FakeComment | null> => this.comments.get(where.id) ?? null,
    ),
    update: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeComment>;
      }): Promise<FakeComment> => {
        const existing = this.comments.get(where.id);
        if (!existing) {
          throw new Error('Comment not found');
        }
        const updated: FakeComment = {
          ...existing,
          ...data,
          updatedAt: new Date(),
        };
        this.comments.set(where.id, updated);
        return updated;
      },
    ),
    findMany: jest.fn(
      async ({
        where,
      }: {
        where: { articleId: string; parentCommentId: null };
      }) => {
        const author = (userId: string) => {
          const user = this.usersById.get(userId);
          return {
            id: user?.id,
            name: user?.name,
            avatarUrl: user?.avatarUrl,
          };
        };

        const topLevel = [...this.comments.values()]
          .filter(
            (c) =>
              c.articleId === where.articleId && c.parentCommentId === null,
          )
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        return topLevel.map((c) => ({
          ...c,
          user: author(c.userId),
          replies: [...this.comments.values()]
            .filter((r) => r.parentCommentId === c.id)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map((r) => ({ ...r, user: author(r.userId) })),
        }));
      },
    ),
  };
}

describe('Article Comments (e2e)', () => {
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

  describe('POST /api/v1/articles/:articleId/comments', () => {
    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/articles/article-1/comments')
        .send({ content: 'Hello' })
        .expect(401);
    });

    it('creates a top-level comment for an authenticated request', async () => {
      const agent = await loginAs('li-c-1', 'Commenter One');

      const res = await agent
        .post('/api/v1/articles/article-1/comments')
        .send({ content: 'Excelente artigo!' });

      expect(res.status).toBe(201);
      expect(res.body.content).toBe('Excelente artigo!');
    });

    it('creates a reply to a valid top-level comment', async () => {
      const agent = await loginAs('li-c-2', 'Commenter Two');
      const parent = await agent
        .post('/api/v1/articles/article-2/comments')
        .send({ content: 'Top level' });

      const reply = await agent
        .post('/api/v1/articles/article-2/comments')
        .send({ content: 'A reply', parentCommentId: parent.body.id });

      expect(reply.status).toBe(201);
      expect(reply.body.parentCommentId).toBe(parent.body.id);
    });

    it('rejects empty content', async () => {
      const agent = await loginAs('li-c-3', 'Commenter Three');

      const res = await agent
        .post('/api/v1/articles/article-3/comments')
        .send({ content: '' });

      expect(res.status).toBe(400);
    });

    it('rejects whitespace-only content', async () => {
      const agent = await loginAs('li-c-4', 'Commenter Four');

      const res = await agent
        .post('/api/v1/articles/article-4/comments')
        .send({ content: '   ' });

      expect(res.status).toBe(400);
    });

    it('rejects content over the maximum length', async () => {
      const agent = await loginAs('li-c-5', 'Commenter Five');

      const res = await agent
        .post('/api/v1/articles/article-5/comments')
        .send({ content: 'a'.repeat(2001) });

      expect(res.status).toBe(400);
    });

    it('rejects a reply to a reply', async () => {
      const agent = await loginAs('li-c-6', 'Commenter Six');
      const parent = await agent
        .post('/api/v1/articles/article-6/comments')
        .send({ content: 'Top level' });
      const reply = await agent
        .post('/api/v1/articles/article-6/comments')
        .send({ content: 'First reply', parentCommentId: parent.body.id });

      const res = await agent
        .post('/api/v1/articles/article-6/comments')
        .send({ content: 'Reply to reply', parentCommentId: reply.body.id });

      expect(res.status).toBe(400);
    });

    it('rejects a reply whose parent belongs to a different article', async () => {
      const agent = await loginAs('li-c-7', 'Commenter Seven');
      const parent = await agent
        .post('/api/v1/articles/article-7a/comments')
        .send({ content: 'Top level' });

      const res = await agent
        .post('/api/v1/articles/article-7b/comments')
        .send({
          content: 'Cross-article reply',
          parentCommentId: parent.body.id,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/comments/:commentId', () => {
    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/comments/some-id')
        .send({ content: 'Updated' })
        .expect(401);
    });

    it('updates content for the owner', async () => {
      const agent = await loginAs('li-p-1', 'Patcher One');
      const created = await agent
        .post('/api/v1/articles/article-p1/comments')
        .send({ content: 'Original' });

      const res = await agent
        .patch(`/api/v1/comments/${created.body.id}`)
        .send({ content: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.content).toBe('Updated');
    });

    it("rejects editing another user's comment", async () => {
      const owner = await loginAs('li-p-2', 'Patcher Two');
      const created = await owner
        .post('/api/v1/articles/article-p2/comments')
        .send({ content: 'Original' });

      const other = await loginAs('li-p-3', 'Patcher Three');
      const res = await other
        .patch(`/api/v1/comments/${created.body.id}`)
        .send({ content: 'Hacked' });

      expect(res.status).toBe(403);
    });

    it('rejects editing a deleted comment', async () => {
      const agent = await loginAs('li-p-4', 'Patcher Four');
      const created = await agent
        .post('/api/v1/articles/article-p4/comments')
        .send({ content: 'Original' });
      await agent.delete(`/api/v1/comments/${created.body.id}`);

      const res = await agent
        .patch(`/api/v1/comments/${created.body.id}`)
        .send({ content: 'Updated' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/comments/:commentId', () => {
    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/comments/some-id')
        .expect(401);
    });

    it('soft-deletes for the owner', async () => {
      const agent = await loginAs('li-d-1', 'Deleter One');
      const created = await agent
        .post('/api/v1/articles/article-d1/comments')
        .send({ content: 'To delete' });

      await agent.delete(`/api/v1/comments/${created.body.id}`).expect(204);

      const list = await agent.get('/api/v1/articles/article-d1/comments');
      expect(list.body[0].content).toBeNull();
    });

    it("rejects deleting another user's comment", async () => {
      const owner = await loginAs('li-d-2', 'Deleter Two');
      const created = await owner
        .post('/api/v1/articles/article-d2/comments')
        .send({ content: 'Original' });

      const other = await loginAs('li-d-3', 'Deleter Three');
      const res = await other.delete(`/api/v1/comments/${created.body.id}`);

      expect(res.status).toBe(403);
    });

    it('rejects deleting an already-deleted comment', async () => {
      const agent = await loginAs('li-d-4', 'Deleter Four');
      const created = await agent
        .post('/api/v1/articles/article-d4/comments')
        .send({ content: 'Original' });
      await agent.delete(`/api/v1/comments/${created.body.id}`);

      const res = await agent.delete(`/api/v1/comments/${created.body.id}`);

      expect(res.status).toBe(400);
    });

    it("keeps a deleted comment's replies retrievable", async () => {
      const agent = await loginAs('li-d-5', 'Deleter Five');
      const parent = await agent
        .post('/api/v1/articles/article-d5/comments')
        .send({ content: 'Parent' });
      await agent
        .post('/api/v1/articles/article-d5/comments')
        .send({ content: 'A reply', parentCommentId: parent.body.id });

      await agent.delete(`/api/v1/comments/${parent.body.id}`).expect(204);

      const list = await agent.get('/api/v1/articles/article-d5/comments');
      expect(list.body[0].content).toBeNull();
      expect(list.body[0].replies).toHaveLength(1);
      expect(list.body[0].replies[0].content).toBe('A reply');
    });
  });

  describe('GET /api/v1/articles/:articleId/comments', () => {
    it('returns nested replies and author info, and computes isOwner correctly', async () => {
      const author = await loginAs('li-g-1', 'Getter One');
      const created = await author
        .post('/api/v1/articles/article-g1/comments')
        .send({ content: 'Top level' });
      await author
        .post('/api/v1/articles/article-g1/comments')
        .send({ content: 'A reply', parentCommentId: created.body.id });

      const asAuthor = await author.get('/api/v1/articles/article-g1/comments');
      expect(asAuthor.status).toBe(200);
      expect(asAuthor.body).toHaveLength(1);
      expect(asAuthor.body[0].isOwner).toBe(true);
      expect(asAuthor.body[0].author.name).toBe('Getter One');
      expect(asAuthor.body[0].replies).toHaveLength(1);

      const otherUser = await loginAs('li-g-2', 'Getter Two');
      const asOther = await otherUser.get(
        '/api/v1/articles/article-g1/comments',
      );
      expect(asOther.body[0].isOwner).toBe(false);

      const unauthenticated = await request(app.getHttpServer()).get(
        '/api/v1/articles/article-g1/comments',
      );
      expect(unauthenticated.status).toBe(200);
      expect(unauthenticated.body[0].isOwner).toBe(false);
    });
  });
});
