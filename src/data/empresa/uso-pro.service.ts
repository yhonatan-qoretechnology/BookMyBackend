import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppointmentStatus, PlanEmpresa, Role, TipoAvisoUso } from '@prisma/client';
import { BOOKMY_EVENTS } from '../../common/events/event-names';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../email/mail.service';

const DIA = 86_400_000;
/** No se repite el mismo tipo de aviso a un negocio antes de esto. */
const DIAS_ENTRE_AVISOS = 14;

export type EstadoUso = 'ACTIVO' | 'BAJO_USO' | 'INACTIVO' | 'USO_INUSUAL';

export interface UsoEmpresaPro {
  empresaId: number;
  empresa: string;
  email: string | null;
  enPrueba: boolean;
  citas30: number;
  canceladas30: number;
  actividad30: number;
  accesosFallidos7: number;
  ultimoAcceso: Date | null;
  ultimaActividad: Date | null;
  profesionales: number;
  estado: EstadoUso;
  motivo: string;
  ultimoAviso: { tipo: TipoAvisoUso; fecha: Date } | null;
}

/**
 * Seguimiento del uso que hacen de Bookmy CRM Pro los negocios que lo
 * tienen (pagado o en prueba), y correos de "buen uso":
 *   · BAJO_USO / INACTIVO → consejos para sacarle partido a lo que pagan.
 *   · USO_INUSUAL → muchas cancelaciones o intentos de acceso fallidos:
 *     se les avisa por si es un error o un uso indebido de la cuenta.
 */
@Injectable()
export class UsoProService {
  private readonly logger = new Logger(UsoProService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly eventos: EventEmitter2,
  ) {}

  async listar(): Promise<UsoEmpresaPro[]> {
    const ahora = new Date();
    const hace30 = new Date(ahora.getTime() - 30 * DIA);
    const hace7 = new Date(ahora.getTime() - 7 * DIA);

    const empresas = await this.prisma.empresa.findMany({
      where: { OR: [{ plan: PlanEmpresa.PRO }, { trialEndsAt: { gt: ahora } }] },
      select: {
        id: true,
        nombre: true,
        email: true,
        plan: true,
        trialEndsAt: true,
        _count: { select: { sedes: true } },
        adminProfiles: { where: { user: { role: Role.COMPANY_ADMIN } }, select: { userId: true } },
        avisosUsoPro: { orderBy: { createdAt: 'desc' }, take: 1, select: { tipo: true, createdAt: true } },
      },
      orderBy: { nombre: 'asc' },
    });

    return Promise.all(
      empresas.map(async (e) => {
        const admins = e.adminProfiles.map((a) => a.userId);
        const [citas30, canceladas30, actividad30, fallidos7, ultimoAcceso, ultimaActividad, profesionales] =
          await Promise.all([
            this.prisma.appointment.count({ where: { sede: { empresaId: e.id }, createdAt: { gte: hace30 } } }),
            this.prisma.appointment.count({
              where: { sede: { empresaId: e.id }, createdAt: { gte: hace30 }, estado: AppointmentStatus.CANCELLED },
            }),
            this.prisma.actividadPanel.count({ where: { empresaId: e.id, createdAt: { gte: hace30 } } }),
            admins.length
              ? this.prisma.accesoUsuario.count({ where: { userId: { in: admins }, exito: false, createdAt: { gte: hace7 } } })
              : Promise.resolve(0),
            admins.length
              ? this.prisma.accesoUsuario.findFirst({
                  where: { userId: { in: admins }, exito: true },
                  orderBy: { createdAt: 'desc' },
                  select: { createdAt: true },
                })
              : Promise.resolve(null),
            this.prisma.actividadPanel.findFirst({
              where: { empresaId: e.id },
              orderBy: { createdAt: 'desc' },
              select: { createdAt: true },
            }),
            this.prisma.profesional.count({ where: { sede: { empresaId: e.id } } }),
          ]);

        const { estado, motivo } = this.clasificar({
          citas30,
          canceladas30,
          actividad30,
          fallidos7,
          ultimoAcceso: ultimoAcceso?.createdAt ?? null,
          ultimaActividad: ultimaActividad?.createdAt ?? null,
          ahora,
        });

        return {
          empresaId: e.id,
          empresa: e.nombre,
          email: e.email,
          enPrueba: e.plan !== PlanEmpresa.PRO,
          citas30,
          canceladas30,
          actividad30,
          accesosFallidos7: fallidos7,
          ultimoAcceso: ultimoAcceso?.createdAt ?? null,
          ultimaActividad: ultimaActividad?.createdAt ?? null,
          profesionales,
          estado,
          motivo,
          ultimoAviso: e.avisosUsoPro[0] ? { tipo: e.avisosUsoPro[0].tipo, fecha: e.avisosUsoPro[0].createdAt } : null,
        };
      }),
    );
  }

  /** Reglas sencillas y explicables (el motivo se enseña en el panel). */
  private clasificar(d: {
    citas30: number;
    canceladas30: number;
    actividad30: number;
    fallidos7: number;
    ultimoAcceso: Date | null;
    ultimaActividad: Date | null;
    ahora: Date;
  }): { estado: EstadoUso; motivo: string } {
    const tasaCancelacion = d.citas30 ? d.canceladas30 / d.citas30 : 0;
    if (d.fallidos7 >= 10) {
      return { estado: 'USO_INUSUAL', motivo: `${d.fallidos7} intentos de acceso fallidos en 7 días` };
    }
    if (d.citas30 >= 10 && tasaCancelacion >= 0.4) {
      return { estado: 'USO_INUSUAL', motivo: `${Math.round(tasaCancelacion * 100)}% de citas canceladas en 30 días` };
    }
    const ultimo = [d.ultimoAcceso, d.ultimaActividad].filter(Boolean).map((f) => f!.getTime());
    const diasSinUso = ultimo.length ? Math.floor((d.ahora.getTime() - Math.max(...ultimo)) / DIA) : null;
    if (diasSinUso === null || diasSinUso >= 14) {
      return { estado: 'INACTIVO', motivo: diasSinUso === null ? 'Nunca ha entrado al panel' : `${diasSinUso} días sin entrar` };
    }
    if (d.citas30 < 5 && d.actividad30 < 20) {
      return { estado: 'BAJO_USO', motivo: `${d.citas30} citas y ${d.actividad30} acciones en 30 días` };
    }
    return { estado: 'ACTIVO', motivo: `${d.citas30} citas y ${d.actividad30} acciones en 30 días` };
  }

  /** Envía el correo que corresponde al estado; registra el aviso. */
  async avisar(
    uso: UsoEmpresaPro,
    opciones: { creadoPorId?: number; mensajeManual?: string } = {},
  ): Promise<boolean> {
    if (!uso.email) return false;
    const panel = this.config.get<string>('PANEL_URL') || this.config.get<string>('APP_URL') || 'https://bookmy.es';
    const manual = !!opciones.mensajeManual;
    const tipo: TipoAvisoUso = manual
      ? TipoAvisoUso.MANUAL
      : uso.estado === 'USO_INUSUAL'
        ? TipoAvisoUso.USO_INUSUAL
        : TipoAvisoUso.BAJO_USO;

    const contenido = manual
      ? { asunto: 'Un mensaje del equipo de Bookmy', mensaje: opciones.mensajeManual! }
      : tipo === TipoAvisoUso.USO_INUSUAL
        ? {
            asunto: 'Hemos notado algo inusual en tu cuenta de Bookmy',
            mensaje:
              `Hola, equipo de ${uso.empresa}:\n\n` +
              `Nuestro sistema ha detectado: ${uso.motivo}.\n\n` +
              'Si ha sido algo puntual, no tienes que hacer nada. Si no reconoces esta actividad, te recomendamos cambiar la contraseña de tu cuenta y revisar quién tiene acceso al panel en Personal.\n\n' +
              'Un buen uso de Bookmy protege tu negocio y a tus clientes. Si necesitas ayuda, responde a este correo.',
          }
        : {
            asunto: 'Saca más partido a Bookmy CRM Pro',
            mensaje:
              `Hola, equipo de ${uso.empresa}:\n\n` +
              `Vemos que este mes el panel apenas se ha usado (${uso.motivo}). Algunas ideas para aprovechar lo que incluye tu plan:\n\n` +
              '• Comparte tu enlace de reservas para que tus clientes reserven solos, a cualquier hora.\n' +
              '• Da acceso a tu equipo en Personal: cada profesional ve y gestiona su agenda.\n' +
              '• Activa los recordatorios para reducir las ausencias.\n' +
              '• Registra cobros y gastos en Facturación y revisa tus Estadísticas cada semana.\n\n' +
              '¿Te ayudamos a configurarlo? Responde a este correo.',
          };

    try {
      await this.mail.sendGenerico({
        to: uso.email,
        asunto: contenido.asunto,
        mensaje: contenido.mensaje,
        boton: { texto: 'Abrir mi panel', url: panel },
      });
      await this.prisma.avisoUsoPro.create({
        data: { empresaId: uso.empresaId, tipo, detalle: manual ? opciones.mensajeManual : uso.motivo, enviadoA: uso.email, creadoPorId: opciones.creadoPorId },
      });
      if (!manual) {
        this.eventos.emit(tipo === TipoAvisoUso.USO_INUSUAL ? BOOKMY_EVENTS.USO_PRO_INUSUAL : BOOKMY_EVENTS.USO_PRO_BAJO, {
          empresaId: uso.empresaId,
          motivo: uso.motivo,
        });
      }
      return true;
    } catch (error) {
      this.logger.error(`No se pudo enviar el aviso de uso a ${uso.empresa}: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  /** Envío manual desde el panel (SUPER_ADMIN). */
  async avisarEmpresa(empresaId: number, creadoPorId: number, mensaje?: string) {
    const uso = (await this.listar()).find((u) => u.empresaId === empresaId);
    if (!uso) throw new NotFoundException('La empresa no tiene Bookmy CRM Pro activo.');
    if (!uso.email) throw new NotFoundException('La empresa no tiene correo configurado.');
    const enviado = await this.avisar(uso, { creadoPorId, mensajeManual: mensaje?.trim() || undefined });
    return { enviado };
  }

  /** Revisión automática: solo avisa si no se le avisó de lo mismo hace poco. */
  async revisarYAvisar() {
    const lista = await this.listar();
    let enviados = 0;
    for (const uso of lista) {
      if (uso.estado === 'ACTIVO') continue;
      const tipo = uso.estado === 'USO_INUSUAL' ? TipoAvisoUso.USO_INUSUAL : TipoAvisoUso.BAJO_USO;
      const reciente = await this.prisma.avisoUsoPro.findFirst({
        where: { empresaId: uso.empresaId, tipo, createdAt: { gte: new Date(Date.now() - DIAS_ENTRE_AVISOS * DIA) } },
        select: { id: true },
      });
      if (reciente) continue;
      if (await this.avisar(uso)) enviados++;
    }
    this.logger.log(`Revisión de uso de Pro: ${lista.length} negocios, ${enviados} avisos enviados.`);
    return { revisadas: lista.length, enviados };
  }
}
