import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Datos de texto del envío de verificación. Los archivos van como
 * multipart (documentoFrente, documentoDorso, selfie, justificante).
 */
export class EnviarKycDto {
  @ApiProperty({
    example: 'B12345678',
    required: false,
    description: 'NIF/CIF del negocio',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  nifCif?: string;

  @ApiProperty({
    example: 'DNI',
    required: false,
    description: 'Tipo de documento del responsable (DNI, NIE, Pasaporte…)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  documentoTipo?: string;
}
