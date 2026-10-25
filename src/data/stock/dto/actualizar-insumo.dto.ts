import { PartialType } from '@nestjs/swagger';
import { CrearInsumoDto } from './crear-insumo.dto';

/** Edición de un insumo: cualquier campo del alta, todos opcionales. */
export class ActualizarInsumoDto extends PartialType(CrearInsumoDto) {}
