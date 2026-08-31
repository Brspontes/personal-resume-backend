import { Module } from '@nestjs/common';
import { LinkedinService } from './linkedin.service';

@Module({
  providers: [LinkedinService],
  exports: [LinkedinService],
})
export class LinkedinModule {}
