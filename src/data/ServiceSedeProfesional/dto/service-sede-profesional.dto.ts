import { ApiProperty } from '@nestjs/swagger';

export class ServiceSedeProfesionalDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: 1 })
  sedeId: number;

  @ApiProperty({ example: 2 })
  serviceId: number;

  @ApiProperty({ example: 3, required: false })
  profesionalId?: number;
}
