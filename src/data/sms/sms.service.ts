import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class SmsService {
  private readonly client: Twilio;

  constructor(private readonly config: ConfigService) {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    this.client = new Twilio(accountSid, authToken);
  }

  async sendMessage(to: string, body: string) {
    const from = this.config.get<string>('TWILIO_PHONE_NUMBER');

    try {
      const message = await this.client.messages.create({ body, from, to });

      return {
        sid: message.sid,
        status: message.status,
        to: message.to,
        body: message.body,
        createdAt: message.dateCreated,
      };
    } catch (error) {
      console.error('Error sending SMS:', error.message);
      throw new Error('Failed to send SMS');
    }
  }

  private readonly logger = new Logger(SmsService.name);

  async sendSms(phone: string, message: string): Promise<void> {
    // Simula envío (sustituye con Twilio u otro)
    this.logger.log(`SMS enviado a ${phone}: ${message}`);
    console.log(`SMS enviado a ${phone}: ${message}`);
  }
}
