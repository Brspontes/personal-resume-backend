import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthStatusDto } from './dto/health-status.dto';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check whether the application is operational' })
  @ApiResponse({
    status: 200,
    description: 'The application is up and able to handle requests.',
    type: HealthStatusDto,
  })
  check(): HealthStatusDto {
    return this.healthService.check();
  }
}
