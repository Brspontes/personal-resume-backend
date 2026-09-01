import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsEventType } from '@prisma/client';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  const createMock = jest.fn();
  const findRecentViewMock = jest.fn();
  const findProgressMock = jest.fn();
  const configGetMock = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: AnalyticsRepository,
          useValue: {
            create: createMock,
            findRecentView: findRecentViewMock,
            findProgress: findProgressMock,
          },
        },
        {
          provide: ConfigService,
          useValue: { get: configGetMock },
        },
      ],
    }).compile();

    service = module.get(AnalyticsService);
  });

  describe('ARTICLE_VIEW', () => {
    it('persists a first view for a session/article pair', async () => {
      configGetMock.mockReturnValue(1800);
      findRecentViewMock.mockResolvedValue(null);

      await service.recordEvent(
        {
          event: AnalyticsEventType.ARTICLE_VIEW,
          articleId: 'a1',
          sessionId: 's1',
        },
        'u1',
      );

      expect(createMock).toHaveBeenCalledWith({
        articleId: 'a1',
        sessionId: 's1',
        eventType: AnalyticsEventType.ARTICLE_VIEW,
        userId: 'u1',
      });
    });

    it('skips persistence for a duplicate view inside the dedup window', async () => {
      configGetMock.mockReturnValue(1800);
      findRecentViewMock.mockResolvedValue({ id: 'existing-view' });

      await service.recordEvent({
        event: AnalyticsEventType.ARTICLE_VIEW,
        articleId: 'a1',
        sessionId: 's1',
      });

      expect(createMock).not.toHaveBeenCalled();
    });

    it('persists again once the dedup window has elapsed', async () => {
      configGetMock.mockReturnValue(1800);
      findRecentViewMock.mockResolvedValue(null);

      await service.recordEvent({
        event: AnalyticsEventType.ARTICLE_VIEW,
        articleId: 'a1',
        sessionId: 's1',
      });

      expect(findRecentViewMock).toHaveBeenCalledWith(
        'a1',
        's1',
        expect.any(Date),
      );
      expect(createMock).toHaveBeenCalled();
    });

    it('records an anonymous view with a null userId', async () => {
      configGetMock.mockReturnValue(1800);
      findRecentViewMock.mockResolvedValue(null);

      await service.recordEvent({
        event: AnalyticsEventType.ARTICLE_VIEW,
        articleId: 'a1',
        sessionId: 's1',
      });

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null }),
      );
    });
  });

  describe('ARTICLE_PROGRESS', () => {
    it('persists a new milestone', async () => {
      findProgressMock.mockResolvedValue(null);

      await service.recordEvent({
        event: AnalyticsEventType.ARTICLE_PROGRESS,
        articleId: 'a1',
        sessionId: 's1',
        progress: 25,
      });

      expect(createMock).toHaveBeenCalledWith({
        articleId: 'a1',
        sessionId: 's1',
        eventType: AnalyticsEventType.ARTICLE_PROGRESS,
        userId: null,
        progress: 25,
      });
    });

    it('skips a repeated identical milestone', async () => {
      findProgressMock.mockResolvedValue({ id: 'existing-progress' });

      await service.recordEvent({
        event: AnalyticsEventType.ARTICLE_PROGRESS,
        articleId: 'a1',
        sessionId: 's1',
        progress: 50,
      });

      expect(createMock).not.toHaveBeenCalled();
    });

    it('persists a different, not-yet-seen milestone', async () => {
      findProgressMock.mockResolvedValue(null);

      await service.recordEvent({
        event: AnalyticsEventType.ARTICLE_PROGRESS,
        articleId: 'a1',
        sessionId: 's1',
        progress: 75,
      });

      expect(findProgressMock).toHaveBeenCalledWith('a1', 's1', 75);
      expect(createMock).toHaveBeenCalled();
    });
  });

  describe('ARTICLE_READ', () => {
    it('persists with the supplied duration and maxProgress', async () => {
      await service.recordEvent({
        event: AnalyticsEventType.ARTICLE_READ,
        articleId: 'a1',
        sessionId: 's1',
        duration: 248,
        maxProgress: 87,
      });

      expect(createMock).toHaveBeenCalledWith({
        articleId: 'a1',
        sessionId: 's1',
        eventType: AnalyticsEventType.ARTICLE_READ,
        userId: null,
        durationSeconds: 248,
        maxProgress: 87,
      });
    });
  });

  describe('user association', () => {
    it('uses only the userId parameter, never a value from the DTO, for association', async () => {
      configGetMock.mockReturnValue(1800);
      findRecentViewMock.mockResolvedValue(null);

      const dtoWithSpoofedIdentity = {
        event: AnalyticsEventType.ARTICLE_VIEW,
        articleId: 'a1',
        sessionId: 's1',
        userId: 'attacker-controlled-id',
      } as unknown as Parameters<typeof service.recordEvent>[0];

      await service.recordEvent(dtoWithSpoofedIdentity, 'real-session-user');

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'real-session-user' }),
      );
    });
  });
});
