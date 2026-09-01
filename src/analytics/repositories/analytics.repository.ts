import { Injectable } from '@nestjs/common';
import { AnalyticsEvent, AnalyticsEventType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateAnalyticsEventInput {
  articleId: string;
  eventType: AnalyticsEventType;
  sessionId: string;
  userId: string | null;
  progress?: number;
  durationSeconds?: number;
  maxProgress?: number;
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateAnalyticsEventInput): Promise<AnalyticsEvent> {
    return this.prisma.analyticsEvent.create({ data });
  }

  findRecentView(
    articleId: string,
    sessionId: string,
    since: Date,
  ): Promise<AnalyticsEvent | null> {
    return this.prisma.analyticsEvent.findFirst({
      where: {
        articleId,
        sessionId,
        eventType: AnalyticsEventType.ARTICLE_VIEW,
        createdAt: { gte: since },
      },
    });
  }

  findProgress(
    articleId: string,
    sessionId: string,
    progress: number,
  ): Promise<AnalyticsEvent | null> {
    return this.prisma.analyticsEvent.findFirst({
      where: {
        articleId,
        sessionId,
        eventType: AnalyticsEventType.ARTICLE_PROGRESS,
        progress,
      },
    });
  }
}
