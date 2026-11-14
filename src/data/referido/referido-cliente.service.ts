import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AppointmentStatus,
  EstadoCupon,
  EstadoReferidoCliente,
  PaymentStatus,
  Prisma,
  Role,
  TipoDescuento,
} from '@prisma/client';
import { randomInt } from 'crypto';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../email/mail.service';

interface Alcance {
  empresaId: number;
  sedeId?: number;
}

/** Sin I, O, 0 ni 1: códigos que se dictan sin confusión. */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const aleatorio = (n: number) => Array.from({ length: n }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

/**
 * Referidos de clientes: cada negocio activa su programa y elige el premio.
 *
 * 1. Cada cliente tiene un código personal en el negocio (ANA-7K3).
 * 2. Cuando llega un amigo con ese código, el negocio lo registra: el amigo
 *    recibe al momento un cupón de bienvenida.
 * 3. Cuando el amigo completa su primera cita, quien lo invitó recibe su
 *    cupón de premio (cron cada hora).
 * 4. Los cupones se canjean en un ticket: se resta el descuento del total.
 */
@Injectable()
export class ReferidoClienteService {
  private readonly logger = new Logger(ReferidoClienteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /* ── Alcance ───────────────────────────────────────────── */

  async alcance(user: AuthenticatedUser, empresaId?: number): Promise<Alcance> {
    if (user.role === Role.SUPER_ADMIN) {
      if (!empresaId) throw new BadRequestException('Elige una empresa.');
      return { empresaId };
    }
    if (user.role === Role.COMPANY_ADMIN && user.empresaId) return { empresaId: user.empresaId };
    if (user.role === Role.BRANCH_ADMIN && user.sedeId) {
      const sede = await this.prisma.sede.findUnique({ where: { id: user.sedeId }, select: { empresaId: true } });
      if (!sede) throw new ForbiddenException('Tu sede no existe.');
      return { empresaId: sede.empresaId, sedeId: user.sedeId };
    }
    throw new ForbiddenException('Solo el negocio gestiona su programa de referidos.');
  }

  private async sedesDe(empresaId: number) {
    const sedes = await this.prisma.sede.findMany({ where: { empresaId }, select: { id: true } });
    return sedes.map((s) => s.id);
  }

  /* ── Programa ──────────────────────────────────────────── */

  private async programaDe(empresaId: number) {
    return (
      (await this.prisma.programaReferidosCliente.findUnique({ where: { empresaId } })) ?? {
        id: 0,
        empresaId,
        activo: false,
        tipoReferidor: TipoDescuento.PORCENTAJE,
        valorReferidor: 15,
        tipoInvitado: TipoDescuento.PORCENTAJE,
        valorInvitado: 10,
        vigenciaDias: 90,
        maxPorCliente: 0,
        mensaje: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    );
  }

  async resumen(user: AuthenticatedUser, empresaId?: number) {
    const alc = await this.alcance(user, empresaId);
    const [programa, referidos, cupones, empresa] = await Promise.all([
      this.programaDe(alc.empresaId),
      this.prisma.referidoCliente.findMany({
        where: { empresaId: alc.empresaId },
        orderBy: { createdAt: 'desc' },
        take: 300,
        include: {
          referidor: { select: { id: true, email: true, fotoPerfil: true, UserData: { select: { name: true } } } },
          invitado: { select: { id: true, email: true, fotoPerfil: true, UserData: { select: { name: true } } } },
        },
      }),
      this.prisma.cuponCliente.findMany({
        where: { empresaId: alc.empresaId },
        orderBy: { createdAt: 'desc' },
        take: 300,
        include: { user: { select: { id: true, email: true, UserData: { select: { name: true } } } } },
      }),
      this.prisma.empresa.findUnique({ where: { id: alc.empresaId }, select: { nombre: true } }),
    ]);

    const nombre = (u: { email: string; UserData?: { name: string } | null }) => u.UserData?.name || u.email;
    const top = new Map<number, { userId: number; nombre: string; invitados: number; completados: number }>();
    for (const r of referidos) {
      const t = top.get(r.referidorId) ?? { userId: r.referidorId, nombre: nombre(r.referidor), invitados: 0, completados: 0 };
      t.invitados++;
      if (r.estado === EstadoReferidoCliente.COMPLETADO) t.completados++;
      top.set(r.referidorId, t);
    }
    const usados = cupones.filter((c) => c.estado === EstadoCupon.USADO);

    return {
      empresa: empresa?.nombre ?? '',
      programa,
      stats: {
        referidos: referidos.length,
        pendientes: referidos.filter((r) => r.estado === EstadoReferidoCliente.PENDIENTE).length,
        completados: referidos.filter((r) => r.estado === EstadoReferidoCliente.COMPLETADO).length,
        cuponesEmitidos: cupones.length,
        cuponesDisponibles: cupones.filter((c) => c.estado === EstadoCupon.DISPONIBLE).length,
        cuponesUsados: usados.length,
        descuentoTotal: Number(usados.reduce((a, c) => a + (c.descuento ?? 0), 0).toFixed(2)),
      },
      top: [...top.values()].sort((a, b) => b.completados - a.completados || b.invitados - a.invitados).slice(0, 10),
      referidos: referidos.map((r) => ({
        id: r.id,
        codigo: r.codigo,
        estado: r.estado,
        createdAt: r.createdAt,
        completadoEn: r.completadoEn,
        referidor: { id: r.referidor.id, nombre: nombre(r.referidor), foto: r.referidor.fotoPerfil },
        invitado: { id: r.invitado.id, nombre: nombre(r.invitado), foto: r.invitado.fotoPerfil },
      })),
      cupones: cupones.map((c) => ({
        id: c.id,
        codigo: c.codigo,
        tipo: c.tipo,
        valor: c.valor,
        motivo: c.motivo,
        estado: c.estado,
        venceEn: c.venceEn,
        usadoEn: c.usadoEn,
        descuento: c.descuento,
        createdAt: c.createdAt,
        cliente: { id: c.user.id, nombre: nombre(c.user) },
      })),
    };
  }

  async guardarPrograma(
    user: AuthenticatedUser,
    dto: {
      empresaId?: number;
      activo: boolean;
      tipoReferidor: TipoDescuento;
      valorReferidor: number;
      tipoInvitado: TipoDescuento;
      valorInvitado: number;
      vigenciaDias: number;
      maxPorCliente: number;
      mensaje?: string;
    },
  ) {
    if (user.role === Role.BRANCH_ADMIN) throw new ForbiddenException('El programa lo configura el dueño del negocio.');
    const alc = await this.alcance(user, dto.empresaId);
    for (const [tipo, valor] of [[dto.tipoReferidor, dto.valorReferidor], [dto.tipoInvitado, dto.valorInvitado]] as const) {
      if (tipo === TipoDescuento.PORCENTAJE && (valor <= 0 || valor > 100)) {
        throw new BadRequestException('Un porcentaje va de 1 a 100.');
      }
      if (valor <= 0) throw new BadRequestException('El premio tiene que ser mayor que cero.');
    }
    const data = {
      activo: dto.activo,
      tipoReferidor: dto.tipoReferidor,
      valorReferidor: dto.valorReferidor,
      tipoInvitado: dto.tipoInvitado,
      valorInvitado: dto.valorInvitado,
      vigenciaDias: dto.vigenciaDias,
      maxPorCliente: dto.maxPorCliente,
      mensaje: dto.mensaje?.trim() || null,
    };
    return this.prisma.programaReferidosCliente.upsert({
      where: { empresaId: alc.empresaId },
      create: { empresaId: alc.empresaId, ...data },
      update: data,
    });
  }

  /* ── Códigos de cliente ────────────────────────────────── */

  private async codigoDeCliente(empresaId: number, userId: number) {
    const existente = await this.prisma.codigoReferidoCliente.findUnique({
      where: { empresaId_userId: { empresaId, userId } },
    });
    if (existente) return existente.codigo;
    const u = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { email: true, UserData: { select: { name: true } } },
    });
    if (!u) throw new NotFoundException('El cliente no existe.');
    const base =
      (u.UserData?.name || u.email)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 4) || 'AMIGO';
    for (let i = 0; i < 8; i++) {
      const codigo = `${base}-${aleatorio(3)}`;
      try {
        const c = await this.prisma.codigoReferidoCliente.create({ data: { empresaId, userId, codigo } });
        return c.codigo;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const ya = await this.prisma.codigoReferidoCliente.findUnique({ where: { empresaId_userId: { empresaId, userId } } });
          if (ya) return ya.codigo;
          continue;
        }
        throw e;
      }
    }
    throw new BadRequestException('No se pudo crear el código. Inténtalo de nuevo.');
  }

  /** Ficha de un cliente en el programa: su código, a quién invitó y sus cupones. */
  async cliente(user: AuthenticatedUser, userId: number, empresaId?: number) {
    const alc = await this.alcance(user, empresaId);
    const [codigo, programa, invitados, cupones, empresa] = await Promise.all([
      this.codigoDeCliente(alc.empresaId, userId),
      this.programaDe(alc.empresaId),
      this.prisma.referidoCliente.findMany({
        where: { empresaId: alc.empresaId, referidorId: userId },
        include: { invitado: { select: { email: true, UserData: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cuponCliente.findMany({ where: { empresaId: alc.empresaId, userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.empresa.findUnique({ where: { id: alc.empresaId }, select: { nombre: true } }),
    ]);
    return {
      codigo,
      activo: programa.activo,
      empresa: empresa?.nombre ?? '',
      regaloInvitado: { tipo: programa.tipoInvitado, valor: programa.valorInvitado },
      premioReferidor: { tipo: programa.tipoReferidor, valor: programa.valorReferidor },
      mensaje: programa.mensaje,
      invitados: invitados.map((r) => ({
        id: r.id,
        nombre: r.invitado.UserData?.name || r.invitado.email,
        estado: r.estado,
        createdAt: r.createdAt,
      })),
      cupones,
    };
  }

  /** Cliente (app): su código y sus cupones en un negocio. */
  async miCodigo(user: AuthenticatedUser, empresaId: number) {
    const programa = await this.programaDe(empresaId);
    if (!programa.activo) return { activo: false as const };
    const [codigo, cupones] = await Promise.all([
      this.codigoDeCliente(empresaId, user.userId),
      this.prisma.cuponCliente.findMany({
        where: { empresaId, userId: user.userId, estado: EstadoCupon.DISPONIBLE },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      activo: true as const,
      codigo,
      regaloInvitado: { tipo: programa.tipoInvitado, valor: programa.valorInvitado },
      premioReferidor: { tipo: programa.tipoReferidor, valor: programa.valorReferidor },
      cupones,
    };
  }

  /** Público: ¿qué regala este código? */
  async validarCodigo(codigo: string) {
    const c = await this.prisma.codigoReferidoCliente.findUnique({
      where: { codigo: codigo.trim().toUpperCase() },
      include: {
        empresa: { select: { id: true, nombre: true, programaReferidosCliente: true } },
        user: { select: { UserData: { select: { name: true } } } },
      },
    });
    const p = c?.empresa.programaReferidosCliente;
    if (!c || !p?.activo) return { valido: false as const };
    return {
      valido: true as const,
      empresaId: c.empresa.id,
      empresa: c.empresa.nombre,
      quienInvita: (c.user.UserData?.name || '').split(/\s+/)[0] || null,
      regalo: { tipo: p.tipoInvitado, valor: p.valorInvitado },
    };
  }

  /* ── Registrar un referido ─────────────────────────────── */

  private async emitirCupon(
    tx: Prisma.TransactionClient,
    empresaId: number,
    userId: number,
    tipo: TipoDescuento,
    valor: number,
    motivo: 'BIENVENIDA' | 'PREMIO',
    vigenciaDias: number,
    referidoId?: number,
  ) {
    const venceEn = vigenciaDias > 0 ? new Date(Date.now() + vigenciaDias * 86_400_000) : null;
    for (let i = 0; i < 8; i++) {
      try {
        return await tx.cuponCliente.create({
          data: {
            empresaId, userId, tipo, valor, motivo, referidoId, venceEn,
            codigo: `${motivo === 'PREMIO' ? 'PREMIO' : 'HOLA'}-${aleatorio(5)}`,
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new BadRequestException('No se pudo emitir el cupón.');
  }

  /** El negocio registra que un cliente llegó invitado con un código. */
  async registrar(user: AuthenticatedUser, dto: { empresaId?: number; codigo: string; invitadoId: number }) {
    const alc = await this.alcance(user, dto.empresaId);
    const programa = await this.programaDe(alc.empresaId);
    if (!programa.activo) throw new BadRequestException('Activa primero el programa de referidos de clientes.');

    const codigo = await this.prisma.codigoReferidoCliente.findUnique({ where: { codigo: dto.codigo.trim().toUpperCase() } });
    if (!codigo || codigo.empresaId !== alc.empresaId) throw new BadRequestException('Ese código no es de este negocio.');
    if (codigo.userId === dto.invitadoId) throw new BadRequestException('Un cliente no puede invitarse a sí mismo.');

    const invitado = await this.prisma.users.findUnique({ where: { id: dto.invitadoId }, select: { id: true, email: true } });
    if (!invitado) throw new NotFoundException('El cliente invitado no existe.');

    /* Solo cuenta como referido quien aún no ha venido nunca */
    const sedes = await this.sedesDe(alc.empresaId);
    const yaVino = await this.prisma.appointment.count({
      where: { userId: dto.invitadoId, sedeId: { in: sedes }, estado: AppointmentStatus.COMPLETED },
    });
    if (yaVino > 0) throw new BadRequestException('Este cliente ya había venido antes: no cuenta como nuevo invitado.');

    try {
      const res = await this.prisma.$transaction(async (tx) => {
        const referido = await tx.referidoCliente.create({
          data: {
            empresaId: alc.empresaId,
            referidorId: codigo.userId,
            invitadoId: dto.invitadoId,
            codigo: codigo.codigo,
            creadoPorId: user.userId,
          },
        });
        const cupon = await this.emitirCupon(
          tx, alc.empresaId, dto.invitadoId, programa.tipoInvitado, programa.valorInvitado,
          'BIENVENIDA', programa.vigenciaDias, referido.id,
        );
        return { referido, cupon };
      });
      void this.avisarCupon(alc.empresaId, invitado.email, res.cupon.codigo, programa.tipoInvitado, programa.valorInvitado, 'BIENVENIDA');
      return res;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('Este cliente ya llegó invitado por alguien.');
      }
      throw e;
    }
  }

  async anular(user: AuthenticatedUser, id: number, empresaId?: number) {
    const alc = await this.alcance(user, empresaId);
    const r = await this.prisma.referidoCliente.findUnique({ where: { id } });
    if (!r || r.empresaId !== alc.empresaId) throw new NotFoundException('El referido no existe.');
    if (r.estado !== EstadoReferidoCliente.PENDIENTE) throw new BadRequestException('Solo se anula un referido pendiente.');
    await this.prisma.$transaction([
      this.prisma.referidoCliente.update({ where: { id }, data: { estado: EstadoReferidoCliente.ANULADO } }),
      this.prisma.cuponCliente.updateMany({
        where: { referidoId: id, estado: EstadoCupon.DISPONIBLE },
        data: { estado: EstadoCupon.ANULADO },
      }),
    ]);
    return { ok: true };
  }

  /* ── Completar: el invitado ya tuvo su primera cita ────── */

  @Cron(CronExpression.EVERY_HOUR)
  async completarPendientes() {
    const pendientes = await this.prisma.referidoCliente.findMany({
      where: { estado: EstadoReferidoCliente.PENDIENTE },
      take: 500,
    });
    for (const r of pendientes) {
      try {
        await this.intentarCompletar(r.id);
      } catch (e) {
        this.logger.error(`Referido de cliente ${r.id}: ${(e as Error).message}`);
      }
    }
    /* De paso, los cupones caducados */
    await this.prisma.cuponCliente.updateMany({
      where: { estado: EstadoCupon.DISPONIBLE, venceEn: { lt: new Date() } },
      data: { estado: EstadoCupon.VENCIDO },
    });
  }

  private async intentarCompletar(referidoId: number) {
    const r = await this.prisma.referidoCliente.findUnique({ where: { id: referidoId } });
    if (!r || r.estado !== EstadoReferidoCliente.PENDIENTE) return null;
    const sedes = await this.sedesDe(r.empresaId);
    const cita = await this.prisma.appointment.findFirst({
      where: {
        userId: r.invitadoId,
        sedeId: { in: sedes },
        estado: AppointmentStatus.COMPLETED,
        horaInicio: { gte: new Date(r.createdAt.getTime() - 86_400_000) },
      },
      select: { id: true },
    });
    if (!cita) return null;
    const programa = await this.programaDe(r.empresaId);

    const cupon = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.referidoCliente.updateMany({
        where: { id: r.id, estado: EstadoReferidoCliente.PENDIENTE },
        data: { estado: EstadoReferidoCliente.COMPLETADO, completadoEn: new Date() },
      });
      if (count === 0) return null;
      if (programa.maxPorCliente > 0) {
        const premios = await tx.cuponCliente.count({
          where: { empresaId: r.empresaId, userId: r.referidorId, motivo: 'PREMIO' },
        });
        if (premios >= programa.maxPorCliente) return null;
      }
      return this.emitirCupon(
        tx, r.empresaId, r.referidorId, programa.tipoReferidor, programa.valorReferidor,
        'PREMIO', programa.vigenciaDias, r.id,
      );
    });
    if (cupon) {
      const u = await this.prisma.users.findUnique({ where: { id: r.referidorId }, select: { email: true } });
      if (u?.email) void this.avisarCupon(r.empresaId, u.email, cupon.codigo, cupon.tipo, cupon.valor, 'PREMIO');
    }
    return cupon;
  }

  /** Revisión manual (botón «Revisar ahora» del panel). */
  async revisarAhora(user: AuthenticatedUser, empresaId?: number) {
    const alc = await this.alcance(user, empresaId);
    const pendientes = await this.prisma.referidoCliente.findMany({
      where: { empresaId: alc.empresaId, estado: EstadoReferidoCliente.PENDIENTE },
      select: { id: true },
    });
    let completados = 0;
    for (const p of pendientes) if (await this.intentarCompletar(p.id).catch(() => null)) completados++;
    return { revisados: pendientes.length, completados };
  }

  /* ── Cupones ───────────────────────────────────────────── */

  private calcularDescuento(c: { tipo: TipoDescuento; valor: number }, total: number) {
    const d = c.tipo === TipoDescuento.PORCENTAJE ? (total * c.valor) / 100 : c.valor;
    return Number(Math.min(Math.max(d, 0), total).toFixed(2));
  }

  private async cuponValido(empresaId: number, codigo: string) {
    const c = await this.prisma.cuponCliente.findUnique({
      where: { codigo: codigo.trim().toUpperCase() },
      include: { user: { select: { id: true, email: true, UserData: { select: { name: true } } } } },
    });
    if (!c || c.empresaId !== empresaId) throw new BadRequestException('Ese cupón no existe en este negocio.');
    if (c.estado === EstadoCupon.USADO) throw new BadRequestException('Ese cupón ya se usó.');
    if (c.estado !== EstadoCupon.DISPONIBLE || (c.venceEn && c.venceEn < new Date())) {
      throw new BadRequestException('Ese cupón ya no es válido.');
    }
    return c;
  }

  async validarCupon(user: AuthenticatedUser, codigo: string, total?: number, empresaId?: number) {
    const alc = await this.alcance(user, empresaId);
    const c = await this.cuponValido(alc.empresaId, codigo);
    return {
      codigo: c.codigo,
      tipo: c.tipo,
      valor: c.valor,
      cliente: { id: c.user.id, nombre: c.user.UserData?.name || c.user.email },
      venceEn: c.venceEn,
      descuento: total != null ? this.calcularDescuento(c, total) : null,
    };
  }

  /** Aplica el cupón a un ticket: resta el descuento y lo deja como línea. */
  async canjear(user: AuthenticatedUser, dto: { empresaId?: number; codigo: string; paymentId: number }) {
    const alc = await this.alcance(user, dto.empresaId);
    const c = await this.cuponValido(alc.empresaId, dto.codigo);
    const pago = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
      include: { appointment: { select: { sedeId: true, sede: { select: { empresaId: true } } } } },
    });
    if (!pago || pago.appointment?.sede?.empresaId !== alc.empresaId) throw new NotFoundException('El ticket no existe.');
    if (alc.sedeId && pago.appointment?.sedeId !== alc.sedeId) throw new ForbiddenException('Ese ticket no es de tu sede.');
    if (pago.status === PaymentStatus.CANCELLED || pago.status === PaymentStatus.FAILED) {
      throw new BadRequestException('No se puede aplicar a un ticket cancelado.');
    }
    if (pago.userId !== c.userId) throw new BadRequestException('El cupón es de otro cliente.');

    const descuento = this.calcularDescuento(c, pago.totalAmount);
    if (descuento <= 0) throw new BadRequestException('El ticket no tiene importe al que aplicar el cupón.');
    const nuevoTotal = Number((pago.totalAmount - descuento).toFixed(2));
    const etiqueta = c.tipo === TipoDescuento.PORCENTAJE ? `${c.valor} %` : `${c.valor}`;

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.cuponCliente.updateMany({
        where: { id: c.id, estado: EstadoCupon.DISPONIBLE },
        data: { estado: EstadoCupon.USADO, usadoEn: new Date(), paymentId: pago.id, descuento },
      });
      if (count === 0) throw new BadRequestException('Ese cupón ya se usó.');
      await tx.paymentItem.create({
        data: { paymentId: pago.id, concepto: `Cupón ${c.codigo} (-${etiqueta})`.slice(0, 160), cantidad: 1, precioUnitario: -descuento },
      });
      const actualizado = await tx.payment.update({
        where: { id: pago.id },
        data: {
          totalAmount: nuevoTotal,
          ...(pago.status === PaymentStatus.PAID && { paidAmount: nuevoTotal }),
        },
      });
      return { descuento, total: actualizado.totalAmount };
    });
  }

  /* ── Avisos ────────────────────────────────────────────── */

  private async avisarCupon(empresaId: number, to: string, codigo: string, tipo: TipoDescuento, valor: number, motivo: 'BIENVENIDA' | 'PREMIO') {
    try {
      const empresa = await this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { nombre: true } });
      const premio = tipo === TipoDescuento.PORCENTAJE ? `${valor} % de descuento` : `${valor} de descuento`;
      await this.mail.sendGenerico({
        to,
        asunto: motivo === 'PREMIO' ? `¡Has ganado un ${premio} en ${empresa?.nombre}!` : `Tu regalo de bienvenida en ${empresa?.nombre}`,
        titulo: motivo === 'PREMIO' ? '¡Gracias por recomendarnos!' : '¡Bienvenido/a!',
        mensaje: [
          motivo === 'PREMIO'
            ? `Tu amigo ya vino a ${empresa?.nombre}. Como agradecimiento tienes un ${premio} en tu próxima cita.`
            : `Llegaste a ${empresa?.nombre} invitado por un amigo: tienes un ${premio} en tu primera cita.`,
          `Tu código de cupón: ${codigo}\nEnséñalo al pagar.`,
        ].join('\n\n'),
      });
    } catch (e) {
      this.logger.warn(`No se pudo avisar del cupón ${codigo}: ${(e as Error).message}`);
    }
  }
}
