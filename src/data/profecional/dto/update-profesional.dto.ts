import { PartialType } from '@nestjs/swagger';
import { CreateProfesionalDto } from './create-profesional.dto';

export class UpdateProfesionalDto extends PartialType(CreateProfesionalDto) {}
