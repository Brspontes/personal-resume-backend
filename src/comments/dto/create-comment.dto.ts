import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { COMMENT_MAX_LENGTH } from '../comments.constants';

export class CreateCommentDto {
  @ApiProperty({ example: 'Excelente artigo!', maxLength: COMMENT_MAX_LENGTH })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/\S/, { message: 'content must not be empty or whitespace-only' })
  @MaxLength(COMMENT_MAX_LENGTH)
  content!: string;

  @ApiPropertyOptional({
    description: 'Set to reply to an existing top-level comment',
    example: 'ckv1q2z3x0000abcd1234efgh',
  })
  @IsOptional()
  @IsString()
  parentCommentId?: string;
}
