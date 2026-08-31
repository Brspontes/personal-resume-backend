import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  const upsertMock = jest.fn();
  const findUniqueMock = jest.fn();

  beforeEach(async () => {
    upsertMock.mockReset();
    findUniqueMock.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: { upsert: upsertMock, findUnique: findUniqueMock },
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('findOrCreateFromLinkedin', () => {
    it('creates a new user on first login via an atomic upsert', async () => {
      const identity = {
        sub: 'li-123',
        name: 'Jane Doe',
        picture: 'https://pic',
        email: 'jane@example.com',
      };
      upsertMock.mockResolvedValue({
        id: 'user-1',
        linkedinId: 'li-123',
        name: 'Jane Doe',
      });

      const user = await service.findOrCreateFromLinkedin(identity);

      expect(upsertMock).toHaveBeenCalledWith({
        where: { linkedinId: 'li-123' },
        update: {
          name: 'Jane Doe',
          avatarUrl: 'https://pic',
          email: 'jane@example.com',
        },
        create: {
          linkedinId: 'li-123',
          name: 'Jane Doe',
          avatarUrl: 'https://pic',
          email: 'jane@example.com',
        },
      });
      expect(user.id).toBe('user-1');
    });

    it('reuses and updates the existing user for a returning identity', async () => {
      const identity = { sub: 'li-123', name: 'Jane D.' };
      upsertMock.mockResolvedValue({
        id: 'user-1',
        linkedinId: 'li-123',
        name: 'Jane D.',
      });

      const user = await service.findOrCreateFromLinkedin(identity);

      expect(upsertMock).toHaveBeenCalledTimes(1);
      expect(user.id).toBe('user-1');
    });

    it('always goes through the atomic upsert, never a separate find-then-create, so concurrent first logins cannot race into duplicates', async () => {
      const identity = { sub: 'li-999', name: 'New User' };
      upsertMock.mockResolvedValue({
        id: 'user-2',
        linkedinId: 'li-999',
        name: 'New User',
      });

      const [a, b] = await Promise.all([
        service.findOrCreateFromLinkedin(identity),
        service.findOrCreateFromLinkedin(identity),
      ]);

      expect(a.id).toBe('user-2');
      expect(b.id).toBe('user-2');
      expect(upsertMock).toHaveBeenCalledTimes(2);
      expect(findUniqueMock).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns the user when found', async () => {
      findUniqueMock.mockResolvedValue({ id: 'user-1', name: 'Jane' });

      const user = await service.findById('user-1');

      expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(user?.id).toBe('user-1');
    });

    it('returns null when the user does not exist', async () => {
      findUniqueMock.mockResolvedValue(null);

      const user = await service.findById('missing');

      expect(user).toBeNull();
    });
  });
});
