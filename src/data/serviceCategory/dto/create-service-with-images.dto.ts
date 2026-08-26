import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateServiceDto } from './create-service.dto';

// Solo para documentación en Swagger: el body real llega como
// multipart/form-data (translations/prices/sedeIds viajan como JSON
// stringificado dentro de campos de texto, ver ServiceController.create).
export class CreateServiceWithImagesDto extends PartialType(CreateServiceDto) {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Imágenes del servicio (opcional)',
    required: false,
  })
  imagenes?: any[];
}
