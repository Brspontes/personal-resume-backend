import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { User } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { OptionalAuthGuard } from '../../auth/guards/optional-auth.guard';
import { RecordAnalyticsEventDto } from '../dto/record-analytics-event.dto';
import { AnalyticsService } from '../services/analytics.service';

@ApiTags('analytics')
@Controller('analytics/events')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @UseGuards(OptionalAuthGuard, ThrottlerGuard)
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Record an article analytics event (view, reading progress, or completed read). Usable without authentication; associates the event with the caller when a valid session is present.',
  })
  @ApiResponse({
    status: 204,
    description: 'Event accepted (persisted, or ignored as a duplicate)',
  })
  @ApiResponse({ status: 400, description: 'Invalid analytics event payload' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async record(
    @Body() dto: RecordAnalyticsEventDto,
    @CurrentUser() user: User | undefined,
  ): Promise<void> {
    await this.analyticsService.recordEvent(dto, user?.id);
  }
}
