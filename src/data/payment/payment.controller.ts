import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CreatePaymentCardDto } from './dto/create-payment-card.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePaymentItemDto } from './dto/create-payment-item.dto';
import { PaymentCardResponseDto } from './dto/payment-card-response.dto';
import { UpdatePaymentCardDto } from './dto/update-payment-card.dto';
import { PaymentService } from './payment.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get(':id/items')
  @ApiOperation({ summary: 'Adicionales de una factura' })
  @ApiOkResponse({ description: 'Lista de conceptos adicionales.' })
  async listItems(@Param('id') id: string) {
    return this.paymentService.listPaymentItems(Number(id));
  }

  @Post(':id/items')
  @ApiOperation({
    summary: 'Anadir un adicional a la factura',
    description:
      'Suma el concepto al total de la factura. El total se recalcula en el servidor: base del servicio + adicionales.',
  })
  @ApiCreatedResponse({ description: 'Factura con el total actualizado.' })
  async addItem(@Param('id') id: string, @Body() dto: CreatePaymentItemDto) {
    return this.paymentService.addPaymentItem(Number(id), dto);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Quitar un adicional de la factura' })
  @ApiOkResponse({ description: 'Factura con el total actualizado.' })
  async removeItem(@Param('itemId') itemId: string) {
    return this.paymentService.removePaymentItem(Number(itemId));
  }

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
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filtra los pagos pertenecientes a un usuario específico',
  })
  async list(@Query('userId') userId?: string) {
    return this.paymentService.listPayments(
      userId ? Number(userId) : undefined,
    );
  }

  @Get('filter')
  @ApiOperation({ summary: 'Filtrar pagos por usuario y/o sede' })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filtra los pagos pertenecientes a un usuario específico',
  })
  @ApiQuery({
    name: 'sedeId',
    required: false,
    description: 'Filtra los pagos pertenecientes a una sede específica',
  })
  async filter(
    @Query('userId') userId?: string,
    @Query('sedeId') sedeId?: string,
  ) {
    return this.paymentService.filterPayments({
      userId: userId ? Number(userId) : undefined,
      sedeId: sedeId ? Number(sedeId) : undefined,
    });
  }

  @Post('cards')
  @ApiOperation({ summary: 'Registrar una tarjeta para un usuario' })
  @ApiCreatedResponse({ type: PaymentCardResponseDto })
  async createCard(@Body() dto: CreatePaymentCardDto) {
    return this.paymentService.createPaymentCard(dto);
  }

  @Get('cards/:userId')
  @ApiOperation({ summary: 'Listar tarjetas guardadas de un usuario' })
  @ApiOkResponse({ type: PaymentCardResponseDto, isArray: true })
  async listCards(@Param('userId') userId: string) {
    return this.paymentService.listPaymentCards(Number(userId));
  }

  @Patch('cards/:id')
  @ApiOperation({ summary: 'Actualizar datos de una tarjeta guardada' })
  @ApiOkResponse({ type: PaymentCardResponseDto })
  async updateCard(@Param('id') id: string, @Body() dto: UpdatePaymentCardDto) {
    return this.paymentService.updatePaymentCard(Number(id), dto);
  }

  @Delete('cards/:id')
  @ApiOperation({ summary: 'Eliminar (desactivar) una tarjeta guardada' })
  @ApiOkResponse({ type: PaymentCardResponseDto })
  async removeCard(@Param('id') id: string, @Query('userId') userId?: string) {
    return this.paymentService.removePaymentCard(
      Number(id),
      userId ? Number(userId) : undefined,
    );
  }
}
