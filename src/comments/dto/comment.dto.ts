import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommentAuthorDto } from './comment-author.dto';

export class CommentDto {
  @ApiProperty({ example: 'ckv1q2z3x0000abcd1234efgh' })
  id!: string;

  @ApiProperty({
    example: 'Excelente artigo!',
    nullable: true,
    description: 'null when the comment has been deleted',
  })
  content!: string | null;

  @ApiProperty({ type: CommentAuthorDto })
  author!: CommentAuthorDto;

  @ApiProperty({ example: true })
  isOwner!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  deletedAt!: Date | null;

  @ApiProperty({ type: () => [CommentDto] })
  replies!: CommentDto[];
}
