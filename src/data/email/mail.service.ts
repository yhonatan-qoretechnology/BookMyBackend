import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
    constructor(private mailerService: MailerService) {}

    async sendUserConfirmation(email: string, name: string) {
        const url = `http://localhost:3000/confirm?token=123`;

        await this.mailerService.sendMail({
            to: email,
            subject: '¡Bienvenido! Confirma tu correo',
            text: `Hola ${name}, gracias por registrarte. Por favor, confirma tu correo haciendo clic en el siguiente enlace: ${url}`,
        });
    }
}
