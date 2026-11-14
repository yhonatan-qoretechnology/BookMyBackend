import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EstadoPagoPlan, EstadoReferido, PlanEmpresa, Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { BOOKMY_EVENTS } from '../../common/events/event-names';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../email/mail.service';

/** Niveles del programa: al llegar a `min` invitados que pagan, `bono` meses extra. */
export const NIVELES = [
  { id: 'BRONCE', min: 3, bono: 0 },
  { id: 'PLATA', min: 5, bono: 1 },
  { id: 'ORO', min: 10, bono: 3 },
  { id: 'DIAMANTE', min: 25, bono: 6 },
] as const;

const DIAS_POR_MES = 30;
const MAX_INVITACIONES_DIA = 30;

type Tx = Prisma.TransactionClient;

/**
 * Referidos entre negocios — «Invita y gana».
 *
 * 1. Cada negocio tiene un código y un enlace (bookmy.es/crear-cuenta?ref=…).
 *    Las visitas al enlace se cuentan para ver el embudo.
 * 2. Quien se registra con el código queda como Referido PENDIENTE.
 * 3. Cuando el invitado paga su PRIMER mes de Pro, los dos ganan meses de Pro
 *    gratis (por defecto 1 y 1) y el referido pasa a RECOMPENSADO. Premiar
 *    el pago y no el registro evita cuentas falsas.
 * 4. Niveles: al llegar a 3, 5, 10 y 25 invitados que pagan se sube de nivel
 *    y algunos niveles regalan meses extra.
 *
 * Cómo se usa un mes ganado: si el negocio no paga Pro, se le activa Pro
 * gratis (amplía proGratisHasta); si ya paga, queda como crédito y cubre la
 * siguiente cuota (EmpresaPlanPagoService.crear).
 */
@Injectable()
export class ReferidoService {
  private readonly logger = new Logger(ReferidoService.name);
  /** empresaId|día → invitaciones por correo enviadas hoy */
  private readonly invitacionesHoy = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly eventos: EventEmitter2,
    private readonly mail: MailService,
  ) {}

  get mesesReferidor() {
    return Number(this.config.get('REFERIDO_MESES')) || 1;
  }
  get mesesBienvenida() {
    return Number(this.config.get('REFERIDO_MESES_BIENVENIDA')) || 1;
  }
  private get baseUrl() {
    return (this.config.get<string>('APP_URL') || 'https://bookmy.es').replace(/\/$/, '');
  }
  enlaceDe(codigo: string) {
    return `${this.baseUrl}/crear-cuenta?ref=${encodeURIComponent(codigo)}`;
  }

  /* ── Código ─────────────────────────────────────────────── */

  /** Código del negocio; lo crea si no tiene. */
  async codigoDe(empresaId: number): Promise<string> {
    const existente = await this.prisma.codigoReferido.findUnique({ where: { empresaId } });
    if (existente) return existente.codigo;

    const empresa = await this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { nombre: true } });
    if (!empresa) throw new NotFoundException('La empresa no existe.');

    /* Legible y fácil de dictar: letras del nombre + 3 cifras, sin I ni O. */
    const base =
      empresa.nombre
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .replace(/[IO]/g, '')
        .slice(0, 5) || 'BOOK';
    for (let intento = 0; intento < 8; intento++) {
      const codigo = `${base}${randomInt(100, 1000)}`;
      try {
        const creado = await this.prisma.codigoReferido.create({ data: { empresaId, codigo } });
        return creado.codigo;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const ganado = await this.prisma.codigoReferido.findUnique({ where: { empresaId } });
          if (ganado) return ganado.codigo;
          continue;
        }
        throw error;
      }
    }
    throw new BadRequestException('No se pudo generar un código de referido. Inténtalo de nuevo.');
  }

  /** Público: comprueba un código para el formulario de alta. */
  async validar(codigo: string) {
    const c = await this.prisma.codigoReferido.findUnique({
      where: { codigo: codigo.trim().toUpperCase() },
      include: { empresa: { select: { nombre: true } } },
    });
    return c
      ? { valido: true as const, empresa: c.empresa.nombre, mesesBienvenida: this.mesesBienvenida }
      : { valido: false as const };
  }

  /** Público: alguien abrió el enlace de invitación. */
  async visita(codigo: string) {
    await this.prisma.codigoReferido
      .updateMany({ where: { codigo: codigo.trim().toUpperCase() }, data: { visitas: { increment: 1 } } })
      .catch(() => undefined);
    return { ok: true };
  }

  /** Vincula un negocio recién registrado con quien lo invitó. */
  async vincular(referidaId: number, codigo: string) {
    const c = await this.prisma.codigoReferido.findUnique({
      where: { codigo: codigo.trim().toUpperCase() },
      include: { empresa: { select: { email: true, nit: true } } },
    });
    if (!c || c.empresaId === referidaId) return null;

    /* Antifraude básico: el mismo correo o NIF no puede invitarse a sí mismo */
    const nueva = await this.prisma.empresa.findUnique({ where: { id: referidaId }, select: { email: true, nit: true } });
    const igual = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
    if (igual(nueva?.email, c.empresa.email) || igual(nueva?.nit, c.empresa.nit)) {
      this.logger.warn(`Referido descartado: la empresa ${referidaId} coincide con quien la invita (${c.empresaId}).`);
      return null;
    }

    try {
      return await this.prisma.referido.create({
        data: { referidorId: c.empresaId, referidaId, codigo: c.codigo },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null;
      throw error;
    }
  }

  /* ── Recompensas ────────────────────────────────────────── */

  /**
   * Da `meses` de Pro a una empresa: Pro gratis si no paga, crédito para
   * las cuotas si ya paga. Deja constancia en RecompensaReferido.
   */
  private async acreditar(
    tx: Tx,
    empresaId: number,
    meses: number,
    tipo: 'REFERIDO' | 'BIENVENIDA' | 'NIVEL' | 'MANUAL',
    motivo: string,
    referidoId?: number,
    creadoPorId?: number,
  ) {
    const empresa = await tx.empresa.findUnique({
      where: { id: empresaId },
      select: { plan: true, proGratisHasta: true },
    });
    if (!empresa) return null;
    let aplicadaComo: 'CREDITO' | 'PRO_GRATIS';
    if (empresa.plan === PlanEmpresa.PRO) {
      aplicadaComo = 'CREDITO';
      await tx.empresa.update({ where: { id: empresaId }, data: { mesesProCredito: { increment: meses } } });
    } else {
      aplicadaComo = 'PRO_GRATIS';
      const ahora = new Date();
      const base = empresa.proGratisHasta && empresa.proGratisHasta > ahora ? new Date(empresa.proGratisHasta) : ahora;
      base.setDate(base.getDate() + DIAS_POR_MES * meses);
      await tx.empresa.update({ where: { id: empresaId }, data: { proGratisHasta: base } });
    }
    return tx.recompensaReferido.create({
      data: { empresaId, tipo, meses, motivo: motivo.slice(0, 200), aplicadaComo, referidoId, creadoPorId },
    });
  }

  nivelPara(recompensados: number) {
    let actual: (typeof NIVELES)[number] | null = null;
    for (const n of NIVELES) if (recompensados >= n.min) actual = n;
    const siguiente = NIVELES.find((n) => recompensados < n.min) ?? null;
    return { actual, siguiente, faltan: siguiente ? siguiente.min - recompensados : 0 };
  }

  /**
   * Al pagar un mes de Pro: si es el PRIMER pago real del negocio y vino
   * referido, entrega los meses a los dos (y el bono de nivel). Idempotente.
   */
  async recompensarSiCorresponde(empresaId: number) {
    const referido = await this.prisma.referido.findUnique({
      where: { referidaId: empresaId },
      include: { referida: { select: { nombre: true } } },
    });
    if (!referido || referido.estado !== EstadoReferido.PENDIENTE) return null;

    const pagados = await this.prisma.empresaPlanPago.count({
      where: { empresaId, estado: EstadoPagoPlan.PAGADO, cubiertoPorReferidos: false },
    });
    if (pagados !== 1) return null;

    const [mesesA, mesesB] = [this.mesesReferidor, this.mesesBienvenida];
    const resultado = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.referido.updateMany({
        where: { id: referido.id, estado: EstadoReferido.PENDIENTE },
        data: {
          estado: EstadoReferido.RECOMPENSADO,
          mesesReferidor: mesesA,
          mesesReferida: mesesB,
          recompensadoEn: new Date(),
        },
      });
      if (count === 0) return null;
      await this.acreditar(tx, referido.referidorId, mesesA, 'REFERIDO',
        `${referido.referida.nombre} pagó su primer mes de Pro`, referido.id);
      await this.acreditar(tx, referido.referidaId, mesesB, 'BIENVENIDA',
        'Bienvenida por unirte con una invitación', referido.id);

      /* ¿Sube de nivel con este? */
      const total = await tx.referido.count({
        where: { referidorId: referido.referidorId, estado: EstadoReferido.RECOMPENSADO },
      });
      const nivel = NIVELES.find((n) => n.min === total);
      if (nivel && nivel.bono > 0) {
        await this.acreditar(tx, referido.referidorId, nivel.bono, 'NIVEL', `Nivel ${nivel.id}: ${total} negocios invitados`, referido.id);
      }
      return { total, nivel };
    });
    if (!resultado) return null;

    this.eventos.emit(BOOKMY_EVENTS.REFERIDO_RECOMPENSADO, {
      empresaId: referido.referidorId,
      referidaId: referido.referidaId,
      meses: mesesA,
      puntos: mesesA,
    });
    void this.avisarRecompensa(referido.referidorId, referido.referida.nombre, mesesA, resultado.nivel?.id);
    return resultado;
  }

  private async avisarRecompensa(empresaId: number, invitado: string, meses: number, nivel?: string) {
    try {
      const empresa = await this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { email: true, nombre: true } });
      if (!empresa?.email) return;
      const lineas = [
        `${invitado} se unió a Bookmy con tu invitación y ya pagó su primer mes de Pro.`,
        `Te hemos regalado ${meses} ${meses === 1 ? 'mes' : 'meses'} de Bookmy CRM Pro. Ya está aplicado en tu cuenta.`,
      ];
      if (nivel) lineas.push(`Además has subido al nivel ${nivel}. ¡Gracias por recomendarnos!`);
      await this.mail.sendGenerico({
        to: empresa.email,
        asunto: '¡Has ganado Pro gratis por invitar a un negocio!',
        titulo: `¡Enhorabuena, ${empresa.nombre}!`,
        mensaje: lineas.join('\n\n'),
        boton: { texto: 'Ver mis referidos', url: `${this.baseUrl}/referidos` },
      });
    } catch (e) {
      this.registrarError('No se pudo avisar de la recompensa', e);
    }
  }

  /* ── Vista del negocio ──────────────────────────────────── */

  async mio(user: AuthenticatedUser) {
    const empresaId = user.empresaId;
    if (!empresaId) throw new ForbiddenException('Tu usuario no está asociado a ningún negocio.');

    const codigo = await this.codigoDe(empresaId);
    const [registro, empresa, referidos, recompensas] = await Promise.all([
      this.prisma.codigoReferido.findUnique({ where: { empresaId }, select: { visitas: true } }),
      this.prisma.empresa.findUnique({
        where: { id: empresaId },
        select: { nombre: true, plan: true, proGratisHasta: true, mesesProCredito: true },
      }),
      this.prisma.referido.findMany({
        where: { referidorId: empresaId },
        orderBy: { createdAt: 'desc' },
        include: { referida: { select: { nombre: true, logo: true, createdAt: true } } },
      }),
      this.prisma.recompensaReferido.findMany({
        where: { empresaId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const recompensados = referidos.filter((r) => r.estado === EstadoReferido.RECOMPENSADO).length;
    const pendientes = referidos.filter((r) => r.estado === EstadoReferido.PENDIENTE).length;
    const ahora = new Date();
    const proGratisHasta = empresa?.proGratisHasta && empresa.proGratisHasta > ahora ? empresa.proGratisHasta : null;

    return {
      codigo,
      enlace: this.enlaceDe(codigo),
      empresa: empresa?.nombre ?? '',
      recompensa: { meses: this.mesesReferidor, mesesBienvenida: this.mesesBienvenida },
      niveles: NIVELES,
      nivel: this.nivelPara(recompensados),
      embudo: {
        visitas: registro?.visitas ?? 0,
        registrados: referidos.length,
        pendientes,
        recompensados,
        anulados: referidos.filter((r) => r.estado === EstadoReferido.ANULADO).length,
      },
      meses: {
        ganados: recompensas.reduce((a, r) => a + r.meses, 0),
        credito: empresa?.mesesProCredito ?? 0,
        proGratisHasta,
        pagaPro: empresa?.plan === PlanEmpresa.PRO,
      },
      referidos: referidos.map((r) => ({
        id: r.id,
        empresa: r.referida.nombre,
        logo: r.referida.logo,
        estado: r.estado,
        meses: r.mesesReferidor,
        createdAt: r.createdAt,
        recompensadoEn: r.recompensadoEn,
      })),
      recompensas,
      invitacionesRestantesHoy: Math.max(0, MAX_INVITACIONES_DIA - (this.invitacionesHoy.get(this.claveHoy(empresaId)) ?? 0)),
    };
  }

  private claveHoy(empresaId: number) {
    return `${empresaId}|${new Date().toISOString().slice(0, 10)}`;
  }

  /** Invita por correo a otros negocios (con tope diario). */
  async invitar(user: AuthenticatedUser, emails: string[], mensaje?: string) {
    const empresaId = user.empresaId;
    if (!empresaId) throw new ForbiddenException('Tu usuario no está asociado a ningún negocio.');
    const limpios = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
    if (limpios.length === 0) throw new BadRequestException('Escribe al menos un correo válido.');

    const clave = this.claveHoy(empresaId);
    const usados = this.invitacionesHoy.get(clave) ?? 0;
    if (usados + limpios.length > MAX_INVITACIONES_DIA) {
      throw new BadRequestException(`Hoy puedes enviar ${Math.max(0, MAX_INVITACIONES_DIA - usados)} invitaciones más.`);
    }

    const [codigo, empresa] = await Promise.all([
      this.codigoDe(empresaId),
      this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { nombre: true } }),
    ]);
    const enlace = this.enlaceDe(codigo);
    const nombre = empresa?.nombre ?? 'Un negocio';
    let enviados = 0;
    const fallidos: string[] = [];
    for (const to of limpios) {
      try {
        await this.mail.sendGenerico({
          to,
          asunto: `${nombre} te invita a Bookmy`,
          titulo: `${nombre} te recomienda Bookmy`,
          mensaje: [
            mensaje?.trim() || `Hola, en ${nombre} usamos Bookmy para gestionar reservas, clientes y cobros, y creemos que te encantará.`,
            `Regístrate con nuestro código ${codigo} y, cuando actives Bookmy CRM Pro, te regalamos ${this.mesesBienvenida} ${this.mesesBienvenida === 1 ? 'mes' : 'meses'} gratis.`,
          ].join('\n\n'),
          boton: { texto: 'Crear mi cuenta', url: enlace },
        });
        enviados++;
      } catch (e) {
        fallidos.push(to);
        this.registrarError(`Invitación a ${to}`, e);
      }
    }
    this.invitacionesHoy.set(clave, usados + enviados);
    return { enviados, fallidos };
  }

  /* ── Superadmin ─────────────────────────────────────────── */

  async admin() {
    const [codigos, visitas, total, pendientes, recompensados, meses, referidos, ranking] = await Promise.all([
      this.prisma.codigoReferido.count(),
      this.prisma.codigoReferido.aggregate({ _sum: { visitas: true } }),
      this.prisma.referido.count(),
      this.prisma.referido.count({ where: { estado: EstadoReferido.PENDIENTE } }),
      this.prisma.referido.count({ where: { estado: EstadoReferido.RECOMPENSADO } }),
      this.prisma.recompensaReferido.aggregate({ _sum: { meses: true } }),
      this.prisma.referido.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          referidor: { select: { id: true, nombre: true } },
          referida: { select: { id: true, nombre: true } },
        },
      }),
      this.prisma.codigoReferido.findMany({
        include: {
          empresa: {
            select: {
              id: true,
              nombre: true,
              mesesProCredito: true,
              proGratisHasta: true,
              referidosHechos: { select: { estado: true } },
              recompensasReferido: { select: { meses: true } },
            },
          },
        },
      }),
    ]);

    return {
      resumen: {
        codigos,
        visitas: visitas._sum.visitas ?? 0,
        referidos: total,
        pendientes,
        recompensados,
        mesesEntregados: meses._sum.meses ?? 0,
        conversion: total ? Math.round((recompensados / total) * 100) : 0,
      },
      config: { mesesReferidor: this.mesesReferidor, mesesBienvenida: this.mesesBienvenida, niveles: NIVELES },
      ranking: ranking
        .map((c) => {
          const rec = c.empresa.referidosHechos.filter((r) => r.estado === EstadoReferido.RECOMPENSADO).length;
          return {
            empresaId: c.empresa.id,
            empresa: c.empresa.nombre,
            codigo: c.codigo,
            visitas: c.visitas,
            referidos: c.empresa.referidosHechos.length,
            recompensados: rec,
            mesesGanados: c.empresa.recompensasReferido.reduce((a, r) => a + r.meses, 0),
            credito: c.empresa.mesesProCredito,
            proGratisHasta: c.empresa.proGratisHasta,
            nivel: this.nivelPara(rec).actual?.id ?? null,
          };
        })
        .sort((a, b) => b.recompensados - a.recompensados || b.referidos - a.referidos || b.visitas - a.visitas)
        .slice(0, 50),
      referidos: referidos.map((r) => ({
        id: r.id,
        codigo: r.codigo,
        referidor: r.referidor,
        referida: r.referida,
        estado: r.estado,
        mesesReferidor: r.mesesReferidor,
        mesesReferida: r.mesesReferida,
        createdAt: r.createdAt,
        recompensadoEn: r.recompensadoEn,
      })),
    };
  }

  /** Meses de regalo o corrección manual del superadmin. */
  async otorgarMeses(dto: { empresaId: number; meses: number; motivo: string }, user: AuthenticatedUser) {
    if (!Number.isInteger(dto.meses) || dto.meses < 1 || dto.meses > 24) {
      throw new BadRequestException('Indica entre 1 y 24 meses.');
    }
    const existe = await this.prisma.empresa.findUnique({ where: { id: dto.empresaId }, select: { id: true } });
    if (!existe) throw new NotFoundException('La empresa no existe.');
    return this.prisma.$transaction((tx) =>
      this.acreditar(tx, dto.empresaId, dto.meses, 'MANUAL', dto.motivo.trim() || 'Regalo de Bookmy', undefined, user.userId),
    );
  }

  /** Anula un referido pendiente (fraude, duplicado…). */
  async anular(id: number) {
    const r = await this.prisma.referido.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('El referido no existe.');
    if (r.estado !== EstadoReferido.PENDIENTE) {
      throw new BadRequestException('Solo se puede anular un referido pendiente.');
    }
    return this.prisma.referido.update({ where: { id }, data: { estado: EstadoReferido.ANULADO } });
  }

  registrarError(contexto: string, error: unknown) {
    this.logger.error(`${contexto}: ${error instanceof Error ? error.message : error}`);
  }
}
