import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CurrentUserDto {
  @ApiProperty({ example: 'ckv1q2z3x0000abcd1234efgh' })
  id!: string;

  @ApiProperty({ example: 'Jane Doe' })
  name!: string;

  @ApiPropertyOptional({ example: 'https://media.licdn.com/avatar.jpg' })
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'jane.doe@example.com' })
  email?: string;
}
