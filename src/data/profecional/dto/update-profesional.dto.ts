import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateProfesionalDto } from './create-profesional.dto';

export class UpdateProfesionalDto extends PartialType(
  OmitType(CreateProfesionalDto, ['password'] as const),
) {}
