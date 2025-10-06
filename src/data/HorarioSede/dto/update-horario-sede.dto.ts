import { PartialType } from '@nestjs/mapped-types';
import { CreateHorarioSedeDto } from './create-horario-sede.dto';

export class UpdateHorarioSedeDto extends PartialType(CreateHorarioSedeDto) {}
