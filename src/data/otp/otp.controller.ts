import { Body, Controller, Post } from '@nestjs/common';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from './otp.service';

@Controller('otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('send')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.otpService.sendOtp(dto);
  }

  @Post('verify')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.otpService.verifyOtp(dto);
  }
}
