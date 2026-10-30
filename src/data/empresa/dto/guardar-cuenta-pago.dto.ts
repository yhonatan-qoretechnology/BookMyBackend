import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MetodoCobroOnline } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsIn,
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

  /* ── Solo Colombia (COP): lo que Wise exige del titular ─────────
     Son opcionales en el DTO porque dependen del país de la empresa;
     EmpresaCuentaPagoService los exige cuando el negocio es de CO. */

  @ApiPropertyOptional({ description: 'Código de banco de Wise (GET /empresas/cuenta-pago/bancos)' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  bancoCodigo?: string;

  @ApiPropertyOptional({ example: 'CC', description: 'CC, CE, NIT o PASSPORT' })
  @IsOptional()
  @IsIn(['CC', 'CE', 'NIT', 'PASSPORT'])
  titularDocumentoTipo?: string;

  @ApiPropertyOptional({ example: '1020304050' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  titularDocumentoNumero?: string;

  @ApiPropertyOptional({ example: '+573001234567' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  titularTelefono?: string;

  @ApiPropertyOptional({ example: 'Calle 10 # 20-30' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  titularDireccion?: string;

  @ApiPropertyOptional({ example: 'Bogotá' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  titularCiudad?: string;

  @ApiPropertyOptional({ example: '110111' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  titularCodigoPostal?: string;
}
