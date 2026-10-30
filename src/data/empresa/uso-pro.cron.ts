import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UsoProService } from './uso-pro.service';

/** Cada lunes a las 9:00 (hora de Madrid) revisa el uso de los negocios Pro. */
@Injectable()
export class UsoProCron {
  private readonly logger = new Logger(UsoProCron.name);

  constructor(private readonly usoPro: UsoProService) {}

  @Cron('0 9 * * 1', { timeZone: 'Europe/Madrid' })
  async revisarSemanal() {
    try {
      await this.usoPro.revisarYAvisar();
    } catch (error) {
      this.logger.error(`Falló la revisión semanal de uso de Pro: ${error instanceof Error ? error.message : error}`);
    }
  }
}
