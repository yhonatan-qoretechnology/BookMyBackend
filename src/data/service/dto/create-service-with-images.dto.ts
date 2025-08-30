import { ApiProperty } from '@nestjs/swagger';
import { CreateServiceDto } from './create-service.dto';

export class CreateServiceWithImagesDto extends CreateServiceDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    required: false,
  })
  imagenes?: string[];
}
