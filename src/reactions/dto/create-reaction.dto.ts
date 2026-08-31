import { ApiProperty } from '@nestjs/swagger';
import { ReactionType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class CreateReactionDto {
  @ApiProperty({ enum: ReactionType, example: ReactionType.LIKE })
  @IsEnum(ReactionType)
  type!: ReactionType;
}
