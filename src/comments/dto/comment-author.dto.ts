import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CommentAuthorDto {
  @ApiProperty({ example: 'ckv1q2z3x0000abcd1234efgh' })
  id!: string;

  @ApiProperty({ example: 'Brian Pontes' })
  name!: string;

  @ApiPropertyOptional({ example: 'https://media.licdn.com/avatar.jpg' })
  avatarUrl?: string;
}
