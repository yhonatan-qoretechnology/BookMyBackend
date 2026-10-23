import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MetodoCobroOnline } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** Alta/edición de cómo cobra online un negocio: Wise o cuenta bancaria. */
export class GuardarCuentaPagoDto {
  @ApiProperty({ enum: MetodoCobroOnline, example: MetodoCobroOnline.WISE })
  @IsEnum(MetodoCobroOnline)
  metodo: MetodoCobroOnline;

  @ApiPropertyOptional({ example: 'pagos@minegocio.com' })
  @ValidateIf((o) => o.metodo === MetodoCobroOnline.WISE)
  @IsEmail()
  wiseEmail?: string;

  @ApiPropertyOptional({ example: 'María González' })
  @ValidateIf((o) => o.metodo === MetodoCobroOnline.BANCO)
  @IsString()
  @MaxLength(160)
  bancoTitular?: string;

  @ApiPropertyOptional({ example: 'ES7620770024003102575766' })
  @ValidateIf((o) => o.metodo === MetodoCobroOnline.BANCO)
  @IsString()
  @MaxLength(40)
  bancoNumero?: string;

  @ApiPropertyOptional({ example: 'ahorros', description: 'Solo Colombia.' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bancoTipoCuenta?: string;
}
