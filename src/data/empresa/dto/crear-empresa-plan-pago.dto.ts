import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, Min } from 'class-validator';

/** Alta manual de un cobro de Bookmy CRM Pro. No hay cobro automático
    todavía: el SUPER_ADMIN carga el monto y la fecha de vencimiento. */
export class CrearEmpresaPlanPagoDto {
  @ApiProperty({ example: 49.0 })
  @Type(() => Number) @IsNumber() @Min(0.01)
  monto: number;

  @ApiProperty({ example: '2026-11-19' })
  @IsDateString()
  vence: string;
}
