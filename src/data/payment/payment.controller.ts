import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../auth/common/decorators/public.decorator';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../../auth/common/decorators/auth-user.decorator';
import { Roles } from '../../auth/common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { ModuloPro, PlanProGuard } from '../empresa/plan-pro.guard';
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

  /* ── Pantallas de Facturación del panel: son de Bookmy CRM Pro ──
     El guard va ruta a ruta, NO en el controlador: crear un pago, las
     tarjetas y confirmar/cancelar los usa también la app del cliente,
     que no pertenece a ninguna empresa y exigirPro la rechazaría. */

  @Get(':id/items')
  @ModuloPro('La facturación')
  @UseGuards(PlanProGuard)
  @ApiOperation({ summary: 'Adicionales de una factura' })
  @ApiOkResponse({ description: 'Lista de conceptos adicionales.' })
  async listItems(@Param('id') id: string) {
    return this.paymentService.listPaymentItems(Number(id));
  }

  @Post(':id/items')
  @ModuloPro('La facturación')
  @UseGuards(PlanProGuard)
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
  @ModuloPro('La facturación')
  @UseGuards(PlanProGuard)
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

  /* ── Pago online con Stripe (la pasarela que cobra al cliente) ── */

  @Post('stripe/webhook')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Webhook de Stripe',
    description:
      'Stripe avisa aquí de los cobros completados. Pública, pero con la firma verificada (STRIPE_WEBHOOK_SECRET).',
  })
  stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') firma?: string,
  ) {
    return this.paymentService.procesarWebhookStripe(req.rawBody, firma);
  }

  @Post('stripe/:id/preparar')
  @ApiOperation({
    summary: 'Preparar la hoja de pago de Stripe para un pago online',
    description:
      'Devuelve clientSecret, customerId y ephemeralKey para la hoja de pago de la app.',
  })
  prepararStripe(
    @Param('id', ParseIntPipe) id: number,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.paymentService.prepararCobroStripe(id, user);
  }

  @Post('stripe/:id/confirmar')
  @ApiOperation({
    summary: 'Confirmar un pago online tras la hoja de pago',
    description: 'Consulta a Stripe; si el cobro está hecho, marca PAID y liquida al negocio por Wise.',
  })
  confirmarStripe(
    @Param('id', ParseIntPipe) id: number,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.paymentService.confirmarCobroStripe(id, user);
  }

  @Post('stripe/:id/cancelar')
  @ApiOperation({ summary: 'El cliente abandonó el pago online: anula el cobro y la cita' })
  cancelarStripe(
    @Param('id', ParseIntPipe) id: number,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.paymentService.cancelarCobroStripe(id, user);
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

  @Patch(':id/confirm-wise-transfer')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Confirmar que la transferencia bancaria por Wise llegó a Bookmy',
    description:
      'Solo Bookmy puede ver su propia cuenta Wise, así que esto se confirma a mano. Marca el pago PAID y liquida al negocio.',
  })
  async confirmWiseTransfer(@Param('id') id: string) {
    return this.paymentService.confirmWiseTransfer(Number(id));
  }

  @Get()
  @ModuloPro('La facturación')
  @UseGuards(PlanProGuard)
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
  @ModuloPro('La facturación')
  @UseGuards(PlanProGuard)
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

  /* ── Tarjetas guardadas ──
     El guard global ya exige sesión, pero el userId venía del body/URL:
     cualquiera con sesión podía ver o tocar las tarjetas de otro. Ahora
     cada uno solo opera sobre las suyas (SUPER_ADMIN, sobre cualquiera). */
  private titularDeTarjetas(user: AuthenticatedUser, userId?: number) {
    if (user.role === Role.SUPER_ADMIN && userId) return userId;
    if (userId && userId !== user.userId)
      throw new ForbiddenException('Solo puede gestionar sus propias tarjetas.');
    return user.userId;
  }

  @Post('cards')
  @ApiOperation({ summary: 'Registrar una tarjeta para el usuario de la sesión' })
  @ApiCreatedResponse({ type: PaymentCardResponseDto })
  async createCard(
    @Body() dto: CreatePaymentCardDto,
    @AuthUser() user: AuthenticatedUser,
  ) {
    const userId = this.titularDeTarjetas(user, dto.userId);
    return this.paymentService.createPaymentCard({ ...dto, userId });
  }

  @Get('cards/:userId')
  @ApiOperation({ summary: 'Listar tarjetas guardadas de un usuario' })
  @ApiOkResponse({ type: PaymentCardResponseDto, isArray: true })
  async listCards(
    @Param('userId') userId: string,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.paymentService.listPaymentCards(
      this.titularDeTarjetas(user, Number(userId)),
    );
  }

  @Patch('cards/:id')
  @ApiOperation({ summary: 'Actualizar datos de una tarjeta guardada' })
  @ApiOkResponse({ type: PaymentCardResponseDto })
  async updateCard(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentCardDto,
    @AuthUser() user: AuthenticatedUser,
  ) {
    const userId = this.titularDeTarjetas(user, dto.userId);
    return this.paymentService.updatePaymentCard(Number(id), { ...dto, userId });
  }

  @Delete('cards/:id')
  @ApiOperation({ summary: 'Eliminar (desactivar) una tarjeta guardada' })
  @ApiOkResponse({ type: PaymentCardResponseDto })
  async removeCard(
    @Param('id') id: string,
    @AuthUser() user: AuthenticatedUser,
    @Query('userId') userId?: string,
  ) {
    return this.paymentService.removePaymentCard(
      Number(id),
      this.titularDeTarjetas(user, userId ? Number(userId) : undefined),
    );
  }
}
