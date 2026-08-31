import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';
import { COMMENT_MAX_LENGTH } from '../comments.constants';

export class UpdateCommentDto {
  @ApiProperty({
    example: 'Excelente artigo! Gostei principalmente da parte sobre NestJS.',
    maxLength: COMMENT_MAX_LENGTH,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/\S/, { message: 'content must not be empty or whitespace-only' })
  @MaxLength(COMMENT_MAX_LENGTH)
  content!: string;
}
