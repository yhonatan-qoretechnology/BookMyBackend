import { ApiProperty, PartialType } from '@nestjs/swagger';
import { UpdateServiceDto } from './update-service.dto';

// Solo para documentación en Swagger — ver nota en
// CreateServiceWithImagesDto sobre el formato real del body multipart.
export class UpdateServiceWithImagesDto extends PartialType(UpdateServiceDto) {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description:
      'Imágenes nuevas a agregar a la galería del servicio (opcional)',
    required: false,
  })
  imagenes?: any[];
}
