import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/** Campos que acompañan al PDF (multipart) en POST /email/send-invoice-pdf. */
export class SendInvoicePdfDto {
  @ApiProperty({ example: 'cliente@correo.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'Ana Pérez' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  clientName?: string;

  @ApiPropertyOptional({ example: 'Glow' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  negocio?: string;

  @ApiPropertyOptional({ example: '1234' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  numero?: string;
}
