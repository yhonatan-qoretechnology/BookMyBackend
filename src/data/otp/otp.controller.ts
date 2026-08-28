import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../auth/common/decorators/public.decorator';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from './otp.service';

@Controller('otp')
@UseGuards(ThrottlerGuard)
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  /* Sin sesión a propósito: es el paso previo a tenerla (activar cuenta
     y recuperar contraseña). Lo protege el rate limit, no el token. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('send')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.otpService.sendOtp(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.otpService.verifyOtp(dto);
  }
}
