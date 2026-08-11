import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppointmentStatus,
  ClientState,
  ClientType,
  Prisma,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { SftpStorageService } from '../../storage/sftp-storage.service';
import { CreateProfesionalDto } from './dto/create-profesional.dto';
import { LinkProfesionalAccessDto } from './dto/link-profesional-access.dto';
import { UpdateProfesionalAccessDto } from './dto/update-profesional-access.dto';
import { UpdateProfesionalDto } from './dto/update-profesional.dto';

@Injectable()
export class ProfesionalService {
  private readonly logger = new Logger(ProfesionalService.name);

  constructor(
    private prisma: PrismaService,
    private readonly accessControlService: AccessControlService,
    private readonly sftpStorage: SftpStorageService,
    private readonly configService: ConfigService,
  ) {}

  private async storeProfesionalImage(file: Express.Multer.File) {
    const ext = path.extname(file.originalname) || '';
    const finalFileName = `${file.filename}${ext}`;
    const relativePath = path
      .join('uploads', 'profesionales', finalFileName)
      .replace(/\\/g, '/');

    if (this.sftpStorage.isEnabled()) {
      await this.sftpStorage.uploadLocalFile({
        localPath: file.path,
        remoteRelativePath: relativePath,
        deleteLocalAfter: true,
      });
      return relativePath;
    }

    return this.moveProfesionalFileToFinalPath(file);
  }

  private async safeDeleteRemoteOrLocal(filePath: string) {
    if (!filePath) return;
    if (this.sftpStorage.isEnabled()) {
      try {
        const normalized = filePath.trim();
        if (/^https?:\/\//i.test(normalized)) {
          await this.sftpStorage.deleteByPublicUrl(normalized);
          return;
        }

        const relative = normalized.replace(/^\/+/, '');
        await this.sftpStorage.deleteByRelativePath(relative);
        return;
      } catch (error) {
        console.error(
          `Error al eliminar archivo remoto de profesional: ${filePath}`,
          error,
        );
      }
    }
    this.safeDeleteProfesionalFile(filePath);
  }

  private moveProfesionalFileToFinalPath(file: Express.Multer.File) {
    const uploadDirAbs = path.join(process.cwd(), 'uploads', 'profesionales');
    if (!fs.existsSync(uploadDirAbs)) {
      fs.mkdirSync(uploadDirAbs, { recursive: true });
    }

    const ext = path.extname(file.originalname) || '';
    const finalFileName = `${file.filename}${ext}`;
    const finalAbsPath = path.join(uploadDirAbs, finalFileName);

    const tempAbsPath = path.isAbsolute(file.path)
      ? file.path
      : path.join(process.cwd(), file.path);

    if (tempAbsPath !== finalAbsPath) {
      fs.renameSync(tempAbsPath, finalAbsPath);
    }

    return path
      .join('uploads', 'profesionales', finalFileName)
      .replace(/\\/g, '/');
  }

  private safeDeleteProfesionalFile(filePath: string) {
    if (!filePath) return;
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    if (fs.existsSync(absPath)) {
      try {
        fs.unlinkSync(absPath);
      } catch (error) {
        console.error(
          `Error al eliminar archivo de profesional: ${absPath}`,
          error,
        );
      }
    }
  }

  /**
   * Normaliza un texto para usarlo como parte de un email
   * (sin tildes, espacios ni símbolos).
   */
  private slugifyForEmail(text: string): string {
    // Rango unicode de marcas diacríticas combinantes (U+0300 - U+036F),
    // construido por código para evitar problemas de codificación en el archivo fuente.
    const diacriticsRangeStart = String.fromCharCode(0x0300);
    const diacriticsRangeEnd = String.fromCharCode(0x036f);
    const diacritics = new RegExp(
      '[' + diacriticsRangeStart + '-' + diacriticsRangeEnd + ']',
      'g',
    );
    const slug = (text ?? '')
      .normalize('NFD')
      .replace(diacritics, '') // quita tildes/diacríticos
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
    return slug || 'profesional';
  }

  /**
   * Genera un email único con el patrón nombreProfesional@nombreEmpresa.com,
   * agregando un número al final si ya existe otro usuario con ese email.
   */
  private async generateUniqueProfesionalEmail(
    tx: Prisma.TransactionClient,
    nombreProfesional: string,
    nombreEmpresa: string,
  ): Promise<string> {
    const userSlug = this.slugifyForEmail(nombreProfesional);
    const domainSlug = this.slugifyForEmail(nombreEmpresa);

    let candidate = `${userSlug}@${domainSlug}.com`;
    let suffix = 2;

    while (
      await tx.users.findUnique({
        where: { email: candidate },
        select: { id: true },
      })
    ) {
      candidate = `${userSlug}${suffix}@${domainSlug}.com`;
      suffix++;
    }

    return candidate;
  }

  /**
   * Agrega el bloque `acceso` (email vinculado y si tiene login) a un
   * profesional que fue consultado con `include: { users: { select: { email: true } } }`.
   */
  private withAccesoInfo<
    T extends { users?: { email: string } | null },
  >(profesional: T): Omit<T, 'users'> & {
    acceso: { tieneAcceso: boolean; email: string | null };
  } {
    const { users, ...rest } = profesional;
    return {
      ...rest,
      acceso: {
        tieneAcceso: !!users,
        email: users?.email ?? null,
      },
    };
  }

  async create(
    createProfesionalDto: CreateProfesionalDto,
    user?: AuthenticatedUser,
    file?: Express.Multer.File,
  ) {
    const { password, ...profesionalData } = createProfesionalDto;

    // 1. Verificar si la sede existe
    const sede = await this.prisma.sede.findUnique({
      where: { id: createProfesionalDto.sedeId },
      select: { id: true, empresaId: true, empresa: { select: { nombre: true } } },
    });
    if (!sede) {
      if (file) {
        await this.safeDeleteRemoteOrLocal(file.path);
      }
      throw new NotFoundException(
        `Sede con ID ${createProfesionalDto.sedeId} no encontrada.`,
      );
    }

    if (user?.role === Role.BRANCH_ADMIN) {
      if (!user.sedeId || user.sedeId !== sede.id) {
        if (file) {
          await this.safeDeleteRemoteOrLocal(file.path);
        }
        throw new ForbiddenException(
          'No puede crear profesionales en otra sede.',
        );
      }
    }

    if (user?.role === Role.COMPANY_ADMIN) {
      if (!user.empresaId || user.empresaId !== sede.empresaId) {
        if (file) {
          await this.safeDeleteRemoteOrLocal(file.path);
        }
        throw new ForbiddenException(
          'No puede crear profesionales fuera de su empresa.',
        );
      }
    }

    let imagenPath: string | undefined;
    try {
      // 2. Si se subió un archivo, moverlo al directorio final con extensión
      if (file) {
        imagenPath = await this.storeProfesionalImage(file);
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // 3. Crear el profesional junto con su usuario/login (rol EMPLOYEE),
      //    en una sola transacción: o se crean ambos, o no se crea nada.
      const { profesional, email } = await this.prisma.$transaction(
        async (tx) => {
          const created = await tx.profesional.create({
            data: {
              ...profesionalData,
              imagen: imagenPath,
            },
          });

          const email = await this.generateUniqueProfesionalEmail(
            tx,
            created.nombre,
            sede.empresa?.nombre ?? 'empresa',
          );

          const newUser = await tx.users.create({
            data: {
              email,
              clientType: ClientType.people,
              state: ClientState.enabled,
              acceptTerms: true,
              acceptPolitics: true,
              role: Role.EMPLOYEE,
              UserAuth: {
                create: {
                  email,
                  password: hashedPassword,
                },
              },
            },
          });

          const linked = await tx.profesional.update({
            where: { id: created.id },
            data: { user_id: newUser.id },
          });

          return { profesional: linked, email };
        },
      );

      return {
        ...profesional,
        acceso: {
          email,
          mensaje:
            'Comparte este email y la contraseña que registraste con el profesional para que pueda iniciar sesión.',
        },
      };
    } catch (error) {
      // 4. Limpiar el archivo si algo falla
      if (file) {
        await this.safeDeleteRemoteOrLocal(imagenPath || file.path);
      }
      // 5. Manejar errores de Prisma, por ejemplo, teléfono o email duplicado
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = Array.isArray((error.meta as any)?.target)
            ? ((error.meta as any).target as string[]).join(',')
            : String((error.meta as any)?.target ?? '');

          if (target.includes('phone')) {
            throw new BadRequestException(
              'El número de teléfono ya está en uso.',
            );
          }

          if (target.includes('email')) {
            throw new BadRequestException(
              'El email generado para el acceso ya está en uso, intenta nuevamente.',
            );
          }

          throw new BadRequestException(
            'Ya existe un registro con los datos proporcionados.',
          );
        }
      }
      throw error;
    }
  }

  async linkAccess(
    id: number,
    dto: LinkProfesionalAccessDto,
    user?: AuthenticatedUser,
  ) {
    await this.accessControlService.ensureProfessionalAccessForUser(id, user);

    const profesional = await this.prisma.profesional.findUnique({
      where: { id },
    });
    if (!profesional) {
      throw new NotFoundException(`Profesional con ID ${id} no encontrado.`);
    }

    if (profesional.user_id) {
      throw new BadRequestException(
        'Este profesional ya tiene acceso vinculado.',
      );
    }

    const existingUser = await this.prisma.users.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existingUser) {
      throw new BadRequestException(
        'El email ya está en uso por otro usuario.',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.prisma.$transaction(async (tx) => {
      const newUser = await tx.users.create({
        data: {
          email: dto.email,
          clientType: ClientType.people,
          state: ClientState.enabled,
          acceptTerms: true,
          acceptPolitics: true,
          role: Role.EMPLOYEE,
          UserAuth: {
            create: {
              email: dto.email,
              password: hashedPassword,
            },
          },
        },
      });

      return tx.profesional.update({
        where: { id },
        data: { user_id: newUser.id },
      });
    });
  }

  async updateAccess(
    id: number,
    dto: UpdateProfesionalAccessDto,
    user?: AuthenticatedUser,
  ) {
    if (!dto.email && !dto.password) {
      throw new BadRequestException(
        'Debe enviar al menos un email o una contraseña nueva.',
      );
    }

    await this.accessControlService.ensureProfessionalAccessForUser(id, user);

    const profesional = await this.prisma.profesional.findUnique({
      where: { id },
    });
    if (!profesional) {
      throw new NotFoundException(`Profesional con ID ${id} no encontrado.`);
    }

    if (!profesional.user_id) {
      throw new BadRequestException(
        'Este profesional todavía no tiene acceso vinculado. Usa primero "vincular-acceso".',
      );
    }

    if (dto.email) {
      const existingUser = await this.prisma.users.findFirst({
        where: { email: dto.email, id: { not: profesional.user_id } },
        select: { id: true },
      });
      if (existingUser) {
        throw new BadRequestException(
          'El email ya está en uso por otro usuario.',
        );
      }
    }

    const hashedPassword = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : undefined;

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      if (dto.email) {
        await tx.users.update({
          where: { id: profesional.user_id! },
          data: { email: dto.email },
        });
      }

      return tx.userAuth.update({
        where: { user_id: profesional.user_id! },
        data: {
          ...(dto.email ? { email: dto.email } : {}),
          ...(hashedPassword ? { password: hashedPassword } : {}),
        },
        select: { email: true, updatedAt: true },
      });
    });

    return {
      profesionalId: id,
      acceso: {
        tieneAcceso: true,
        email: updatedUser.email,
      },
    };
  }

  async findAll() {
    const profesionales = await this.prisma.profesional.findMany({
      include: { users: { select: { email: true } } },
    });
    return profesionales.map((profesional) =>
      this.withAccesoInfo(profesional),
    );
  }

  async findOne(id: number) {
    const profesional = await this.prisma.profesional.findUnique({
      where: { id },
      include: { users: { select: { email: true } } },
    });
    if (!profesional) {
      throw new NotFoundException(`Profesional con ID ${id} no encontrado.`);
    }
    return this.withAccesoInfo(profesional);
  }

  async findProfesionalConServiciosYSede(
    profesionalId: number,
    language: string = 'es',
  ) {
    const baseUrl = (
      this.configService.get<string>('UPLOADS_PUBLIC_BASE_URL') ?? ''
    )
      .trim()
      .replace(/\/+$/g, '');

    this.logger.log(
      `[findProfesionalConServiciosYSede] profesionalId=${profesionalId} language=${language} baseUrl=${baseUrl}`,
    );
    // Log extra para depurar en entornos donde Nest Logger no esté mostrando logs
    // eslint-disable-next-line no-console
    console.log(
      `[findProfesionalConServiciosYSede] profesionalId=${profesionalId} language=${language} baseUrl=${baseUrl}`,
    );

    const profesional = await this.prisma.profesional.findUnique({
      where: { id: profesionalId },
      include: {
        sede: {
          select: {
            id: true,
            nombre: true,
            direccion: true,
            telefono: true,
            latitud: true,
            longitud: true,
            provincia: true,
            horario: true,
            diasCerrado: true,
            imagenes: true,
            HorarioSede: {
              select: {
                id: true,
                diaSemana: true,
                horaApertura: true,
                horaCierre: true,
                activo: true,
              },
            },
            DiaCerradoSede: {
              select: {
                id: true,
                fecha: true,
                motivo: true,
                todoElDia: true,
                horaInicio: true,
                horaFin: true,
              },
            },
          },
        },
        serviceSedeProfesional: {
          include: {
            service: {
              include: {
                translations: {
                  where: { language },
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    language: true,
                  },
                },
                prices: true,
                category: {
                  include: {
                    translations: {
                      where: { language },
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!profesional) {
      throw new NotFoundException(
        `Profesional con ID ${profesionalId} no encontrado.`,
      );
    }

    const sedeImagenesUrls = (profesional.sede?.imagenes ?? []).map((img) =>
      baseUrl ? `${baseUrl}/${img}` : img,
    );

    this.logger.log(
      `[findProfesionalConServiciosYSede] sedeId=${profesional.sedeId} sedeImagenes=${JSON.stringify(
        profesional.sede?.imagenes ?? null,
      )}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `[findProfesionalConServiciosYSede] sedeId=${profesional.sedeId} sedeImagenes=${JSON.stringify(
        profesional.sede?.imagenes ?? null,
      )}`,
    );

    const servicios = profesional.serviceSedeProfesional
      .filter((ssp) => ssp.service)
      .map((ssp) => ({
        id: ssp.service.id,
        nombre: ssp.service.translations[0]?.name ?? 'Sin nombre',
        descripcion: ssp.service.translations[0]?.description ?? '',
        categoria:
          ssp.service.category?.translations?.[0]?.name ?? 'Sin categoría',
        precios: ssp.service.prices.map((p) => ({
          id: p.id,
          amount: p.amount,
          duration: p.duration,
          currency: p.currency,
        })),
      }));

    return {
      id: profesional.id,
      nombre: profesional.nombre,
      biografia: profesional.biografia,
      imagen: profesional.imagen
        ? baseUrl
          ? `${baseUrl}/${profesional.imagen}`
          : profesional.imagen
        : null,
      telefono: profesional.phone,
      state: profesional.state,
      sedeId: profesional.sedeId,
      sede: profesional.sede
        ? {
            id: profesional.sede.id,
            nombre: profesional.sede.nombre,
            direccion: profesional.sede.direccion,
            telefono: profesional.sede.telefono,
            latitud: profesional.sede.latitud,
            longitud: profesional.sede.longitud,
            provincia: profesional.sede.provincia,
            horario: profesional.sede.horario,
            diasCerrado: profesional.sede.diasCerrado,
            imagenes: sedeImagenesUrls,
            horarioSemanal:
              profesional.sede.HorarioSede?.map((registro) => ({
                id: registro.id,
                diaSemana: registro.diaSemana,
                horaApertura: registro.horaApertura,
                horaCierre: registro.horaCierre,
                activo: registro.activo,
              })) ?? [],
            cierresProgramados:
              profesional.sede.DiaCerradoSede?.map((cierre) => ({
                id: cierre.id,
                fecha: cierre.fecha,
                motivo: cierre.motivo,
                todoElDia: cierre.todoElDia,
                horaInicio: cierre.horaInicio,
                horaFin: cierre.horaFin,
              })) ?? [],
          }
        : null,
      servicios,
    };
  }

  async update(
    id: number,
    updateProfesionalDto: UpdateProfesionalDto,
    user?: AuthenticatedUser,
  ) {
    await this.accessControlService.ensureProfessionalAccessForUser(id, user);
    if (
      updateProfesionalDto.sedeId &&
      user &&
      user.role !== Role.SUPER_ADMIN &&
      user.role !== Role.COMPANY_ADMIN
    ) {
      throw new ForbiddenException('No puede cambiar la sede asignada.');
    }

    const profesional = await this.prisma.profesional.findUnique({
      where: { id },
    });
    if (!profesional) {
      throw new NotFoundException(`Profesional con ID ${id} no encontrado.`);
    }

    return this.prisma.profesional.update({
      where: { id },
      data: updateProfesionalDto,
    });
  }

  async updateImage(
    id: number,
    user: AuthenticatedUser | undefined,
    file: Express.Multer.File,
  ) {
    await this.accessControlService.ensureProfessionalAccessForUser(id, user);
    const profesional = await this.prisma.profesional.findUnique({
      where: { id },
    });

    if (!profesional) {
      await this.safeDeleteRemoteOrLocal(file.path);
      throw new NotFoundException(`Profesional con ID ${id} no encontrado.`);
    }

    const newImagenPath = await this.storeProfesionalImage(file);

    try {
      // 1. Eliminar la imagen antigua si existe
      if (profesional.imagen) {
        await this.safeDeleteRemoteOrLocal(profesional.imagen);
      }

      // 2. Actualizar la ruta de la imagen en la base de datos
      return await this.prisma.profesional.update({
        where: { id },
        data: {
          imagen: newImagenPath,
        },
      });
    } catch (error) {
      await this.safeDeleteRemoteOrLocal(newImagenPath);
      throw error;
    }
  }

  async remove(id: number, user?: AuthenticatedUser) {
    await this.accessControlService.ensureProfessionalAccessForUser(id, user);
    const profesional = await this.prisma.profesional.findUnique({
      where: { id },
    });
    if (!profesional) {
      throw new NotFoundException(`Profesional con ID ${id} no encontrado.`);
    }

    if (profesional.imagen) {
      await this.safeDeleteRemoteOrLocal(profesional.imagen);
    }
    return this.prisma.profesional.delete({ where: { id } });
  }

  // 📦 Servicio para obtener los profesionales con sus servicios asociados por sede
  async findProfesionalesPorSede(sedeId: number, language: string = 'es') {
    const baseUrl =
      this.configService.get<string>('UPLOADS_PUBLIC_BASE_URL') ?? '';

    const profesionales = await this.prisma.profesional.findMany({
      where: { sedeId },
      include: {
        sede: true,
        serviceSedeProfesional: {
          include: {
            service: {
              include: {
                translations: {
                  where: { language },
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    language: true,
                  },
                },
                prices: true,
                category: {
                  include: {
                    translations: {
                      where: { language },
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!profesionales.length) {
      throw new NotFoundException(
        `No hay profesionales registrados en esta sede`,
      );
    }

    // 🧩 Transformación a una respuesta limpia y legible
    return profesionales.map((prof) => {
      // Obtener la imagen de la sede
      const sedeImagen = prof.sede?.imagenes?.[0]
        ? `${baseUrl}/${prof.sede.imagenes[0]}`
        : null;

      const servicios = prof.serviceSedeProfesional
        .filter((ssp) => ssp.service) // ✅ evita incluir relaciones vacías
        .map((ssp) => ({
          id: ssp.service.id,
          nombre: ssp.service.translations[0]?.name ?? 'Sin nombre',
          descripcion: ssp.service.translations[0]?.description ?? '',
          categoria:
            ssp.service.category?.translations?.[0]?.name ?? 'Sin categoría',
          imagen: sedeImagen,
          precios: ssp.service.prices.map((p) => ({
            id: p.id,
            amount: p.amount,
            duration: p.duration,
            currency: p.currency,
          })),
        }));

      return {
        id: prof.id,
        nombre: prof.nombre,
        biografia: prof.biografia,
        imagen: prof.imagen ? `${baseUrl}/${prof.imagen}` : null,
        telefono: prof.phone,
        state: prof.state,
        sedeId: prof.sedeId,
        servicios,
      };
    });
  }

  async findServiciosFuturosPorProfesional(
    profesionalId: number,
    language: string = 'es',
  ) {
    const profesional = await this.prisma.profesional.findUnique({
      where: { id: profesionalId },
    });

    if (!profesional) {
      throw new NotFoundException(
        `Profesional con ID ${profesionalId} no encontrado.`,
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        profesionalId,
        fecha: { gte: today },
        estado: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
      },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
      include: {
        service: {
          include: {
            translations: {
              where: { language },
              select: {
                id: true,
                name: true,
                description: true,
                language: true,
              },
            },
            prices: {
              select: {
                id: true,
                amount: true,
                duration: true,
                currency: true,
              },
            },
            category: {
              include: {
                translations: {
                  where: { language },
                  select: { name: true },
                },
              },
            },
          },
        },
        sede: {
          select: {
            id: true,
            nombre: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            UserData: {
              select: {
                name: true,
                phone: true,
              },
            },
          },
        },
        profesional: {
          select: {
            id: true,
            nombre: true,
            phone: true,
            imagen: true,
          },
        },
        Payment: true,
      },
    });

    return appointments.map((appointment) => {
      const service = appointment.service;
      const serviceTranslation = service?.translations?.[0];
      const categoryName =
        service?.category?.translations?.[0]?.name ?? 'Sin categoría';

      return {
        appointmentId: appointment.id,
        fecha: appointment.fecha.toISOString(),
        horaInicio: appointment.horaInicio.toISOString(),
        horaFin: appointment.horaFin.toISOString(),
        estado: appointment.estado,
        service: service
          ? {
              id: service.id,
              nombre: serviceTranslation?.name ?? 'Sin nombre',
              descripcion: serviceTranslation?.description ?? '',
              categoria: categoryName,
              precios: service.prices.map((price) => ({
                id: price.id,
                amount: price.amount,
                duration: price.duration,
                currency: price.currency,
              })),
            }
          : null,
        sede: appointment.sede,
        profesional: appointment.profesional
          ? {
              id: appointment.profesional.id,
              nombre: appointment.profesional.nombre,
              telefono: appointment.profesional.phone,
              imagen: appointment.profesional.imagen,
            }
          : null,
        user: appointment.user
          ? {
              id: appointment.user.id,
              email: appointment.user.email,
              nombre: appointment.user.UserData?.name ?? null,
              telefono: appointment.user.UserData?.phone ?? null,
            }
          : null,
        payment: appointment.Payment
          ? {
              id: appointment.Payment.id,
              method: appointment.Payment.method,
              totalAmount: appointment.Payment.totalAmount,
              paidAmount: appointment.Payment.paidAmount,
              status: appointment.Payment.status,
            }
          : null,
      };
    });
  }
}
