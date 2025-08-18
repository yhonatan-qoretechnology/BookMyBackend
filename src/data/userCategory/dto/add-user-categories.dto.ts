import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt, IsNotEmpty } from 'class-validator';

export class AddUserCategoriesDto {
  @ApiProperty({
    example: [1, 5, 10],
    description:
      'IDs de las categorías que el usuario desea seleccionar. Se reemplazará cualquier selección previa.',
    isArray: true,
    type: Number,
  })
  @IsArray()
  @IsNotEmpty({
    each: true,
    message: 'Cada ID de categoría no puede estar vacío.',
  })
  @IsInt({
    each: true,
    message: 'Cada ID de categoría debe ser un número entero.',
  })
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos una categoría.' })
  categoryIds: number[];
}

// src/user-categories/dto/get-user-categories.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class GetUserCategoriesDto {
  @ApiPropertyOptional({
    example: 'es',
    description:
      'Idioma deseado para las traducciones de categorías (ej. "es", "en"). Si no se especifica, se intenta usar "Accept-Language" del encabezado o "es" por defecto.',
  })
  @IsOptional()
  @IsString()
  @IsIn(['es', 'en'], { message: 'El idioma debe ser "es" o "en".' }) // Asegura que solo se permitan estos idiomas
  lang?: string;
}

// src/user-categories/dto/category-response.dto.ts (Opcional, para tipar la respuesta)

export class CategoryResponseDto {
  @ApiProperty({ example: 1, description: 'ID de la categoría.' })
  id: number;

  @ApiProperty({
    example: 'Tecnología',
    description: 'Nombre de la categoría en el idioma solicitado.',
  })
  name: string;

  @ApiProperty({
    example: 'Servicios relacionados con la tecnología.',
    description: 'Descripción de la categoría en el idioma solicitado.',
    required: false,
  })
  description?: string | null;
}
