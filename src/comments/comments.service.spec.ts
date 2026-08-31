import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  let service: CommentsService;
  const findUniqueMock = jest.fn();
  const findManyMock = jest.fn();
  const createMock = jest.fn();
  const updateMock = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: PrismaService,
          useValue: {
            comment: {
              findUnique: findUniqueMock,
              findMany: findManyMock,
              create: createMock,
              update: updateMock,
            },
          },
        },
      ],
    }).compile();

    service = module.get(CommentsService);
  });

  describe('createComment', () => {
    it('creates a top-level comment when no parentCommentId is given', async () => {
      createMock.mockResolvedValue({ id: 'c1' });

      await service.createComment('u1', 'a1', { content: 'Hello' });

      expect(createMock).toHaveBeenCalledWith({
        data: {
          articleId: 'a1',
          userId: 'u1',
          content: 'Hello',
          parentCommentId: undefined,
        },
      });
      expect(findUniqueMock).not.toHaveBeenCalled();
    });

    it('creates a reply to a valid top-level comment', async () => {
      findUniqueMock.mockResolvedValue({
        id: 'parent-1',
        articleId: 'a1',
        parentCommentId: null,
        deletedAt: null,
      });
      createMock.mockResolvedValue({ id: 'c2' });

      await service.createComment('u1', 'a1', {
        content: 'Reply',
        parentCommentId: 'parent-1',
      });

      expect(createMock).toHaveBeenCalledWith({
        data: {
          articleId: 'a1',
          userId: 'u1',
          content: 'Reply',
          parentCommentId: 'parent-1',
        },
      });
    });

    it('rejects when the parent comment does not exist', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(
        service.createComment('u1', 'a1', {
          content: 'Reply',
          parentCommentId: 'missing',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(createMock).not.toHaveBeenCalled();
    });

    it('rejects when the parent belongs to a different article', async () => {
      findUniqueMock.mockResolvedValue({
        id: 'parent-1',
        articleId: 'other-article',
        parentCommentId: null,
        deletedAt: null,
      });

      await expect(
        service.createComment('u1', 'a1', {
          content: 'Reply',
          parentCommentId: 'parent-1',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(createMock).not.toHaveBeenCalled();
    });

    it('rejects a reply to a reply', async () => {
      findUniqueMock.mockResolvedValue({
        id: 'reply-1',
        articleId: 'a1',
        parentCommentId: 'some-top-level',
        deletedAt: null,
      });

      await expect(
        service.createComment('u1', 'a1', {
          content: 'Reply',
          parentCommentId: 'reply-1',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(createMock).not.toHaveBeenCalled();
    });

    it('rejects a reply to a deleted comment', async () => {
      findUniqueMock.mockResolvedValue({
        id: 'parent-1',
        articleId: 'a1',
        parentCommentId: null,
        deletedAt: new Date(),
      });

      await expect(
        service.createComment('u1', 'a1', {
          content: 'Reply',
          parentCommentId: 'parent-1',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(createMock).not.toHaveBeenCalled();
    });
  });

  describe('updateComment', () => {
    it('updates content for the owner', async () => {
      findUniqueMock.mockResolvedValue({
        id: 'c1',
        userId: 'u1',
        deletedAt: null,
      });
      updateMock.mockResolvedValue({ id: 'c1', content: 'Updated' });

      await service.updateComment('u1', 'c1', { content: 'Updated' });

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { content: 'Updated' },
      });
    });

    it('rejects when the comment does not exist', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(
        service.updateComment('u1', 'missing', { content: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the comment belongs to another user', async () => {
      findUniqueMock.mockResolvedValue({
        id: 'c1',
        userId: 'someone-else',
        deletedAt: null,
      });

      await expect(
        service.updateComment('u1', 'c1', { content: 'Updated' }),
      ).rejects.toThrow(ForbiddenException);
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('rejects when the comment is deleted', async () => {
      findUniqueMock.mockResolvedValue({
        id: 'c1',
        userId: 'u1',
        deletedAt: new Date(),
      });

      await expect(
        service.updateComment('u1', 'c1', { content: 'Updated' }),
      ).rejects.toThrow(BadRequestException);
      expect(updateMock).not.toHaveBeenCalled();
    });
  });

  describe('deleteComment', () => {
    it('soft-deletes for the owner', async () => {
      findUniqueMock.mockResolvedValue({
        id: 'c1',
        userId: 'u1',
        deletedAt: null,
      });
      updateMock.mockResolvedValue({ id: 'c1' });

      await service.deleteComment('u1', 'c1');

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('rejects when the comment does not exist', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(service.deleteComment('u1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects when the comment belongs to another user', async () => {
      findUniqueMock.mockResolvedValue({
        id: 'c1',
        userId: 'someone-else',
        deletedAt: null,
      });

      await expect(service.deleteComment('u1', 'c1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('rejects when the comment is already deleted', async () => {
      findUniqueMock.mockResolvedValue({
        id: 'c1',
        userId: 'u1',
        deletedAt: new Date(),
      });

      await expect(service.deleteComment('u1', 'c1')).rejects.toThrow(
        BadRequestException,
      );
      expect(updateMock).not.toHaveBeenCalled();
    });
  });

  describe('findByArticle', () => {
    const author = { id: 'u1', name: 'Jane', avatarUrl: 'pic.jpg' };

    it('returns nested replies under their parent comment', async () => {
      findManyMock.mockResolvedValue([
        {
          id: 'c1',
          userId: 'u1',
          content: 'Top level',
          deletedAt: null,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          user: author,
          replies: [
            {
              id: 'r1',
              userId: 'u2',
              content: 'A reply',
              deletedAt: null,
              createdAt: new Date('2026-01-02'),
              updatedAt: new Date('2026-01-02'),
              user: { id: 'u2', name: 'John', avatarUrl: undefined },
            },
          ],
        },
      ]);

      const result = await service.findByArticle('a1');

      expect(result).toHaveLength(1);
      expect(result[0].replies).toHaveLength(1);
      expect(result[0].replies[0].id).toBe('r1');
    });

    it('hides content for a deleted comment while keeping its replies', async () => {
      findManyMock.mockResolvedValue([
        {
          id: 'c1',
          userId: 'u1',
          content: 'Original text',
          deletedAt: new Date('2026-01-05'),
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-05'),
          user: author,
          replies: [
            {
              id: 'r1',
              userId: 'u2',
              content: 'Still here',
              deletedAt: null,
              createdAt: new Date('2026-01-02'),
              updatedAt: new Date('2026-01-02'),
              user: { id: 'u2', name: 'John', avatarUrl: undefined },
            },
          ],
        },
      ]);

      const result = await service.findByArticle('a1');

      expect(result[0].content).toBeNull();
      expect(result[0].replies[0].content).toBe('Still here');
    });

    it.each([
      ['owner', 'u1', true],
      ['another user', 'u2', false],
      ['unauthenticated', undefined, false],
    ])(
      'computes isOwner correctly for %s',
      async (_label, userId, expected) => {
        findManyMock.mockResolvedValue([
          {
            id: 'c1',
            userId: 'u1',
            content: 'Top level',
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            user: author,
            replies: [],
          },
        ]);

        const result = await service.findByArticle('a1', userId);

        expect(result[0].isOwner).toBe(expected);
      },
    );
  });
});
