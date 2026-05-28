import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import Handlebars from 'handlebars';
import type { Transporter } from 'nodemailer';
import { join } from 'path';
import * as puppeteer from 'puppeteer';

import { SendInvoiceDto } from './dto/send-invoice.dto';
import { MAIL_TRANSPORTER } from './mail.constants';

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_TRANSPORTER)
    private readonly transporter: Transporter,

    private readonly configService: ConfigService,
  ) {}

  async sendUserConfirmation(email: string, otp: string) {
    const url = `${
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3000'
    }/confirm?token=${otp}`;

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

      html: template({
        email,
        otp,
        url,
      }),
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

      html: template({
        email,
        otp,
      }),
    });
  }

  // 🔥 GENERAR PDF
  async generateInvoicePdf(data: any): Promise<Buffer> {
    const templatePathFromSrc = join(
      process.cwd(),
      'src',
      'data',
      'pdf',
      'templates',
      'invoice.hbs',
    );

    let templateSource: string;

    try {
      templateSource = await readFile(templatePathFromSrc, 'utf-8');
    } catch {
      const templatePathFromDist = join(
        __dirname,
        'pdf',
        'templates',
        'invoice.hbs',
      );

      templateSource = await readFile(templatePathFromDist, 'utf-8');
    }

    const template = Handlebars.compile(templateSource);

    const finalHtml = template(data);

    const browser = await puppeteer.launch({
      headless: true,
    });

    const page = await browser.newPage();

    await page.setContent(finalHtml, {
      waitUntil: 'load',
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    await browser.close();

    return Buffer.from(pdf);
  }

  // 🔥 ENVIAR FACTURA PDF
  async sendInvoiceEmail(data: SendInvoiceDto) {
    const pdf = await this.generateInvoicePdf({
      clientName: data.clientName,

      sede: data.sede,

      invoiceNumber: `INV-${Date.now()}`,

      date: new Date().toLocaleDateString(),

      services: data.services,

      subtotal: data.subtotal,

      total: data.total,
    });

    await this.transporter.sendMail({
      to: data.email,

      subject: 'Factura BookMy',

      html: `
        <h2>Gracias por tu compra</h2>
        <p>Adjuntamos tu factura en PDF.</p>
      `,

      attachments: [
        {
          filename: 'factura.pdf',
          content: pdf,
        },
      ],
    });
  }
}
