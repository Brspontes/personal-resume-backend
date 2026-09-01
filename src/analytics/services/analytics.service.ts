import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyticsEventType } from '@prisma/client';
import { RecordAnalyticsEventDto } from '../dto/record-analytics-event.dto';
import { AnalyticsRepository } from '../repositories/analytics.repository';

const DEFAULT_VIEW_DEDUP_WINDOW_SECONDS = 1800;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly configService: ConfigService,
  ) {}

  async recordEvent(
    dto: RecordAnalyticsEventDto,
    userId?: string,
  ): Promise<void> {
    switch (dto.event) {
      case AnalyticsEventType.ARTICLE_VIEW:
        await this.recordView(dto, userId);
        return;
      case AnalyticsEventType.ARTICLE_PROGRESS:
        await this.recordProgress(dto, userId);
        return;
      case AnalyticsEventType.ARTICLE_READ:
        await this.recordRead(dto, userId);
        return;
    }
  }

  private async recordView(
    dto: RecordAnalyticsEventDto,
    userId?: string,
  ): Promise<void> {
    const windowSeconds =
      this.configService.get<number>('ANALYTICS_VIEW_DEDUP_WINDOW_SECONDS') ??
      DEFAULT_VIEW_DEDUP_WINDOW_SECONDS;
    const since = new Date(Date.now() - windowSeconds * 1000);

    const recentView = await this.analyticsRepository.findRecentView(
      dto.articleId,
      dto.sessionId,
      since,
    );
    if (recentView) {
      return;
    }

    await this.analyticsRepository.create({
      articleId: dto.articleId,
      sessionId: dto.sessionId,
      eventType: AnalyticsEventType.ARTICLE_VIEW,
      userId: userId ?? null,
    });
  }

  private async recordProgress(
    dto: RecordAnalyticsEventDto,
    userId?: string,
  ): Promise<void> {
    const progress = dto.progress as number;

    const existing = await this.analyticsRepository.findProgress(
      dto.articleId,
      dto.sessionId,
      progress,
    );
    if (existing) {
      return;
    }

    await this.analyticsRepository.create({
      articleId: dto.articleId,
      sessionId: dto.sessionId,
      eventType: AnalyticsEventType.ARTICLE_PROGRESS,
      userId: userId ?? null,
      progress,
    });
  }

  private async recordRead(
    dto: RecordAnalyticsEventDto,
    userId?: string,
  ): Promise<void> {
    await this.analyticsRepository.create({
      articleId: dto.articleId,
      sessionId: dto.sessionId,
      eventType: AnalyticsEventType.ARTICLE_READ,
      userId: userId ?? null,
      durationSeconds: dto.duration as number,
      maxProgress: dto.maxProgress as number,
    });
  }
}
