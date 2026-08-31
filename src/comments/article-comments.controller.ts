import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Comment, User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { CommentsService } from './comments.service';
import { CommentDto } from './dto/comment.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('comments')
@ApiParam({ name: 'articleId', description: 'Sanity article identifier' })
@Controller('articles/:articleId/comments')
export class ArticleCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @UseGuards(AuthGuard)
  @Post()
  @ApiOperation({
    summary: 'Create a top-level comment, or reply to an existing one',
  })
  @ApiResponse({ status: 201 })
  @ApiResponse({
    status: 400,
    description: 'Invalid content or parent comment',
  })
  @ApiResponse({ status: 401, description: 'No valid session present' })
  @ApiResponse({ status: 404, description: 'Parent comment not found' })
  async create(
    @Param('articleId') articleId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: User,
  ): Promise<Comment> {
    return this.commentsService.createComment(user.id, articleId, dto);
  }

  @UseGuards(OptionalAuthGuard)
  @Get()
  @ApiOperation({
    summary:
      "Get an article's comments, with replies nested and isOwner set when authenticated",
  })
  @ApiResponse({ status: 200, type: [CommentDto] })
  async findAll(
    @Param('articleId') articleId: string,
    @CurrentUser() user: User | undefined,
  ): Promise<CommentDto[]> {
    return this.commentsService.findByArticle(articleId, user?.id);
  }
}
