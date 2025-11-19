import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt, IsNotEmpty } from 'class-validator';

export class SaveUserCategoriesDto {
  @ApiProperty({
    example: [1, 5, 10],
    description:
      'IDs de las categorías que el usuario selecciona. Se reemplazarán las selecciones previas.',
    isArray: true,
    type: Number,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos una categoría.' })
  @IsNotEmpty({ each: true })
  @IsInt({ each: true, message: 'Cada ID de categoría debe ser un entero.' })
  categoryIds: number[];
}
