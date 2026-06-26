import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Search users DTO.
 */
export class SearchUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;
}
