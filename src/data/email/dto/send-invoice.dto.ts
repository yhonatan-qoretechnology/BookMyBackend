import { IsArray, IsEmail, IsNumber, IsString } from 'class-validator';

export class InvoiceItemDto {
  @IsString()
  name: string;

  @IsNumber()
  qty: number;

  @IsNumber()
  price: number;

  @IsNumber()
  total: number;
}

export class SendInvoiceDto {
  @IsEmail()
  email: string;

  @IsString()
  clientName: string;

  @IsString()
  sede: string;

  @IsArray()
  services: InvoiceItemDto[];

  @IsNumber()
  subtotal: number;

  @IsNumber()
  total: number;
}
