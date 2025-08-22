import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateSedeDto } from './create-sede.dto';

export class CreateSedeWithImagesDto extends PartialType(CreateSedeDto) {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Imágenes para el carrusel de la sede',
  })
  imagenes?: any[];
}
