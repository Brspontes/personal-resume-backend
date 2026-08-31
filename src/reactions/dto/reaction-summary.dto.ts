import { ApiProperty } from '@nestjs/swagger';
import { ReactionType } from '@prisma/client';

export class ReactionSummaryDto {
  @ApiProperty({ example: 10 })
  likes!: number;

  @ApiProperty({ example: 2 })
  dislikes!: number;

  @ApiProperty({
    enum: ReactionType,
    nullable: true,
    example: ReactionType.LIKE,
  })
  userReaction!: ReactionType | null;
}
