import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class PriceDto {
  @ApiProperty({ example: 25.0 })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 30 })
  @IsNumber()
  duration: number;

  @ApiPropertyOptional({ example: 'EUR', default: 'EUR' })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class UpdatePriceDto extends PartialType(PriceDto) {}
