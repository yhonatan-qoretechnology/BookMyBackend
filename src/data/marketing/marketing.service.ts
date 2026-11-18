import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppointmentStatus, EstadoCampana, Prisma, Role } from '@prisma/client';
import { Twilio } from 'twilio';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { MailService } from '../email/mail.service';
import { CriteriosFiltroDto, GuardarCampanaDto, GuardarFiltroDto } from './dto/marketing.dto';

/** Un cliente que cumple el filtro, con lo necesario para escribirle. */
export interface ClienteFiltrado {
  userId: number;
  nombre: string;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  cumpleanos: string | null;
  reservas: number;
  ultimaVisita: string | null;
}

interface Alcance {
  empresaId: number;
  /** BRANCH_ADMIN: solo ve y escribe a los clientes de su sede */
  sedeId?: number;
}

const DIA_MS = 86_400_000;
const MAX_IMAGEN_BYTES = 100 * 1024;

/** Valida las imágenes (data URL de JPG/PNG/WEBP, máx. 100 KB) y devuelve sus datos. */
function imagenesValidas(lista?: string[]) {
  const out: { mime: string; buffer: Buffer; dataUrl: string }[] = [];
  for (const [i, url] of (lista ?? []).slice(0, 2).entries()) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(url || '');
    if (!m) throw new BadRequestException(`La imagen ${i + 1} debe ser JPG, PNG o WEBP.`);
    const buffer = Buffer.from(m[2], 'base64');
    if (buffer.length > MAX_IMAGEN_BYTES) {
      throw new BadRequestException(`La imagen ${i + 1} pesa ${Math.ceil(buffer.length / 1024)} KB: el límite es 100 KB.`);
    }
    out.push({ mime: m[1], buffer, dataUrl: url });
  }
  return out;
}

/**
 * Filtros de clientes guardados y campañas de cada negocio (correo o
 * WhatsApp). El filtro guarda criterios, no una lista: al enviar se evalúa
 * de nuevo, así la campaña llega a quien cumple el filtro ese día.
 */
@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);
  private readonly twilio: Twilio | null;
  private readonly whatsappFrom: string | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    this.whatsappFrom = this.config.get<string>('TWILIO_WHATSAPP_FROM') || null;
    this.twilio = sid && token && this.whatsappFrom ? new Twilio(sid, token) : null;
  }

  /* ── Alcance ───────────────────────────────────────────────── */

  private async alcance(user: AuthenticatedUser, empresaId?: number): Promise<Alcance> {
    if (user.role === Role.SUPER_ADMIN) {
      if (!empresaId) throw new BadRequestException('Elige una empresa.');
      return { empresaId };
    }
    if (user.role === Role.COMPANY_ADMIN && user.empresaId) {
      return { empresaId: user.empresaId };
    }
    if (user.role === Role.BRANCH_ADMIN && user.sedeId) {
      const sede = await this.prisma.sede.findUnique({
        where: { id: user.sedeId },
        select: { empresaId: true },
      });
      if (!sede) throw new ForbiddenException('Tu sede no existe.');
      return { empresaId: sede.empresaId, sedeId: user.sedeId };
    }
    throw new ForbiddenException('Solo el negocio puede usar las campañas.');
  }

  /* ── Evaluación de un filtro ───────────────────────────────── */

  async evaluar(alc: Alcance, c: CriteriosFiltroDto): Promise<ClienteFiltrado[]> {
    const sedes = await this.prisma.sede.findMany({
      where: { empresaId: alc.empresaId },
      select: { id: true },
    });
    let sedeIds = sedes.map((s) => s.id);
    const sedeFiltro = alc.sedeId ?? c.sedeId;
    if (sedeFiltro) sedeIds = sedeIds.filter((id) => id === sedeFiltro);
    if (sedeIds.length === 0) return [];

    /* Clientes del negocio: los dados de alta en él y los que han reservado */
    const [vinculos, stats] = await Promise.all([
      this.prisma.clienteEmpresa.findMany({
        where: {
          empresaId: alc.empresaId,
          ...(sedeFiltro && { OR: [{ sedeId: sedeFiltro }, { sedeId: null }] }),
        },
        select: { userId: true, createdAt: true },
      }),
      this.prisma.appointment.groupBy({
        by: ['userId'],
        where: { sedeId: { in: sedeIds }, estado: { not: AppointmentStatus.CANCELLED } },
        _count: { _all: true },
        _max: { horaInicio: true },
        _min: { createdAt: true },
      }),
    ]);
    const porUsuario = new Map<number, { reservas: number; ultima: Date | null; desde: Date | null }>();
    for (const v of vinculos) porUsuario.set(v.userId, { reservas: 0, ultima: null, desde: v.createdAt });
    for (const s of stats) {
      const prev = porUsuario.get(s.userId);
      const desde = [prev?.desde, s._min.createdAt].filter(Boolean) as Date[];
      porUsuario.set(s.userId, {
        reservas: s._count._all,
        ultima: s._max.horaInicio,
        desde: desde.length ? new Date(Math.min(...desde.map((d) => d.getTime()))) : null,
      });
    }

    let ids = [...porUsuario.keys()];
    if (c.servicioId) {
      const conServicio = await this.prisma.appointment.findMany({
        where: { sedeId: { in: sedeIds }, serviceId: c.servicioId, estado: { not: AppointmentStatus.CANCELLED } },
        select: { userId: true },
        distinct: ['userId'],
      });
      const set = new Set(conServicio.map((a) => a.userId));
      ids = ids.filter((id) => set.has(id));
    }
    if (ids.length === 0) return [];

    const usuarios = await this.prisma.users.findMany({
      where: { id: { in: ids }, role: Role.CLIENT },
      select: {
        id: true,
        email: true,
        UserData: {
          select: {
            name: true, email: true, phone: true, gender: true, birthdate: true,
            idioma: true, direccion: true, country: { select: { dialingCode: true } },
          },
        },
        UserLocation: { select: { city: true, region: true } },
      },
    });

    const hoy = new Date();
    const mesFiltro = c.cumpleMes === 0 ? hoy.getMonth() + 1 : c.cumpleMes;
    const ciudad = c.ciudad ? normalizar(c.ciudad) : null;
    const resultado: ClienteFiltrado[] = [];

    for (const u of usuarios) {
      const d = u.UserData;
      const st = porUsuario.get(u.id) ?? { reservas: 0, ultima: null, desde: null };
      const nac = d?.birthdate ?? null;

      if (c.genero && normalizar(d?.gender || '') !== normalizar(c.genero)) continue;
      if (c.idioma && !normalizar(d?.idioma || '').startsWith(normalizar(c.idioma))) continue;
      if (c.edadMin != null || c.edadMax != null) {
        if (!nac) continue;
        const edad = edadEn(nac, hoy);
        if (c.edadMin != null && edad < c.edadMin) continue;
        if (c.edadMax != null && edad > c.edadMax) continue;
      }
      if (mesFiltro) {
        if (!nac || nac.getUTCMonth() + 1 !== mesFiltro) continue;
      }
      if (c.cumpleHoy) {
        if (!nac || nac.getUTCMonth() !== hoy.getMonth() || nac.getUTCDate() !== hoy.getDate()) continue;
      }
      if (ciudad) {
        const donde = normalizar([u.UserLocation?.city, u.UserLocation?.region, d?.direccion].filter(Boolean).join(' '));
        if (!donde.includes(ciudad)) continue;
      }
      if (c.reservasMin != null && st.reservas < c.reservasMin) continue;
      if (c.sinVisitaDias) {
        if (st.ultima && hoy.getTime() - st.ultima.getTime() < c.sinVisitaDias * DIA_MS) continue;
      }
      if (c.visitaRecienteDias) {
        if (!st.ultima || hoy.getTime() - st.ultima.getTime() > c.visitaRecienteDias * DIA_MS) continue;
      }
      if (c.nuevosDias) {
        if (!st.desde || hoy.getTime() - st.desde.getTime() > c.nuevosDias * DIA_MS) continue;
      }

      resultado.push({
        userId: u.id,
        nombre: d?.name || u.email,
        email: d?.email || u.email || null,
        telefono: telefonoInternacional(d?.phone, d?.country?.dialingCode),
        ciudad: u.UserLocation?.city ?? null,
        cumpleanos: nac ? nac.toISOString().slice(0, 10) : null,
        reservas: st.reservas,
        ultimaVisita: st.ultima ? st.ultima.toISOString() : null,
      });
    }
    return resultado.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  async vistaPrevia(user: AuthenticatedUser, empresaId: number | undefined, criterios: CriteriosFiltroDto) {
    const alc = await this.alcance(user, empresaId);
    const lista = await this.evaluar(alc, criterios);
    return {
      total: lista.length,
      conEmail: lista.filter((c) => c.email).length,
      conTelefono: lista.filter((c) => c.telefono).length,
      muestra: lista.slice(0, 25),
    };
  }

  /* ── Filtros guardados ─────────────────────────────────────── */

  async listarFiltros(user: AuthenticatedUser, empresaId?: number) {
    const alc = await this.alcance(user, empresaId);
    const filtros = await this.prisma.filtroCliente.findMany({
      where: { empresaId: alc.empresaId },
      orderBy: { updatedAt: 'desc' },
    });
    /* Cuántos clientes cumple hoy cada uno */
    return Promise.all(
      filtros.map(async (f) => {
        const lista = await this.evaluar(alc, (f.criterios ?? {}) as CriteriosFiltroDto);
        return {
          ...f,
          total: lista.length,
          conEmail: lista.filter((c) => c.email).length,
          conTelefono: lista.filter((c) => c.telefono).length,
        };
      }),
    );
  }

  private async filtroPropio(id: number, alc: Alcance) {
    const filtro = await this.prisma.filtroCliente.findUnique({ where: { id } });
    if (!filtro || filtro.empresaId !== alc.empresaId) throw new NotFoundException('El filtro no existe.');
    return filtro;
  }

  async crearFiltro(user: AuthenticatedUser, dto: GuardarFiltroDto) {
    const alc = await this.alcance(user, dto.empresaId);
    return this.prisma.filtroCliente.create({
      data: {
        empresaId: alc.empresaId,
        nombre: dto.nombre.trim(),
        criterios: this.criteriosLimpios(dto.criterios, alc),
        creadoPorId: user.userId,
      },
    });
  }

  async editarFiltro(user: AuthenticatedUser, id: number, dto: GuardarFiltroDto) {
    const alc = await this.alcance(user, dto.empresaId);
    await this.filtroPropio(id, alc);
    return this.prisma.filtroCliente.update({
      where: { id },
      data: { nombre: dto.nombre.trim(), criterios: this.criteriosLimpios(dto.criterios, alc) },
    });
  }

  async borrarFiltro(user: AuthenticatedUser, id: number, empresaId?: number) {
    const alc = await this.alcance(user, empresaId);
    await this.filtroPropio(id, alc);
    await this.prisma.filtroCliente.delete({ where: { id } });
    return { ok: true };
  }

  /** Quita los vacíos; la sede de un BRANCH_ADMIN queda fija. */
  private criteriosLimpios(c: CriteriosFiltroDto, alc: Alcance): Prisma.InputJsonObject {
    const limpio = Object.fromEntries(
      Object.entries(c ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false),
    );
    if (alc.sedeId) limpio.sedeId = alc.sedeId;
    return limpio as Prisma.InputJsonObject;
  }

  /* ── Opciones del formulario ───────────────────────────────── */

  async opciones(user: AuthenticatedUser, empresaId?: number) {
    const alc = await this.alcance(user, empresaId);
    const todos = await this.evaluar(alc, {});
    const ciudades = [...new Set(todos.map((c) => c.ciudad).filter(Boolean) as string[])].sort();
    return {
      ciudades,
      totalClientes: todos.length,
      canales: { email: true, whatsapp: !!this.twilio },
    };
  }

  /* ── Campañas ──────────────────────────────────────────────── */

  async listarCampanas(user: AuthenticatedUser, empresaId?: number) {
    const alc = await this.alcance(user, empresaId);
    return this.prisma.campanaCliente.findMany({
      where: { empresaId: alc.empresaId },
      orderBy: { createdAt: 'desc' },
      include: { filtro: { select: { id: true, nombre: true } } },
      take: 200,
    });
  }

  async crearCampana(user: AuthenticatedUser, dto: GuardarCampanaDto) {
    const alc = await this.alcance(user, dto.empresaId);
    await this.filtroPropio(dto.filtroId, alc);
    if (dto.canal === 'WHATSAPP' && !this.twilio && !dto.borrador) {
      throw new BadRequestException('WhatsApp no está configurado todavía. Envíala por correo o guárdala como borrador.');
    }
    if (dto.canal === 'EMAIL' && !dto.asunto?.trim()) {
      throw new BadRequestException('El correo necesita un asunto.');
    }
    const imagenes = imagenesValidas(dto.imagenes);
    const programada = dto.programadaPara ? new Date(dto.programadaPara) : null;
    const futura = !!programada && programada.getTime() > Date.now() + 30_000;
    const estado = dto.borrador
      ? EstadoCampana.BORRADOR
      : futura
        ? EstadoCampana.PROGRAMADA
        : EstadoCampana.ENVIANDO;

    const campana = await this.prisma.campanaCliente.create({
      data: {
        empresaId: alc.empresaId,
        filtroId: dto.filtroId,
        nombre: dto.nombre.trim(),
        canal: dto.canal,
        asunto: dto.asunto?.trim() || null,
        mensaje: dto.mensaje,
        ...(imagenes.length && { imagenes: imagenes.map((x) => x.dataUrl) }),
        estado,
        programadaPara: futura ? programada : null,
        creadoPorId: user.userId,
      },
    });
    if (estado === EstadoCampana.ENVIANDO) {
      /* Se responde ya; el envío sigue en segundo plano */
      void this.enviar(campana.id).catch((e) => this.logger.error(`Campaña ${campana.id}: ${e.message}`));
    }
    return campana;
  }

  private async campanaPropia(id: number, alc: Alcance) {
    const c = await this.prisma.campanaCliente.findUnique({ where: { id } });
    if (!c || c.empresaId !== alc.empresaId) throw new NotFoundException('La campaña no existe.');
    return c;
  }

  async enviarAhora(user: AuthenticatedUser, id: number, empresaId?: number) {
    const alc = await this.alcance(user, empresaId);
    const c = await this.campanaPropia(id, alc);
    if (c.canal === 'WHATSAPP' && !this.twilio) {
      throw new BadRequestException('WhatsApp no está configurado todavía.');
    }
    const tomada = await this.prisma.campanaCliente.updateMany({
      where: { id, estado: { in: [EstadoCampana.BORRADOR, EstadoCampana.PROGRAMADA] } },
      data: { estado: EstadoCampana.ENVIANDO },
    });
    if (tomada.count === 0) throw new BadRequestException('Esta campaña ya se envió o se canceló.');
    void this.enviar(id).catch((e) => this.logger.error(`Campaña ${id}: ${e.message}`));
    return { ok: true };
  }

  async cancelar(user: AuthenticatedUser, id: number, empresaId?: number) {
    const alc = await this.alcance(user, empresaId);
    await this.campanaPropia(id, alc);
    const r = await this.prisma.campanaCliente.updateMany({
      where: { id, estado: { in: [EstadoCampana.BORRADOR, EstadoCampana.PROGRAMADA] } },
      data: { estado: EstadoCampana.CANCELADA },
    });
    if (r.count === 0) throw new BadRequestException('Solo se cancela un borrador o una campaña programada.');
    return { ok: true };
  }

  /** Pública: imagen de una campaña (WhatsApp la descarga por URL). */
  async imagen(id: number, n: number) {
    const c = await this.prisma.campanaCliente.findUnique({ where: { id }, select: { imagenes: true } });
    const url = ((c?.imagenes as string[] | null) ?? [])[n];
    const m = url ? /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(url) : null;
    if (!m) throw new NotFoundException('La imagen no existe.');
    return { mime: m[1], buffer: Buffer.from(m[2], 'base64') };
  }

  /** Las programadas cuya hora ya llegó. */
  @Cron(CronExpression.EVERY_MINUTE)
  async procesarProgramadas() {
    const pendientes = await this.prisma.campanaCliente.findMany({
      where: { estado: EstadoCampana.PROGRAMADA, programadaPara: { lte: new Date() } },
      select: { id: true },
      take: 20,
    });
    for (const { id } of pendientes) {
      const tomada = await this.prisma.campanaCliente.updateMany({
        where: { id, estado: EstadoCampana.PROGRAMADA },
        data: { estado: EstadoCampana.ENVIANDO },
      });
      if (tomada.count) await this.enviar(id).catch((e) => this.logger.error(`Campaña ${id}: ${e.message}`));
    }
  }

  /** Envía una campaña ya marcada ENVIANDO. */
  private async enviar(id: number) {
    const c = await this.prisma.campanaCliente.findUnique({
      where: { id },
      include: { filtro: true, empresa: { select: { nombre: true } } },
    });
    if (!c) return;
    if (!c.filtro) {
      await this.prisma.campanaCliente.update({
        where: { id },
        data: { estado: EstadoCampana.CANCELADA, enviadaEn: new Date() },
      });
      return;
    }
    const lista = await this.evaluar(
      { empresaId: c.empresaId },
      (c.filtro.criterios ?? {}) as CriteriosFiltroDto,
    );
    const destinos = lista.filter((x) => (c.canal === 'EMAIL' ? x.email : x.telefono));
    const negocio = c.empresa.nombre;
    const imagenes = imagenesValidas((c.imagenes as string[] | null) ?? []);
    const ext = (mime: string) => (mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg');
    /* WhatsApp necesita una URL pública para cada imagen */
    const apiBase = (this.config.get<string>('API_PUBLIC_URL') || 'https://api.bookmy.es').replace(/\/$/, '');
    const mediaUrl = imagenes.map((_, i) => `${apiBase}/marketing/campanas/${c.id}/imagen/${i}`);
    const enlace = `${(this.config.get<string>('APP_URL') || 'https://bookmy.es').replace(/\/$/, '')}`;
    let enviados = 0;
    let fallidos = 0;

    for (const d of destinos) {
      const texto = rellenar(c.mensaje, { nombre: primerNombre(d.nombre), negocio, enlace_reserva: enlace });
      try {
        if (c.canal === 'EMAIL') {
          await this.mail.sendGenerico({
            to: d.email as string,
            asunto: rellenar(c.asunto || c.nombre, { nombre: primerNombre(d.nombre), negocio, enlace_reserva: enlace }),
            titulo: negocio,
            mensaje: texto,
            boton: { texto: 'Reservar', url: enlace },
            adjuntos: imagenes.map((img, i) => ({
              filename: `imagen-${i + 1}.${ext(img.mime)}`,
              content: img.buffer,
              contentType: img.mime,
            })),
          });
        } else if (this.twilio) {
          await this.twilio.messages.create({
            from: `whatsapp:${this.whatsappFrom}`,
            to: `whatsapp:${d.telefono}`,
            body: texto,
            ...(mediaUrl.length && { mediaUrl }),
          });
        } else {
          throw new Error('WhatsApp sin configurar');
        }
        enviados++;
      } catch (e) {
        fallidos++;
        this.logger.warn(`Campaña ${id} → ${d.userId}: ${(e as Error).message}`);
      }
    }

    await this.prisma.campanaCliente.update({
      where: { id },
      data: {
        estado: EstadoCampana.ENVIADA,
        enviadaEn: new Date(),
        destinatarios: destinos.length,
        enviados,
        fallidos,
      },
    });
  }
}

/* ── Utilidades ─────────────────────────────────────────────── */

function normalizar(v: string) {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function edadEn(nac: Date, hoy: Date) {
  let edad = hoy.getFullYear() - nac.getUTCFullYear();
  const m = hoy.getMonth() - nac.getUTCMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getUTCDate())) edad--;
  return edad;
}

/** +34600111222: el teléfono con el prefijo del país si no lo trae. */
function telefonoInternacional(tel?: string | null, prefijo?: string | null) {
  if (!tel) return null;
  const limpio = tel.replace(/[^\d+]/g, '');
  if (!limpio) return null;
  if (limpio.startsWith('+')) return limpio;
  const pre = (prefijo || '').replace(/\D/g, '');
  if (pre && limpio.startsWith(pre) && limpio.length > 9) return `+${limpio}`;
  return pre ? `+${pre}${limpio}` : null;
}

function primerNombre(n: string) {
  return n.split(/\s+/)[0] || n;
}

function rellenar(texto: string, vars: Record<string, string>) {
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in vars ? vars[k] : m));
}
