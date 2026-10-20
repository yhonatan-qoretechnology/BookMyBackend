import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EstadoPagoPlan, PlanEmpresa } from '@prisma/client';
import { BOOKMY_EVENTS } from '../../common/events/event-names';
import { MailService } from '../email/mail.service';
import { PrismaService } from '../../prisma/prisma.service';

/** Días antes del vencimiento de la prueba en que se manda el aviso. */
const DIAS_ANTES_DE_AVISAR_TRIAL = 3;

/**
 * Único cron del proyecto (primer uso de @nestjs/schedule acá): revisa
 * diariamente pagos de Bookmy CRM Pro vencidos y pruebas por terminar.
 * Cada fila se procesa en su propio try/catch — un email que falla (o una
 * empresa sin correo) nunca debe frenar el resto del lote, misma filosofía
 * best-effort que AccesoUsuarioService.
 */
@Injectable()
export class EmpresaPlanPagoCron {
  private readonly logger = new Logger(EmpresaPlanPagoCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async revisarPagosYPruebas() {
    await this.revisarPagosVencidos();
    await this.revisarPruebasPorVencer();
  }

  private async revisarPagosVencidos() {
    const vencidos = await this.prisma.empresaPlanPago.findMany({
      where: { estado: EstadoPagoPlan.PENDIENTE, vence: { lt: new Date() }, notificado: false },
      include: { empresa: { select: { id: true, nombre: true, email: true } } },
    });

    for (const pago of vencidos) {
      try {
        await this.prisma.empresaPlanPago.update({
          where: { id: pago.id },
          data: { estado: EstadoPagoPlan.VENCIDO, notificado: true },
        });

        if (pago.empresa.email) {
          await this.mailService.sendPlanPagoVencido({
            to: pago.empresa.email,
            empresaNombre: pago.empresa.nombre,
            monto: pago.monto.toFixed(2),
            vence: pago.vence.toLocaleDateString('es-ES'),
          });
        }

        this.eventEmitter.emit(BOOKMY_EVENTS.PLAN_PAGO_VENCIDO, {
          empresaId: pago.empresaId,
          pagoId: pago.id,
        });
      } catch (error) {
        this.logger.error(
          `No se pudo procesar el vencimiento del pago ${pago.id}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }
  }

  private async revisarPruebasPorVencer() {
    const limite = new Date();
    limite.setDate(limite.getDate() + DIAS_ANTES_DE_AVISAR_TRIAL);

    const porVencer = await this.prisma.empresa.findMany({
      where: {
        plan: PlanEmpresa.FREE,
        trialEndsAt: { not: null, gt: new Date(), lte: limite },
        trialAvisoEnviado: false,
      },
      select: { id: true, nombre: true, email: true, trialEndsAt: true },
    });

    for (const empresa of porVencer) {
      try {
        const diasRestantes = Math.max(
          0,
          Math.ceil((empresa.trialEndsAt!.getTime() - Date.now()) / 86_400_000),
        );

        await this.prisma.empresa.update({
          where: { id: empresa.id },
          data: { trialAvisoEnviado: true },
        });

        if (empresa.email) {
          await this.mailService.sendTrialPorVencer({
            to: empresa.email,
            empresaNombre: empresa.nombre,
            diasRestantes,
          });
        }

        this.eventEmitter.emit(BOOKMY_EVENTS.TRIAL_POR_VENCER, {
          empresaId: empresa.id,
          diasRestantes,
        });
      } catch (error) {
        this.logger.error(
          `No se pudo avisar la prueba por vencer de la empresa ${empresa.id}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }
  }
}
