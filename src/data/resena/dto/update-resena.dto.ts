import { PartialType } from '@nestjs/swagger';
import { CreateResenaDto } from './create-resena.dto';

export class UpdateResenaDto extends PartialType(CreateResenaDto) {}
