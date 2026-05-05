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
    const templatePathFromSrc = join(
      process.cwd(),
      'src',
      'data',
      'email',
      'templates',
      'welcome.hbs',
    );

    let templateSource: string;

    try {
      templateSource = await readFile(templatePathFromSrc, 'utf-8');
    } catch {
      const templatePathFromDist = join(__dirname, 'templates', 'welcome.hbs');
      templateSource = await readFile(templatePathFromDist, 'utf-8');
    }
    const template = Handlebars.compile(templateSource);

    await this.transporter.sendMail({
      to: email,
      subject: '¡Bienvenido! Confirma tu correo',
      html: template({ email, otp, url }),
    });
  }

  async sendPasswordResetOtp(email: string, otp: string) {
    const templatePathFromSrc = join(
      process.cwd(),
      'src',
      'data',
      'email',
      'templates',
      'reset-password.hbs',
    );

    let templateSource: string;

    try {
      templateSource = await readFile(templatePathFromSrc, 'utf-8');
    } catch {
      const templatePathFromDist = join(
        __dirname,
        'templates',
        'reset-password.hbs',
      );
      templateSource = await readFile(templatePathFromDist, 'utf-8');
    }

    const template = Handlebars.compile(templateSource);

    await this.transporter.sendMail({
      to: email,
      subject: 'Código para restablecer tu contraseña',
      html: template({ email, otp }),
    });
  }
}
