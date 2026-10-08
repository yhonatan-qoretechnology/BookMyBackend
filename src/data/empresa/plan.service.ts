import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Empresa, PlanEmpresa, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';

/**
 * Bookmy CRM Pro no se ofrece todavia.
 *
 * Con esto en false no se regala la prueba al crear una cuenta, no se
 * puede activar desde el panel y el aviso deja de ofrecerla. Lo que NO
 * hace es quitarsela a quien ya la tiene: una empresa con PRO contratado
 * sigue usando sus modulos, porque apagar la venta no es lo mismo que
 * retirarle funciones a un negocio que ya trabaja con ellas.
 *
 * Para volver a abrirlo basta con ponerlo en true.
 */
export const PRO_SE_OFRECE = false;

/** Días que duraría la prueba, el día que se vuelva a ofrecer. */
export const DIAS_DE_PRUEBA = 7;

export interface EstadoPlan {
  /** Lo contratado: FREE o PRO. */
  plan: PlanEmpresa;
  /** Lo que de verdad puede usar hoy (la prueba cuenta como PRO). */
  planEfectivo: PlanEmpresa;
  /** Fin de la prueba, en ISO. null si nunca la activó. */
  trialEndsAt: string | null;
  /** true mientras la prueba sigue viva. */
  enPrueba: boolean;
  /** Días completos que le quedan de prueba (0 si ya caducó). */
  diasDePrueba: number;
  /** true si la prueba existió y ya se acabó: es el momento de vender. */
  pruebaCaducada: boolean;
  /** true si todavía puede pedir los 30 días. */
  puedeProbar: boolean;
}

type EmpresaPlan = Pick<Empresa, 'plan' | 'trialEndsAt' | 'trialUsed'>;

/**
 * Plan de un negocio y su prueba.
 *
 * El plan efectivo no se guarda: se calcula comparando la fecha de fin de
 * prueba con hoy. Así una prueba caduca sola, sin ningún proceso que
 * recorra las empresas degradándolas (y sin que una caída de ese proceso
 * regale Pro indefinidamente).
 */
@Injectable()
export class PlanService {
  constructor(private prisma: PrismaService) {}

  /** Estado del plan a partir de los campos de la empresa. */
  estado(empresa: EmpresaPlan): EstadoPlan {
    const fin = empresa.trialEndsAt ? new Date(empresa.trialEndsAt) : null;
    const ahora = new Date();
    const enPrueba = !!fin && fin.getTime() > ahora.getTime();
    const diasDePrueba = enPrueba
      ? Math.ceil((fin!.getTime() - ahora.getTime()) / 86_400_000)
      : 0;

    return {
      plan: empresa.plan,
      planEfectivo:
        empresa.plan === PlanEmpresa.PRO || enPrueba
          ? PlanEmpresa.PRO
          : PlanEmpresa.FREE,
      trialEndsAt: fin ? fin.toISOString() : null,
      enPrueba,
      diasDePrueba,
      pruebaCaducada: !!fin && !enPrueba && empresa.plan === PlanEmpresa.FREE,
      puedeProbar:
        PRO_SE_OFRECE && !empresa.trialUsed && empresa.plan === PlanEmpresa.FREE,
    };
  }

  /** Estado del plan de una empresa por id. */
  async estadoDe(empresaId: number): Promise<EstadoPlan> {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { plan: true, trialEndsAt: true, trialUsed: true },
    });
    if (!empresa) throw new NotFoundException('La empresa no existe.');
    return this.estado(empresa);
  }

  /** Fecha en la que terminaría una prueba que empiece ahora. */
  finDePrueba(desde = new Date()): Date {
    const fin = new Date(desde);
    fin.setDate(fin.getDate() + DIAS_DE_PRUEBA);
    return fin;
  }

  /**
   * Regala los días de Pro. Solo una vez por empresa: si no, bastaría con
   * pulsar el botón cada mes para tener Pro gratis para siempre.
   */
  async activarPrueba(empresaId: number, user: AuthenticatedUser) {
    if (!PRO_SE_OFRECE) {
      throw new BadRequestException(
        'Bookmy CRM Pro no está disponible todavía.',
      );
    }
    if (
      user.role !== Role.SUPER_ADMIN &&
      !(user.role === Role.COMPANY_ADMIN && user.empresaId === empresaId)
    ) {
      throw new ForbiddenException('No puede activar la prueba de esta empresa.');
    }

    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { plan: true, trialEndsAt: true, trialUsed: true },
    });
    if (!empresa) throw new NotFoundException('La empresa no existe.');

    const estado = this.estado(empresa);
    if (estado.planEfectivo === PlanEmpresa.PRO) {
      throw new BadRequestException('Esta empresa ya tiene Bookmy CRM Pro.');
    }
    if (empresa.trialUsed) {
      throw new BadRequestException('Esta empresa ya disfrutó su prueba gratuita.');
    }

    const actualizada = await this.prisma.empresa.update({
      where: { id: empresaId },
      data: { trialEndsAt: this.finDePrueba(), trialUsed: true },
      select: { plan: true, trialEndsAt: true, trialUsed: true },
    });
    return this.estado(actualizada);
  }

  /**
   * Cambia el plan contratado (lo hace el superadmin cuando el negocio
   * paga o deja de pagar). Al pasar a PRO se apaga la prueba: ya no pinta
   * nada y dejaría un aviso de "te quedan X días" en el panel.
   */
  async cambiarPlan(empresaId: number, plan: PlanEmpresa) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true },
    });
    if (!empresa) throw new NotFoundException('La empresa no existe.');

    const actualizada = await this.prisma.empresa.update({
      where: { id: empresaId },
      data: {
        plan,
        ...(plan === PlanEmpresa.PRO ? { trialEndsAt: null } : {}),
      },
      select: { plan: true, trialEndsAt: true, trialUsed: true },
    });
    return this.estado(actualizada);
  }

  /**
   * Corta el paso a lo que es de pago. Lo usan los módulos que solo
   * entran en Bookmy CRM Pro: sin esto, bastaba con llamar al API a mano
   * para saltarse el bloqueo que hace el panel.
   */
  async exigirPro(user: AuthenticatedUser | undefined, que: string) {
    if (!user || user.role === Role.SUPER_ADMIN) return;
    if (!user.empresaId) {
      throw new ForbiddenException(`${que} forma parte de Bookmy CRM Pro.`);
    }
    const estado = await this.estadoDe(user.empresaId);
    if (estado.planEfectivo !== PlanEmpresa.PRO) {
      throw new ForbiddenException(
        PRO_SE_OFRECE
          ? `${que} forma parte de Bookmy CRM Pro. Pruébalo gratis desde tu panel.`
          : `${que} forma parte de Bookmy CRM Pro, que todavía no está disponible.`,
      );
    }
  }
}
