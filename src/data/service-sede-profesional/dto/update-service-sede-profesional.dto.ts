import { PartialType } from '@nestjs/swagger';
import { CreateServiceSedeProfesionalDto } from './create-service-sede-profesional.dto';

export class UpdateServiceSedeProfesionalDto extends PartialType(
  CreateServiceSedeProfesionalDto,
) {}
