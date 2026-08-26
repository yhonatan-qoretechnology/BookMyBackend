import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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

  @Post('send-invoice')
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
