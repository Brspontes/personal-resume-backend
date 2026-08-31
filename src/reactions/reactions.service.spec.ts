import { Prisma, ReactionType } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ReactionsService } from './reactions.service';

const uniqueConstraintError = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });

describe('ReactionsService', () => {
  let service: ReactionsService;
  const findUniqueMock = jest.fn();
  const createMock = jest.fn();
  const updateMock = jest.fn();
  const deleteMock = jest.fn();
  const deleteManyMock = jest.fn();
  const groupByMock = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReactionsService,
        {
          provide: PrismaService,
          useValue: {
            reaction: {
              findUnique: findUniqueMock,
              create: createMock,
              update: updateMock,
              delete: deleteMock,
              deleteMany: deleteManyMock,
              groupBy: groupByMock,
            },
          },
        },
      ],
    }).compile();

    service = module.get(ReactionsService);
  });

  describe('applyReaction', () => {
    it('creates a new reaction when none exists', async () => {
      findUniqueMock.mockResolvedValue(null);
      createMock.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        articleId: 'a1',
        type: ReactionType.LIKE,
      });

      const result = await service.applyReaction('u1', 'a1', ReactionType.LIKE);

      expect(createMock).toHaveBeenCalledWith({
        data: { userId: 'u1', articleId: 'a1', type: ReactionType.LIKE },
      });
      expect(result?.type).toBe(ReactionType.LIKE);
    });

    it('updates the reaction when a different type is submitted', async () => {
      findUniqueMock.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        articleId: 'a1',
        type: ReactionType.LIKE,
      });
      updateMock.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        articleId: 'a1',
        type: ReactionType.DISLIKE,
      });

      const result = await service.applyReaction(
        'u1',
        'a1',
        ReactionType.DISLIKE,
      );

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { type: ReactionType.DISLIKE },
      });
      expect(createMock).not.toHaveBeenCalled();
      expect(result?.type).toBe(ReactionType.DISLIKE);
    });

    it('deletes the reaction when the same type is resubmitted', async () => {
      findUniqueMock.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        articleId: 'a1',
        type: ReactionType.LIKE,
      });

      const result = await service.applyReaction('u1', 'a1', ReactionType.LIKE);

      expect(deleteMock).toHaveBeenCalledWith({ where: { id: 'r1' } });
      expect(result).toBeNull();
    });

    it('recovers from a concurrent unique-constraint conflict by re-fetching and re-applying', async () => {
      findUniqueMock.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'r1',
        userId: 'u1',
        articleId: 'a1',
        type: ReactionType.LIKE,
      });
      createMock.mockRejectedValue(uniqueConstraintError());

      const result = await service.applyReaction('u1', 'a1', ReactionType.LIKE);

      expect(createMock).toHaveBeenCalledTimes(1);
      expect(findUniqueMock).toHaveBeenCalledTimes(2);
      expect(deleteMock).toHaveBeenCalledWith({ where: { id: 'r1' } });
      expect(result).toBeNull();
    });

    it('rethrows unexpected database errors', async () => {
      findUniqueMock.mockResolvedValue(null);
      createMock.mockRejectedValue(new Error('connection lost'));

      await expect(
        service.applyReaction('u1', 'a1', ReactionType.LIKE),
      ).rejects.toThrow('connection lost');
    });
  });

  describe('removeReaction', () => {
    it('deletes the reaction via deleteMany', async () => {
      deleteManyMock.mockResolvedValue({ count: 1 });

      await service.removeReaction('u1', 'a1');

      expect(deleteManyMock).toHaveBeenCalledWith({
        where: { userId: 'u1', articleId: 'a1' },
      });
    });

    it('does not throw when no reaction exists', async () => {
      deleteManyMock.mockResolvedValue({ count: 0 });

      await expect(service.removeReaction('u1', 'a1')).resolves.toBeUndefined();
    });
  });

  describe('getSummary', () => {
    it('returns like/dislike counts with the caller reaction when the user has one', async () => {
      groupByMock.mockResolvedValue([
        { type: ReactionType.LIKE, _count: { type: 10 } },
        { type: ReactionType.DISLIKE, _count: { type: 2 } },
      ]);
      findUniqueMock.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        articleId: 'a1',
        type: ReactionType.LIKE,
      });

      const result = await service.getSummary('a1', 'u1');

      expect(result).toEqual({ likes: 10, dislikes: 2, userReaction: 'LIKE' });
    });

    it('returns a null userReaction when the user has not reacted', async () => {
      groupByMock.mockResolvedValue([]);
      findUniqueMock.mockResolvedValue(null);

      const result = await service.getSummary('a1', 'u1');

      expect(result).toEqual({ likes: 0, dislikes: 0, userReaction: null });
    });

    it('returns a null userReaction without checking the database when no userId is provided', async () => {
      groupByMock.mockResolvedValue([
        { type: ReactionType.LIKE, _count: { type: 3 } },
      ]);

      const result = await service.getSummary('a1');

      expect(result).toEqual({ likes: 3, dislikes: 0, userReaction: null });
      expect(findUniqueMock).not.toHaveBeenCalled();
    });
  });
});
