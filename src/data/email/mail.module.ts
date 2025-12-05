import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailController } from './email.controller';
import { MAIL_TRANSPORTER } from './mail.constants';
import { MailService } from './mail.service';

@Module({
  imports: [ConfigModule],
  controllers: [EmailController],
  providers: [
    MailService,
    {
      provide: MAIL_TRANSPORTER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        nodemailer.createTransport({
          host: configService.get<string>('EMAIL_HOST'),
          port: Number(configService.get<string>('EMAIL_PORT')),
          secure: configService.get<string>('EMAIL_SECURE') === 'true',
          auth: {
            user: configService.get<string>('EMAIL_USER'),
            pass: configService.get<string>('EMAIL_PASS'),
          },
        }),
    },
  ],
  exports: [MailService],
})
export class MailModule {}
