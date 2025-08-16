import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, ValidateNested } from 'class-validator';
import { CreateServiceDto } from './create-service.dto';
import {
  ServiceTranslationDto,
  UpdateServiceTranslationDto,
} from './service-translation.dto';

export class UpdateServiceDto extends OmitType(PartialType(CreateServiceDto), [
  'translations',
]) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  categoryId?: number;

  @ApiProperty({ type: [UpdateServiceTranslationDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateServiceTranslationDto)
  translations?: Array<Partial<ServiceTranslationDto>>;
}
