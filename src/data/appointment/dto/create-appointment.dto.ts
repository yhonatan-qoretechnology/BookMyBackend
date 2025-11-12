import { ApiProperty } from '@nestjs/swagger';
import { AppointmentStatus, PaymentMethod } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty({
    example: '2025-10-07T00:00:00Z',
    description: 'Fecha de la cita',
  })
  @IsDateString()
  fecha: string;

  @ApiProperty({
    example: '2025-10-07T09:00:00Z',
    description: 'Hora de inicio de la cita',
  })
  @IsDateString()
  horaInicio: string;

  @ApiProperty({
    example: '2025-10-07T09:30:00Z',
    description: 'Hora de fin de la cita',
  })
  @IsDateString()
  horaFin: string;

  @ApiProperty({ example: 30, description: 'Duración del servicio en minutos' })
  @IsInt()
  @Min(1)
  duracion: number;

  @ApiProperty({ enum: AppointmentStatus, example: AppointmentStatus.PENDING })
  @IsEnum(AppointmentStatus)
  @IsOptional()
  estado?: AppointmentStatus;

  @ApiProperty({
    example: 'Cliente solicita atención urgente',
    required: false,
  })
  @IsString()
  @IsOptional()
  notas?: string;

  @ApiProperty({ example: 1, description: 'ID de la sede' })
  @IsInt()
  sedeId: number;

  @ApiProperty({ example: 2, description: 'ID del servicio' })
  @IsInt()
  serviceId: number;

  @ApiProperty({ example: 3, description: 'ID del profesional asignado' })
  @IsInt()
  profesionalId: number;

  @ApiProperty({
    example: 5,
    description: 'ID del usuario que solicita la cita',
  })
  @IsInt()
  userId: number;

  @ApiProperty({
    example: PaymentMethod.CARD,
    enum: PaymentMethod,
    description: 'Método de pago elegido para la cita',
  })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({
    example: 100,
    required: false,
    description:
      'Monto total del servicio. Si no se envía, se usa la tarifa configurada.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paymentAmount?: number;

  @ApiProperty({
    example: '4242424242424242',
    required: false,
    description:
      'Número de tarjeta, obligatorio solo cuando el pago es con tarjeta.',
  })
  @ValidateIf((o) => o.paymentMethod === PaymentMethod.CARD)
  @IsString()
  @Matches(/^[0-9]{13,19}$/)
  cardNumber?: string;

  @ApiProperty({
    example: '12/26',
    required: false,
    description:
      'Fecha de expiración (MM/YY), obligatoria para pagos con tarjeta.',
  })
  @ValidateIf((o) => o.paymentMethod === PaymentMethod.CARD)
  @IsString()
  @Matches(/^(0[1-9]|1[0-2])\/[0-9]{2}$/)
  expiryDate?: string;

  @ApiProperty({
    example: '123',
    required: false,
    description: 'CVV de la tarjeta, obligatorio para pagos con tarjeta.',
  })
  @ValidateIf((o) => o.paymentMethod === PaymentMethod.CARD)
  @IsString()
  @Matches(/^[0-9]{3,4}$/)
  cvv?: string;
}
