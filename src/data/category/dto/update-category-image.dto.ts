import { ApiProperty } from '@nestjs/swagger';

export class UpdateCategoryImageDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Nueva imagen de la categoría',
  })
  image: any;
}
