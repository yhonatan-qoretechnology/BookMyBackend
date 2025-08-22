import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateEmpresaDto } from './create-empresa.dto';

// Este DTO es solo para documentación de Swagger y combina los campos de texto con el campo del archivo
export class CreateEmpresaWithFileDto extends PartialType(CreateEmpresaDto) {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Logo de la empresa',
  })
  logo?: string;
}
