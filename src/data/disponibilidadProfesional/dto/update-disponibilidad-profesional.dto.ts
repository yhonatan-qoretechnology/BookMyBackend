import { PartialType } from '@nestjs/mapped-types';
import { CreateDisponibilidadProfesionalDto } from './create-disponibilidad-profesional.dto';

export class UpdateDisponibilidadProfesionalDto extends PartialType(
  CreateDisponibilidadProfesionalDto,
) {}
