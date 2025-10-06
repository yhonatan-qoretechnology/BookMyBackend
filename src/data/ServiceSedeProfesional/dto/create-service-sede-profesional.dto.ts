import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class CreateServiceSedeProfesionalDto {
  @ApiProperty({ example: 1, description: 'ID de la sede asociada' })
  @IsInt()
  @Min(1)
  sedeId: number;

  @ApiProperty({ example: 2, description: 'ID del servicio asociado' })
  @IsInt()
  @Min(1)
  serviceId: number;

  @ApiProperty({
    example: 3,
    description:
      'ID del profesional (opcional). Si se pasa, debe pertenecer a la sede.',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  profesionalId?: number;
}
