import { ApiProperty } from '@nestjs/swagger';
import { CreateCategoryDto } from 'src/data/category/dto/create-category.dto';

export class CreateCategoryWithFileDto extends CreateCategoryDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Archivo de imagen de la categoría (opcional)',
  })
  declare image?: any; // <-- Evita el error TS2612
}
