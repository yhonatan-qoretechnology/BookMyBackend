import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../auth/common/decorators/public.decorator';
import { Recaptcha } from '../../common/recaptcha/recaptcha.guard';
import { MailService } from '../email/mail.service';
import { EnviarContactoDto } from './dto/enviar-contacto.dto';

@ApiTags('Contacto')
@Controller('contacto')
export class ContactoController {
  constructor(private readonly mail: MailService) {}

  /* Pública (la usa la web sin sesión), con CAPTCHA obligatorio y
     limitada por IP: es exactamente lo que buscan los bots de spam. */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Recaptcha({ accion: 'contacto' })
  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Enviar el formulario de contacto o de solicitud de plan de bookmy.es' })
  async enviar(@Body() dto: EnviarContactoDto) {
    /* La trampa rellena = bot. Se responde "ok" para no darle pistas. */
    if (dto.honey) return { ok: true };
    await this.mail.sendContacto(dto);
    return { ok: true };
  }
}
