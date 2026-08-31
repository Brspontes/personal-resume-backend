import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { ReactionSummaryDto } from './dto/reaction-summary.dto';
import { ReactionsService } from './reactions.service';

@ApiTags('reactions')
@ApiParam({ name: 'articleId', description: 'Sanity article identifier' })
@Controller('articles/:articleId/reactions')
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @UseGuards(AuthGuard)
  @Post()
  @ApiOperation({
    summary:
      'Create, change, or (if the same type is resubmitted) remove the current reaction',
  })
  @ApiResponse({ status: 201, type: ReactionSummaryDto })
  @ApiResponse({ status: 400, description: 'Invalid reaction type' })
  @ApiResponse({ status: 401, description: 'No valid session present' })
  async react(
    @Param('articleId') articleId: string,
    @Body() dto: CreateReactionDto,
    @CurrentUser() user: User,
  ): Promise<ReactionSummaryDto> {
    await this.reactionsService.applyReaction(user.id, articleId, dto.type);
    return this.reactionsService.getSummary(articleId, user.id);
  }

  @UseGuards(AuthGuard)
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove the caller's reaction, if any" })
  @ApiResponse({
    status: 204,
    description: 'Reaction removed (or already absent)',
  })
  @ApiResponse({ status: 401, description: 'No valid session present' })
  async remove(
    @Param('articleId') articleId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.reactionsService.removeReaction(user.id, articleId);
  }

  @UseGuards(OptionalAuthGuard)
  @Get()
  @ApiOperation({
    summary:
      "Get an article's reaction counts and the caller's own reaction, if authenticated",
  })
  @ApiResponse({ status: 200, type: ReactionSummaryDto })
  async summary(
    @Param('articleId') articleId: string,
    @CurrentUser() user: User | undefined,
  ): Promise<ReactionSummaryDto> {
    return this.reactionsService.getSummary(articleId, user?.id);
  }
}
