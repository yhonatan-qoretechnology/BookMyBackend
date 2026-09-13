import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { ClientState } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateProfesionalDto } from './create-profesional.dto';

export class UpdateProfesionalDto extends PartialType(
  OmitType(CreateProfesionalDto, ['password'] as const),
) {
  @ApiProperty({
    enum: ClientState,
    required: false,
    description:
      'Estado del profesional. Los administradores que no son SUPER_ADMIN no pueden eliminar: lo inhabilitan con "disabled".',
  })
  @IsOptional()
  @IsEnum(ClientState)
  state?: ClientState;
}
