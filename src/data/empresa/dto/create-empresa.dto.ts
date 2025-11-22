import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreateEmpresaDto {
  @ApiProperty({
    example: 'Barbería La Clave',
    description: 'Nombre de la empresa',
  })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiProperty({
    example: '573123456789',
    description: 'Número de teléfono',
    required: false,
  })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({
    example: 'contacto@barberialaclave.com',
    description: 'Correo electrónico',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: '900123456-7',
    description: 'Número de identificación tributaria (NIT)',
    required: false,
  })
  @IsOptional()
  @IsString()
  nit?: string;

  @ApiProperty({
    example: 'Especialistas en cortes y cuidado de barba.',
    description: 'Descripción',
    required: false,
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({
    example:
      'Queremos que Glow esté presente en cada rincón del mundo, ofreciendo a las mujeres un espacio donde puedan ser ellas mismas y sentirse aún más hermosas.',
    description: 'Descripción larga de la empresa',
    required: false,
  })
  @IsOptional()
  @IsString()
  descripcionLarga?: string;

  @ApiProperty({
    example: 'https://www.facebook.com/tuempresa',
    description: 'URL de la página de Facebook',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  facebookUrl?: string;

  @ApiProperty({
    example: 'https://www.instagram.com/tuempresa',
    description: 'URL de la cuenta de Instagram',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  instagramUrl?: string;

  @ApiProperty({
    example: 'https://www.tiktok.com/@tuempresa',
    description: 'URL de la cuenta de TikTok',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  tiktokUrl?: string;

  @ApiProperty({
    example: 'https://www.tuempresa.com',
    description: 'Sitio web de la empresa',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  webUrl?: string;
}
