import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateUserLocationDto {

  /* Ciudad resuelta en el movil con la geocodificacion inversa del sistema
     operativo. Sin estos campos el ValidationPipe (forbidNonWhitelisted)
     rechazaria con 400 la peticion que manda la app. */

  @ApiPropertyOptional({ example: 'Malaga' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: 'malaga', description: 'En minusculas, para agrupar en las estadisticas.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cityNormalized?: string;

  @ApiPropertyOptional({ example: 'Andalucia' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @ApiPropertyOptional({ example: 'Espana' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;

  /* El modelo de Prisma siempre tuvo `address`, pero el DTO no lo declaraba:
     con forbidNonWhitelisted, la app movil (que lo envia) recibia un 400
     con "property address should not exist" y la ubicacion no se guardaba. */
  @ApiPropertyOptional({ example: 'Arroyo de la Miel' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;
  /* El usuario sale de la ruta (`POST /users/:userId/location`), no del
     cuerpo. Exigirlo aqui hacia que TODA llamada de la app movil, que no lo
     manda, muriera con un 400 "userId must be a number": la ubicacion nunca
     se guardaba y el ranking de ciudades se quedaba vacio. */
  @ApiPropertyOptional({ example: 1, description: 'ID del usuario (redundante: se toma de la ruta)' })
  @IsOptional()
  @IsNumber()
  userId?: number;

  @ApiProperty({ example: 40.7128, description: 'Latitud actual del usuario' })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: -74.006, description: 'Longitud actual del usuario' })
  @IsNumber()
  longitude: number;
}

export class UpdateUserLocationDto {
  @ApiProperty({
    example: 40.73061,
    description: 'Nueva latitud del usuario',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({
    example: -73.935242,
    description: 'Nueva longitud del usuario',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}
