import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';

export class CreateUserLocationDto {
  @ApiProperty({ example: 1, description: 'ID del usuario' })
  @IsNumber()
  userId: number;

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
