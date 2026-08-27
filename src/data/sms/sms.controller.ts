import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SendSmsDto } from './dto/send-sms.dto';
import { SmsService } from './sms.service';

@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  /* Ya exige token (guard global), pero una cuenta comprometida podía
     vaciar el saldo de Twilio en un bucle. */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('send-sms')
  @ApiOperation({ summary: 'Enviar un mensaje SMS' })
  @ApiResponse({ status: 201, description: 'Mensaje enviado correctamente.' })
  @ApiResponse({ status: 500, description: 'Fallo al enviar el mensaje.' })
  async sendSms(@Body() dto: SendSmsDto) {
    return this.smsService.sendMessage(dto.phone, dto.message);
  }
}
