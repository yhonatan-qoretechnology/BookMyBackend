import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Formularios públicos de bookmy.es: "Contacto" y la solicitud de plan
 * (LeadModal). Antes iban directos a formsubmit.co desde el navegador,
 * donde no había forma de comprobar el CAPTCHA en un servidor.
 */
export class EnviarContactoDto {
  @ApiProperty({ enum: ['contacto', 'solicitud'] })
  @IsIn(['contacto', 'solicitud'])
  origen: 'contacto' | 'solicitud';

  @ApiProperty({ example: 'Lucía Pérez' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  nombre: string;

  @ApiProperty({ example: 'lucia@correo.com' })
  @IsEmail()
  @MaxLength(160)
  correo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string;

  @ApiPropertyOptional({ description: 'Contacto: motivo elegido' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  motivo?: string;

  @ApiPropertyOptional({ description: 'Contacto: mensaje libre' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  mensaje?: string;

  @ApiPropertyOptional({ description: 'Solicitud: plan que le interesa' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  plan?: string;

  @ApiPropertyOptional({ description: 'Solicitud: país' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  pais?: string;

  @ApiPropertyOptional({ description: 'Solicitud: tipo de empresa' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tipoEmpresa?: string;

  /** Trampa para bots: un humano nunca la rellena (está oculta). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  honey?: string;
}
