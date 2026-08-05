import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/**
 * Cuerpo de PATCH /resenas/:id/aprobar.
 *
 * Antes el controlador tipaba el body a mano y leía `body.aprobado`
 * directamente: si la petición llegaba sin cuerpo, el acceso reventaba
 * con un 500 ("Cannot read properties of undefined") en lugar de
 * responder un 400 explicando qué falta.
 */
export class ApproveResenaDto {
  @ApiProperty({
    example: true,
    description: 'true para aprobar la reseña, false para rechazarla',
  })
  @IsBoolean()
  aprobado: boolean;
}
