import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Comment, User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CommentsService } from './comments.service';
import { UpdateCommentDto } from './dto/update-comment.dto';

@ApiTags('comments')
@ApiParam({ name: 'commentId' })
@Controller('comments/:commentId')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @UseGuards(AuthGuard)
  @Patch()
  @ApiOperation({ summary: "Edit the caller's own comment or reply" })
  @ApiResponse({ status: 200 })
  @ApiResponse({
    status: 400,
    description: 'Invalid content, or the comment is deleted',
  })
  @ApiResponse({ status: 401, description: 'No valid session present' })
  @ApiResponse({
    status: 403,
    description: 'The comment belongs to another user',
  })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async update(
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: User,
  ): Promise<Comment> {
    return this.commentsService.updateComment(user.id, commentId, dto);
  }

  @UseGuards(AuthGuard)
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Soft-delete the caller's own comment or reply",
  })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 400, description: 'The comment is already deleted' })
  @ApiResponse({ status: 401, description: 'No valid session present' })
  @ApiResponse({
    status: 403,
    description: 'The comment belongs to another user',
  })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async remove(
    @Param('commentId') commentId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.commentsService.deleteComment(user.id, commentId);
  }
}
