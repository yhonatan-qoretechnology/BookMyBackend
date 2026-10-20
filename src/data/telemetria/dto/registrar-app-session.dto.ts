import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/**
 * Apertura de la app móvil. Proxy de "distribución por plataforma/país"
 * mientras no existan las credenciales de App Store Connect / Google Play
 * Developer API para el conteo real de descargas (mismo caso que Wise:
 * scaffold listo, falta la pieza final que depende de un tercero).
 */
export class RegistrarAppSessionDto {
  @ApiProperty({ enum: ['ios', 'android'], example: 'ios' })
  @IsIn(['ios', 'android'])
  plataforma: 'ios' | 'android';
}
