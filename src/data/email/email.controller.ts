import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SendEmailDto } from './dto/send-email.dto';
import { MailService } from './mail.service';

@ApiTags('Email')
@Controller('email')
export class EmailController {
  constructor(private readonly mailService: MailService) {}

  @Post('send-confirmation')
  @ApiOperation({ summary: 'Send a user confirmation email with OTP' })
  async sendConfirmationEmail(@Body() sendEmailDto: SendEmailDto) {
    try {
      await this.mailService.sendUserConfirmation(
        sendEmailDto.email,
        sendEmailDto.name,
        sendEmailDto.otp,
      );
      return { message: 'Confirmation email sent successfully.' };
    } catch (error) {
      console.error('Error sending email:', error);
      return { message: 'An error occurred while sending the email.' };
    }
  }
}
