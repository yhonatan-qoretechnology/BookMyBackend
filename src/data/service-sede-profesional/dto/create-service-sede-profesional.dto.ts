import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty } from 'class-validator';

export class CreateServiceSedeProfesionalDto {
  @ApiProperty({
    example: 1,
    description: 'ID del servicio',
  })
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  serviceId: number;

  @ApiProperty({
    example: 1,
    description: 'ID de la sede',
  })
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  sedeId: number;

  @ApiProperty({
    example: 1,
    description: 'ID del profesional',
  })
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  profesionalId: number;
}
