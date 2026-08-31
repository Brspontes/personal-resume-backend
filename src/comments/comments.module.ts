import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ArticleCommentsController } from './article-comments.controller';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [ArticleCommentsController, CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
