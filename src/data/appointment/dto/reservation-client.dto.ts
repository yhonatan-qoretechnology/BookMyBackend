import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ReservationClientDto {
  @ApiProperty({ example: 'cliente@email.com', description: 'Email del cliente' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '12345678A', description: 'Documento del cliente' })
  @IsOptional()
  @IsString()
  document?: string;
}

export class ReservationClientResponseDto {
  @ApiProperty({ example: true, description: 'Si se encontró el cliente' })
  found: boolean;

  @ApiPropertyOptional({ 
    example: {
      id: 123,
      email: 'cliente@email.com',
      name: 'Juan Pérez',
      phone: '+123456789',
      document: '12345678A'
    }, 
    description: 'Datos del cliente encontrado' 
  })
  client?: {
    id: number;
    email: string;
    name?: string;
    phone?: string;
    document?: string;
  };

  @ApiProperty({ example: 'Cliente encontrado', description: 'Mensaje de estado' })
  message: string;

  @ApiPropertyOptional({ 
    example: 'CREATE_CLIENT', 
    description: 'Acción sugerida si no se encuentra' 
  })
  suggestedAction?: string;

  @ApiPropertyOptional({ 
    example: { email: 'cliente@email.com', document: '12345678A' }, 
    description: 'Parámetros usados en la búsqueda' 
  })
  searchParams?: {
    email?: string;
    document?: string;
  };
}
