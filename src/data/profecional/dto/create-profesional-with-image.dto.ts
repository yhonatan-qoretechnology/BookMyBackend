import { ApiProperty } from '@nestjs/swagger';
import { CreateProfesionalDto } from './create-profesional.dto';

export class CreateProfesionalWithImageDto extends CreateProfesionalDto {
  @ApiProperty({ type: 'string', format: 'binary', required: false })
  imagen?: string;
}
