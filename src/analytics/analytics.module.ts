import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { AnalyticsController } from './controllers/analytics.controller';
import { AnalyticsRepository } from './repositories/analytics.repository';
import { AnalyticsService } from './services/analytics.service';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 20,
      },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRepository, ThrottlerGuard],
})
export class AnalyticsModule {}
