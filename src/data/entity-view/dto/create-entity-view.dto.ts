import { ApiProperty } from '@nestjs/swagger';
import { ViewEntityType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

/** Una vista de catalogo: quien mira que ficha. La registra la app movil. */
export class CreateEntityViewDto {
  @ApiProperty({ enum: ViewEntityType, example: ViewEntityType.SERVICIO })
  @IsEnum(ViewEntityType)
  entityType: ViewEntityType;

  @ApiProperty({ example: 12, description: 'Id de la entidad que se ha visto.' })
  @IsInt()
  entityId: number;

  @ApiProperty({ required: false, description: 'Empresa a la que pertenece, para acotar rankings por negocio.' })
  @IsOptional() @IsInt()
  empresaId?: number;

  @ApiProperty({ required: false, description: 'Sede a la que pertenece.' })
  @IsOptional() @IsInt()
  sedeId?: number;

  @ApiProperty({ required: false, example: 'Malaga' })
  @IsOptional() @IsString() @MaxLength(120)
  city?: string;
}
