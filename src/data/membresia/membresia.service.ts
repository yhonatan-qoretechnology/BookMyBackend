import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { EstadoPagoPlan, PlanEmpresa, Role } from '@prisma/client';
import Stripe = require('stripe');
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { BOOKMY_EVENTS } from '../../common/events/event-names';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanService } from '../empresa/plan.service';

export type Ciclo = 'MENSUAL' | 'ANUAL';
const DIA = 86_400_000;

/**
 * Membresía de Bookmy CRM Pro: precios, pago online con Stripe Checkout,
 * sedes extra y el control en tiempo real de quién paga mensual o anual.
 *
 * Al pagar se amplía Empresa.proPagadoHasta (1 o 12 meses desde hoy o desde
 * que acabe lo ya pagado) y se fijan las sedes extra compradas. El pago queda
 * en EmpresaPlanPago y emite plan-pago.pagado (de ahí cuelgan los referidos).
 */
@Injectable()
export class MembresiaService {
  private readonly logger = new Logger(MembresiaService.name);
  private readonly stripe: InstanceType<typeof Stripe> | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly planes: PlanService,
    private readonly eventos: EventEmitter2,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = key ? new Stripe(key) : null;
  }

  private get appUrl() {
    return (this.config.get<string>('APP_URL') || 'https://bookmy.es').replace(/\/$/, '');
  }

  /* ── Precios ───────────────────────────────────────────── */

  async precios() {
    return (
      (await this.prisma.configMembresia.findUnique({ where: { id: 1 } })) ??
      (await this.prisma.configMembresia.create({ data: { id: 1 } }))
    );
  }

  async guardarPrecios(dto: {
    precioMensual: number;
    precioAnual: number;
    sedesIncluidas: number;
    precioSedeExtra: number;
    diasAviso: number;
    moneda?: string;
  }) {
    if (dto.precioMensual <= 0 || dto.precioAnual <= 0 || dto.precioSedeExtra < 0) {
      throw new BadRequestException('Los precios tienen que ser mayores que cero.');
    }
    const data = {
      precioMensual: dto.precioMensual,
      precioAnual: dto.precioAnual,
      sedesIncluidas: dto.sedesIncluidas,
      precioSedeExtra: dto.precioSedeExtra,
      diasAviso: dto.diasAviso,
      ...(dto.moneda && { moneda: dto.moneda.toUpperCase() }),
    };
    return this.prisma.configMembresia.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  }

  /** Importe de un pago: plan + sedes extra por los meses del ciclo. */
  private importe(p: { precioMensual: number; precioAnual: number; precioSedeExtra: number }, ciclo: Ciclo, sedesExtra: number) {
    const meses = ciclo === 'ANUAL' ? 12 : 1;
    const plan = ciclo === 'ANUAL' ? p.precioAnual : p.precioMensual;
    const sedes = sedesExtra * p.precioSedeExtra * meses;
    return { plan, sedes, total: Number((plan + sedes).toFixed(2)), meses };
  }

  /* ── Sedes ─────────────────────────────────────────────── */

  /** Cuántas sedes puede tener una empresa con su plan actual. */
  async limiteSedes(empresaId: number) {
    const [empresa, precios, usadas] = await Promise.all([
      this.prisma.empresa.findUnique({
        where: { id: empresaId },
        select: { plan: true, trialEndsAt: true, trialUsed: true, proGratisHasta: true, mesesProCredito: true, proPagadoHasta: true, sedesExtra: true },
      }),
      this.precios(),
      this.prisma.sede.count({ where: { empresaId } }),
    ]);
    if (!empresa) throw new NotFoundException('La empresa no existe.');
    const estado = this.planes.estado(empresa);
    const pro = estado.planEfectivo === PlanEmpresa.PRO;
    /* En Free no se limita aquí (lo gobierna el plan gratuito); en Pro,
       las incluidas más las compradas. */
    const limite = pro ? precios.sedesIncluidas + empresa.sedesExtra : null;
    return { usadas, incluidas: precios.sedesIncluidas, extra: empresa.sedesExtra, limite, pro };
  }

  /** Lanza si la empresa ya llegó a su límite de sedes. */
  async exigirSedeDisponible(empresaId: number) {
    const l = await this.limiteSedes(empresaId);
    if (l.limite != null && l.usadas >= l.limite) {
      throw new ForbiddenException(
        `Has llegado al límite de ${l.limite} sedes de tu plan. Amplía sedes desde «Plan» para crear más.`,
      );
    }
  }

  /* ── Vista del negocio ─────────────────────────────────── */

  private empresaDe(user: AuthenticatedUser, empresaId?: number) {
    if (user.role === Role.SUPER_ADMIN && empresaId) return empresaId;
    if (user.role === Role.COMPANY_ADMIN && user.empresaId) return user.empresaId;
    throw new ForbiddenException('Solo el dueño del negocio gestiona la membresía.');
  }

  async mia(user: AuthenticatedUser, empresaIdParam?: number) {
    const empresaId = this.empresaDe(user, empresaIdParam);
    const [precios, empresa, sedes, pagos] = await Promise.all([
      this.precios(),
      this.prisma.empresa.findUnique({
        where: { id: empresaId },
        select: {
          nombre: true, plan: true, trialEndsAt: true, trialUsed: true, proGratisHasta: true,
          mesesProCredito: true, proPagadoHasta: true, cicloPro: true, sedesExtra: true,
        },
      }),
      this.limiteSedes(empresaId),
      this.prisma.empresaPlanPago.findMany({ where: { empresaId }, orderBy: { createdAt: 'desc' }, take: 24 }),
    ]);
    if (!empresa) throw new NotFoundException('La empresa no existe.');
    const estado = this.planes.estado(empresa);
    /* ¿Hasta cuándo tiene Pro, venga de donde venga? */
    const fechas = [estado.proPagadoHasta, estado.proGratisHasta, estado.enPrueba ? estado.trialEndsAt : null]
      .filter(Boolean)
      .map((f) => new Date(f as string).getTime());
    const proHasta = fechas.length ? new Date(Math.max(...fechas)) : null;
    const dias = proHasta ? Math.ceil((proHasta.getTime() - Date.now()) / DIA) : null;
    return {
      empresa: empresa.nombre,
      precios,
      estado,
      contratadoManual: empresa.plan === PlanEmpresa.PRO,
      proHasta,
      diasRestantes: dias,
      porVencer: dias != null && dias >= 0 && dias <= precios.diasAviso && empresa.plan !== PlanEmpresa.PRO,
      ciclo: empresa.cicloPro,
      sedes,
      pagos,
      stripeActivo: !!this.stripe,
    };
  }

  /** Crea la sesión de Stripe Checkout y devuelve la URL a la que ir. */
  async checkout(user: AuthenticatedUser, dto: { ciclo: Ciclo; sedesExtra?: number; empresaId?: number }) {
    if (!this.stripe) throw new BadRequestException('Los pagos online no están configurados todavía.');
    const empresaId = this.empresaDe(user, dto.empresaId);
    const ciclo: Ciclo = dto.ciclo === 'ANUAL' ? 'ANUAL' : 'MENSUAL';
    const sedesExtra = Math.max(0, Math.min(500, Math.floor(dto.sedesExtra ?? 0)));
    const [precios, empresa, sedes] = await Promise.all([
      this.precios(),
      this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { nombre: true, email: true } }),
      this.prisma.sede.count({ where: { empresaId } }),
    ]);
    if (!empresa) throw new NotFoundException('La empresa no existe.');
    if (sedes > precios.sedesIncluidas + sedesExtra) {
      throw new BadRequestException(
        `Tienes ${sedes} sedes: necesitas al menos ${sedes - precios.sedesIncluidas} sedes extra.`,
      );
    }
    const imp = this.importe(precios, ciclo, sedesExtra);
    const moneda = precios.moneda.toLowerCase();
    const lineas: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        quantity: 1,
        price_data: {
          currency: moneda,
          unit_amount: Math.round(imp.plan * 100),
          product_data: { name: `Bookmy CRM Pro · ${ciclo === 'ANUAL' ? 'Anual (12 meses)' : 'Mensual'}` },
        },
      },
    ];
    if (sedesExtra > 0) {
      lineas.push({
        quantity: sedesExtra,
        price_data: {
          currency: moneda,
          unit_amount: Math.round(precios.precioSedeExtra * imp.meses * 100),
          product_data: { name: `Sede adicional (${imp.meses} ${imp.meses === 1 ? 'mes' : 'meses'})` },
        },
      });
    }

    const pago = await this.prisma.empresaPlanPago.create({
      data: {
        empresaId,
        monto: imp.total,
        vence: new Date(),
        ciclo,
        sedesExtra,
        creadoPorId: user.userId,
      },
    });
    const sesion = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineas,
      customer_email: empresa.email || undefined,
      client_reference_id: String(empresaId),
      metadata: { tipo: 'membresia', empresaId: String(empresaId), pagoId: String(pago.id), ciclo, sedesExtra: String(sedesExtra) },
      success_url: `${this.appUrl}/plan/pagar?ok=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.appUrl}/plan/pagar?cancelado=1`,
    });
    await this.prisma.empresaPlanPago.update({ where: { id: pago.id }, data: { stripeSessionId: sesion.id } });
    return { url: sesion.url, total: imp.total };
  }

  /** Al volver de Stripe: comprueba la sesión y aplica el pago si está cobrado. */
  async confirmar(user: AuthenticatedUser, sessionId: string) {
    const empresaId = this.empresaDe(user);
    const r = await this.aplicarSesion(sessionId);
    if (r.empresaId !== empresaId) throw new ForbiddenException('Ese pago no es de tu negocio.');
    return r;
  }

  @OnEvent('membresia.checkout-completado', { async: true })
  async alCompletarCheckout(e: { sessionId: string }) {
    try {
      await this.aplicarSesion(e.sessionId);
    } catch (error) {
      this.logger.error(`Checkout ${e.sessionId}: ${(error as Error).message}`);
    }
  }

  /** Idempotente: aplica el pago de una sesión de Checkout cobrada. */
  private async aplicarSesion(sessionId: string) {
    if (!this.stripe) throw new BadRequestException('Los pagos online no están configurados todavía.');
    const sesion = await this.stripe.checkout.sessions.retrieve(sessionId);
    const pago = await this.prisma.empresaPlanPago.findUnique({ where: { stripeSessionId: sessionId } });
    if (!pago) throw new NotFoundException('No se encontró el pago de esa sesión.');
    if (sesion.payment_status !== 'paid') {
      return { empresaId: pago.empresaId, pagado: false, estado: pago.estado };
    }
    if (pago.estado === EstadoPagoPlan.PAGADO) {
      return { empresaId: pago.empresaId, pagado: true, estado: pago.estado, hasta: pago.periodoHasta };
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      /* Solo una petición gana el paso a PAGADO */
      const { count } = await tx.empresaPlanPago.updateMany({
        where: { id: pago.id, estado: { not: EstadoPagoPlan.PAGADO } },
        data: { estado: EstadoPagoPlan.PAGADO, pagadoEn: new Date() },
      });
      if (count === 0) return null;
      const empresa = await tx.empresa.findUnique({ where: { id: pago.empresaId }, select: { proPagadoHasta: true } });
      const ahora = new Date();
      const base = empresa?.proPagadoHasta && empresa.proPagadoHasta > ahora ? new Date(empresa.proPagadoHasta) : ahora;
      base.setMonth(base.getMonth() + (pago.ciclo === 'ANUAL' ? 12 : 1));
      await tx.empresa.update({
        where: { id: pago.empresaId },
        data: { proPagadoHasta: base, cicloPro: pago.ciclo, sedesExtra: pago.sedesExtra, trialEndsAt: null },
      });
      await tx.empresaPlanPago.update({ where: { id: pago.id }, data: { periodoHasta: base, vence: base } });
      return base;
    });

    if (resultado) {
      this.eventos.emit(BOOKMY_EVENTS.PLAN_PAGO_PAGADO, { empresaId: pago.empresaId, monto: pago.monto, pagoId: pago.id });
    }
    return { empresaId: pago.empresaId, pagado: true, estado: EstadoPagoPlan.PAGADO, hasta: resultado };
  }

  /* ── Superadmin: control en tiempo real ────────────────── */

  async admin() {
    const ahora = new Date();
    const [precios, empresas, pagos] = await Promise.all([
      this.precios(),
      this.prisma.empresa.findMany({
        select: {
          id: true, nombre: true, plan: true, trialEndsAt: true, trialUsed: true, proGratisHasta: true,
          mesesProCredito: true, proPagadoHasta: true, cicloPro: true, sedesExtra: true,
          _count: { select: { sedes: true } },
        },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.empresaPlanPago.findMany({
        where: { estado: EstadoPagoPlan.PAGADO },
        orderBy: { pagadoEn: 'desc' },
        take: 300,
        include: { empresa: { select: { id: true, nombre: true } } },
      }),
    ]);

    const filas = empresas.map((e) => {
      const estado = this.planes.estado(e);
      const hasta = e.proPagadoHasta;
      const dias = hasta ? Math.ceil((hasta.getTime() - ahora.getTime()) / DIA) : null;
      let situacion: 'AL_DIA' | 'POR_VENCER' | 'VENCIDA' | 'MANUAL' | 'PRUEBA' | 'REGALO' | 'FREE';
      if (e.plan === PlanEmpresa.PRO) situacion = 'MANUAL';
      else if (dias != null && dias > precios.diasAviso) situacion = 'AL_DIA';
      else if (dias != null && dias >= 0) situacion = 'POR_VENCER';
      else if (estado.enPrueba) situacion = 'PRUEBA';
      else if (estado.proGratisHasta) situacion = 'REGALO';
      else if (dias != null && dias < 0) situacion = 'VENCIDA';
      else situacion = 'FREE';
      return {
        empresaId: e.id,
        empresa: e.nombre,
        situacion,
        ciclo: e.cicloPro,
        proPagadoHasta: hasta,
        diasRestantes: dias,
        sedes: e._count.sedes,
        limiteSedes: estado.planEfectivo === PlanEmpresa.PRO ? precios.sedesIncluidas + e.sedesExtra : null,
        sedesExtra: e.sedesExtra,
      };
    });

    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioAnio = new Date(ahora.getFullYear(), 0, 1);
    const reales = pagos.filter((p) => !p.cubiertoPorReferidos);
    const suma = (desde: Date) =>
      Number(reales.filter((p) => p.pagadoEn && p.pagadoEn >= desde).reduce((a, p) => a + p.monto, 0).toFixed(2));
    const cuenta = (s: string) => filas.filter((f) => f.situacion === s).length;
    const activasPagadas = filas.filter((f) => f.situacion === 'AL_DIA' || f.situacion === 'POR_VENCER');

    return {
      precios,
      resumen: {
        activas: activasPagadas.length + cuenta('MANUAL'),
        mensuales: activasPagadas.filter((f) => f.ciclo === 'MENSUAL').length,
        anuales: activasPagadas.filter((f) => f.ciclo === 'ANUAL').length,
        porVencer: cuenta('POR_VENCER'),
        vencidas: cuenta('VENCIDA'),
        enPrueba: cuenta('PRUEBA'),
        ingresosMes: suma(inicioMes),
        ingresosAnio: suma(inicioAnio),
        /* Ingreso recurrente mensual estimado de las activas pagadas */
        mrr: Number(
          activasPagadas
            .reduce((a, f) => a + (f.ciclo === 'ANUAL' ? precios.precioAnual / 12 : precios.precioMensual) + f.sedesExtra * precios.precioSedeExtra, 0)
            .toFixed(2),
        ),
      },
      empresas: filas,
      pagos: pagos.slice(0, 100).map((p) => ({
        id: p.id,
        empresa: p.empresa,
        monto: p.monto,
        ciclo: p.ciclo,
        sedesExtra: p.sedesExtra,
        pagadoEn: p.pagadoEn,
        periodoHasta: p.periodoHasta,
        online: !!p.stripeSessionId,
        cubiertoPorReferidos: p.cubiertoPorReferidos,
      })),
    };
  }
}
