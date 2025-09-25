import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendUserConfirmation(email: string, otp: string) {
    const url = `http://localhost:3000/confirm?token=${otp}`;

    await this.mailerService.sendMail({
      to: email,
      subject: '¡Bienvenido! Confirma tu correo',
      template: 'welcome', // Usamos solo el nombre del archivo
      context: {
        email,
        otp,
        url,
      },
    });
  }
}
