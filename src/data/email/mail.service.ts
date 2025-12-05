import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import Handlebars from 'handlebars';
import type { Transporter } from 'nodemailer';
import { join } from 'path';
import { MAIL_TRANSPORTER } from './mail.constants';

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_TRANSPORTER) private readonly transporter: Transporter,
    private readonly configService: ConfigService,
  ) {}

  async sendUserConfirmation(email: string, otp: string) {
    const url = `${this.configService.get<string>('APP_URL') ?? 'http://localhost:3000'}/confirm?token=${otp}`;
    const templatePath = join(__dirname, 'templates', 'welcome.hbs');
    const templateSource = await readFile(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);

    await this.transporter.sendMail({
      to: email,
      subject: '¡Bienvenido! Confirma tu correo',
      html: template({ email, otp, url }),
    });
  }
}
