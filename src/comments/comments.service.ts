import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Comment, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommentDto } from './dto/comment.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

type CommentWithAuthor = Comment & {
  user: Pick<User, 'id' | 'name' | 'avatarUrl'>;
};

type CommentWithReplies = CommentWithAuthor & {
  replies: CommentWithAuthor[];
};

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createComment(
    userId: string,
    articleId: string,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    if (dto.parentCommentId) {
      await this.assertValidParent(dto.parentCommentId, articleId);
    }

    return this.prisma.comment.create({
      data: {
        articleId,
        userId,
        content: dto.content,
        parentCommentId: dto.parentCommentId,
      },
    });
  }

  async updateComment(
    userId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ): Promise<Comment> {
    const comment = await this.findOwnedComment(userId, commentId);

    if (comment.deletedAt) {
      throw new BadRequestException('A deleted comment cannot be edited');
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { content: dto.content },
    });
  }

  async deleteComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.findOwnedComment(userId, commentId);

    if (comment.deletedAt) {
      throw new BadRequestException('This comment has already been deleted');
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }

  async findByArticle(
    articleId: string,
    userId?: string,
  ): Promise<CommentDto[]> {
    const authorSelect = { id: true, name: true, avatarUrl: true } as const;

    const comments = (await this.prisma.comment.findMany({
      where: { articleId, parentCommentId: null },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: authorSelect },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: authorSelect } },
        },
      },
    })) as CommentWithReplies[];

    return comments.map((comment) => this.toDto(comment, userId));
  }

  private toDto(
    comment: CommentWithAuthor & { replies?: CommentWithAuthor[] },
    userId?: string,
  ): CommentDto {
    const isDeleted = comment.deletedAt !== null;

    return {
      id: comment.id,
      content: isDeleted ? null : comment.content,
      author: {
        id: comment.user.id,
        name: comment.user.name,
        avatarUrl: comment.user.avatarUrl ?? undefined,
      },
      isOwner: userId !== undefined && comment.userId === userId,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      deletedAt: comment.deletedAt,
      replies: (comment.replies ?? []).map((reply) =>
        this.toDto(reply, userId),
      ),
    };
  }

  private async assertValidParent(
    parentCommentId: string,
    articleId: string,
  ): Promise<void> {
    const parent = await this.prisma.comment.findUnique({
      where: { id: parentCommentId },
    });

    if (!parent) {
      throw new NotFoundException('Parent comment not found');
    }
    if (parent.articleId !== articleId) {
      throw new BadRequestException(
        'Parent comment does not belong to this article',
      );
    }
    if (parent.parentCommentId !== null) {
      throw new BadRequestException('Cannot reply to a reply');
    }
    if (parent.deletedAt !== null) {
      throw new BadRequestException('Cannot reply to a deleted comment');
    }
  }

  private async findOwnedComment(
    userId: string,
    commentId: string,
  ): Promise<Comment> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.userId !== userId) {
      throw new ForbiddenException('You do not own this comment');
    }

    return comment;
  }
}
