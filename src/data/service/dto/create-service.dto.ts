import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { CreatePriceDto, CreateServiceTranslationDto } from './service.dto';

export class CreateServiceDto {
  @ApiProperty({
    example: 1,
    description: 'ID de la categoría a la que pertenece el servicio',
  })
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  categoryId: number;

  @ApiProperty({
    type: [CreateServiceTranslationDto],
    description: 'Traducciones del servicio',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateServiceTranslationDto)
  translations: CreateServiceTranslationDto[];

  @ApiProperty({
    type: [CreatePriceDto],
    description: 'Lista de precios para el servicio',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePriceDto)
  prices: CreatePriceDto[];

  @ApiProperty({
    type: [Number],
    description: 'Lista de IDs de las sedes donde se ofrece el servicio',
  })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  sedeIds?: number[];

  @ApiProperty({
    type: [Number],
    description: 'Lista de IDs de los profesionales que prestan el servicio',
  })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  profesionalesIds?: number[];
}
