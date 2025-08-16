import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, ValidateNested } from 'class-validator';
import { PriceDto } from './price.dto';
import { ServiceTranslationDto } from './service-translation.dto';

export class CreateServiceDto {
  @ApiProperty({
    example: 1,
    description: 'ID de la categoría a la que pertenece el servicio',
    required: true,
  })
  @IsInt()
  @IsNotEmpty()
  categoryId: number;

  @ApiProperty({
    type: [ServiceTranslationDto],
    description:
      'Traducciones del servicio (requerido al menos español e inglés)',
    example: [
      {
        language: 'es',
        name: 'Corte de pelo',
        description: 'Corte profesional con técnicas modernas',
      },
      {
        language: 'en',
        name: 'Haircut',
        description: 'Professional haircut with modern techniques',
      },
    ],
    required: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceTranslationDto)
  translations: ServiceTranslationDto[];

  @ApiProperty({
    type: [PriceDto],
    description: 'Lista de precios y duraciones del servicio',
    example: [
      {
        amount: 25.0,
        duration: 30,
        currency: 'EUR',
      },
      {
        amount: 35.0,
        duration: 45,
      },
    ],
    required: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceDto)
  prices: PriceDto[];
}
