import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SendSmsDto } from './dto/send-sms.dto';
import { SmsService } from './sms.service';

@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @Post('send-sms')
  @ApiOperation({ summary: 'Enviar un mensaje SMS' })
  @ApiResponse({ status: 201, description: 'Mensaje enviado correctamente.' })
  @ApiResponse({ status: 500, description: 'Fallo al enviar el mensaje.' })
  async sendSms(@Body() dto: SendSmsDto) {
    return this.smsService.sendMessage(dto.phone, dto.message);
  }
}
