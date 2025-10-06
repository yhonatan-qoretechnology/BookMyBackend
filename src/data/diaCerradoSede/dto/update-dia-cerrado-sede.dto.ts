import { PartialType } from '@nestjs/mapped-types';
import { CreateDiaCerradoSedeDto } from './create-dia-cerrado-sede.dto';

export class UpdateDiaCerradoSedeDto extends PartialType(
  CreateDiaCerradoSedeDto,
) {}
