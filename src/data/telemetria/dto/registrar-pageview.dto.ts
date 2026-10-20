import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Una visita de página del panel o del sitio público. La manda el propio
    navegador (PageviewTracker), sin sesión obligatoria. */
export class RegistrarPageviewDto {
  @ApiProperty({ example: '/accesos' })
  @IsString() @IsNotEmpty() @MaxLength(255)
  ruta: string;

  /** Id de visitante anónimo (localStorage): en la web pública la mayoría
      no tiene sesión, así que es lo único que agrupa "misma persona". */
  @ApiProperty({ example: 'a3f9c1e2-...' })
  @IsString() @IsNotEmpty() @MaxLength(64)
  sesionId: string;
}
