import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  ClientState,
  ClientType,
  PlanEmpresa,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { HashService } from '../../auth/services/hash/hash.service';
import { RegistroNegocioDto } from './dto/registro-negocio.dto';
import { PlanService } from './plan.service';

/** Horario con el que nace una sede: de lunes a sábado. */
const HORARIO_INICIAL = [
  { diaSemana: 1, horaApertura: '09:00', horaCierre: '20:00' },
  { diaSemana: 2, horaApertura: '09:00', horaCierre: '20:00' },
  { diaSemana: 3, horaApertura: '09:00', horaCierre: '20:00' },
  { diaSemana: 4, horaApertura: '09:00', horaCierre: '20:00' },
  { diaSemana: 5, horaApertura: '09:00', horaCierre: '20:00' },
  { diaSemana: 6, horaApertura: '10:00', horaCierre: '14:00' },
];

/**
 * Alta de un negocio desde la web, sin que intervenga nadie.
 *
 * Crea en una sola transacción la empresa, su primera sede (con horario
 * por defecto, para que pueda recibir reservas desde el minuto uno) y el
 * usuario que la administra, y devuelve la sesión ya iniciada: quien se
 * da de alta entra directo a su panel.
 */
@Injectable()
export class RegistroNegocioService {
  private readonly logger = new Logger(RegistroNegocioService.name);

  constructor(
    private prisma: PrismaService,
    private hashService: HashService,
    private authService: AuthService,
    private planService: PlanService,
  ) {}

  async registrar(dto: RegistroNegocioDto) {
    if (!dto.acepta) {
      throw new BadRequestException(
        'Hay que aceptar los términos y la política de privacidad.',
      );
    }

    const email = dto.email.trim().toLowerCase();
    const nombreEmpresa = dto.empresaNombre.trim();

    /* Se comprueba antes de abrir la transacción para poder devolver un
       mensaje claro por cada caso en vez de un choque de índice único. */
    const [correoEnUso, nombreEnUso, telefonoEnUso] = await Promise.all([
      this.prisma.users.findUnique({ where: { email }, select: { id: true } }),
      this.prisma.empresa.findUnique({
        where: { nombre: nombreEmpresa },
        select: { id: true },
      }),
      this.prisma.userData.findUnique({
        where: { phone: dto.telefono.trim() },
        select: { id: true },
      }),
    ]);
    if (correoEnUso) {
      throw new ConflictException('Ya hay una cuenta con ese correo.');
    }
    if (nombreEnUso) {
      throw new ConflictException('Ya hay un negocio registrado con ese nombre.');
    }
    if (telefonoEnUso) {
      throw new ConflictException('Ya hay una cuenta con ese teléfono.');
    }

    const countryId = dto.countryId ?? (await this.paisPorDefecto());
    const hashedPassword = await this.hashService.hash(dto.password);
    const conPrueba = dto.plan === 'pro';
    const nombreCompleto = `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim();

    try {
      const { usuarioId, empresaId } = await this.prisma.$transaction(
        async (tx) => {
          const empresa = await tx.empresa.create({
            data: {
              nombre: nombreEmpresa,
              telefono: dto.telefono.trim(),
              email,
              descripcion: dto.rubro?.trim() || null,
              /* La prueba es de Pro, pero el plan contratado sigue siendo
                 FREE: cuando caduque, la cuenta baja sola. */
              plan: PlanEmpresa.FREE,
              trialEndsAt: conPrueba ? this.planService.finDePrueba() : null,
              trialUsed: conPrueba,
            },
            select: { id: true },
          });

          const sede = await tx.sede.create({
            data: {
              nombre: dto.sedeNombre.trim(),
              direccion: dto.direccion.trim(),
              telefono: dto.telefono.trim(),
              pais: dto.pais?.trim() || null,
              provincia: dto.provincia?.trim() || null,
              municipio: dto.municipio?.trim() || null,
              localidad: dto.localidad?.trim() || null,
              latitud: dto.latitud ?? null,
              longitud: dto.longitud ?? null,
              empresaId: empresa.id,
            },
            select: { id: true },
          });

          await tx.horarioSede.createMany({
            data: HORARIO_INICIAL.map((h) => ({ ...h, sedeId: sede.id, activo: true })),
          });

          const usuario = await tx.users.create({
            data: {
              email,
              clientType: ClientType.business,
              state: ClientState.enabled,
              acceptTerms: true,
              acceptPolitics: true,
              role: Role.COMPANY_ADMIN,
              UserAuth: { create: { email, password: hashedPassword } },
              UserData: {
                create: {
                  name: nombreCompleto,
                  phone: dto.telefono.trim(),
                  email,
                  countryId,
                  idioma: dto.idioma?.slice(0, 2) || 'es',
                  gender: 'no especificado',
                },
              },
              AdminProfile: {
                create: {
                  firstName: dto.firstName.trim(),
                  lastName: dto.lastName.trim(),
                  phone: dto.telefono.trim(),
                  empresaId: empresa.id,
                },
              },
            },
            select: { id: true },
          });

          return { usuarioId: usuario.id, empresaId: empresa.id };
        },
      );

      this.logger.log(
        `Alta de negocio: empresa=${empresaId} usuario=${usuarioId} plan=${dto.plan}`,
      );

      /* Se devuelve la sesión hecha: la web mete al dueño en su panel sin
         pedirle que vuelva a escribir la contraseña que acaba de elegir. */
      return this.authService.login({ email, password: dto.password } as never);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'Alguno de los datos ya está registrado (correo, teléfono o nombre del negocio).',
        );
      }
      throw error;
    }
  }

  /** España si existe; si no, el primer país de la tabla. */
  private async paisPorDefecto(): Promise<number> {
    const pais =
      (await this.prisma.country.findFirst({
        where: { isoCode: 'ES' },
        select: { id: true },
      })) ??
      (await this.prisma.country.findFirst({ select: { id: true } }));
    if (!pais) {
      throw new BadRequestException(
        'No hay países dados de alta en la plataforma.',
      );
    }
    return pais.id;
  }
}
