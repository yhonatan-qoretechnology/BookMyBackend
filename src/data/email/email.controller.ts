import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Roles } from '../../auth/common/decorators/roles.decorator';
import { SendInvoiceDto } from './dto/send-invoice.dto';
import { MailService } from './mail.service';

@ApiTags('Email')
@Controller('email')
export class EmailController {
  constructor(private readonly mailService: MailService) {}

  /*
   * Aquí vivía `POST /email/send-confirmation`, que recibía el OTP en el cuerpo
   * y lo enviaba por correo. Era una vía de verificación falsificable: el
   * código lo elegía quien llamaba, así que cualquiera podía pedir que se
   * enviara el OTP que quisiera y luego "verificarlo". Además estaba abierto
   * sin autenticación, servía para mandar correos a cualquier dirección en
   * nombre de Bookmy.
   *
   * El alta real va por `POST /otp/send` + `POST /otp/verify`: es
   * `OtpService.sendOtp` quien genera el código, lo guarda y lo envía con
   * `MailService.sendUserConfirmation` (que sigue existiendo para ese uso).
   */

  // enviar pdf

  /* Bastaba cualquier sesión, incluida la de un cliente recién registrado,
     para mandar a cualquier correo una "Factura BookMy" con importes
     inventados (phishing desde nuestro dominio), y cada llamada lanza
     Puppeteer. Lo usa el panel: queda para administradores y con tope. */
  @Post('send-invoice')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Enviar factura PDF',
  })
  async sendInvoice(@Body() sendInvoiceDto: SendInvoiceDto) {
    await this.mailService.sendInvoiceEmail(sendInvoiceDto);

    return {
      message: 'Factura enviada correctamente',
    };
  }
}
