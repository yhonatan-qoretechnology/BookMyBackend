import { PartialType } from '@nestjs/swagger';
import { CreateCitaDto } from './createCita.dto';

export class UpdateCitaDto extends PartialType(CreateCitaDto) {}
