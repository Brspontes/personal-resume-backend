import { Injectable } from '@nestjs/common';
import { Prisma, Reaction, ReactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReactionSummaryDto } from './dto/reaction-summary.dto';

@Injectable()
export class ReactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async applyReaction(
    userId: string,
    articleId: string,
    type: ReactionType,
  ): Promise<Reaction | null> {
    return this.applyReactionInternal(userId, articleId, type, true);
  }

  async removeReaction(userId: string, articleId: string): Promise<void> {
    await this.prisma.reaction.deleteMany({ where: { userId, articleId } });
  }

  async getSummary(
    articleId: string,
    userId?: string,
  ): Promise<ReactionSummaryDto> {
    const grouped = await this.prisma.reaction.groupBy({
      by: ['type'],
      where: { articleId },
      _count: { type: true },
    });

    const likes =
      grouped.find((group) => group.type === ReactionType.LIKE)?._count.type ??
      0;
    const dislikes =
      grouped.find((group) => group.type === ReactionType.DISLIKE)?._count
        .type ?? 0;

    let userReaction: ReactionType | null = null;
    if (userId) {
      const existing = await this.prisma.reaction.findUnique({
        where: { userId_articleId: { userId, articleId } },
      });
      userReaction = existing?.type ?? null;
    }

    return { likes, dislikes, userReaction };
  }

  private async applyReactionInternal(
    userId: string,
    articleId: string,
    type: ReactionType,
    allowRetryOnConflict: boolean,
  ): Promise<Reaction | null> {
    const existing = await this.prisma.reaction.findUnique({
      where: { userId_articleId: { userId, articleId } },
    });

    if (!existing) {
      try {
        return await this.prisma.reaction.create({
          data: { userId, articleId, type },
        });
      } catch (error) {
        if (allowRetryOnConflict && this.isUniqueConstraintViolation(error)) {
          return this.applyReactionInternal(userId, articleId, type, false);
        }
        throw error;
      }
    }

    if (existing.type === type) {
      await this.prisma.reaction.delete({ where: { id: existing.id } });
      return null;
    }

    return this.prisma.reaction.update({
      where: { id: existing.id },
      data: { type },
    });
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
