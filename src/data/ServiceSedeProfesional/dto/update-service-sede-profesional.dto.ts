import { PartialType } from '@nestjs/mapped-types';
import { CreateServiceSedeProfesionalDto } from './create-service-sede-profesional.dto';

export class UpdateServiceSedeProfesionalDto extends PartialType(
  CreateServiceSedeProfesionalDto,
) {}
