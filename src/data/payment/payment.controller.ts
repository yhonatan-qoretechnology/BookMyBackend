import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentService } from './payment.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un pago (total o parcial)' })
  async createPayment(@Body() dto: CreatePaymentDto) {
    return this.paymentService.createPayment(dto);
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirmar pago restante en establecimiento' })
  async confirmRemaining(@Param('id') id: string) {
    return this.paymentService.confirmRemainingPayment(Number(id));
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar un pago' })
  async cancelPayment(@Param('id') id: string) {
    return this.paymentService.cancelPayment(Number(id));
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los pagos' })
  async list() {
    return this.paymentService.listPayments();
  }
}
