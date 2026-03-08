import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, Prisma, Role } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProfesionalDto } from './dto/create-profesional.dto';
import { UpdateProfesionalDto } from './dto/update-profesional.dto';

@Injectable()
export class ProfesionalService {
  constructor(
    private prisma: PrismaService,
    private readonly accessControlService: AccessControlService,
  ) {}

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

  async create(
    createProfesionalDto: CreateProfesionalDto,
    user?: AuthenticatedUser,
    file?: Express.Multer.File,
  ) {
    // 1. Verificar si la sede existe
    const sede = await this.prisma.sede.findUnique({
      where: { id: createProfesionalDto.sedeId },
      select: { id: true, empresaId: true },
    });
    if (!sede) {
      if (file) {
        this.safeDeleteProfesionalFile(file.path);
      }
      throw new NotFoundException(
        `Sede con ID ${createProfesionalDto.sedeId} no encontrada.`,
      );
    }

    if (user?.role === Role.BRANCH_ADMIN) {
      if (!user.sedeId || user.sedeId !== sede.id) {
        if (file) {
          this.safeDeleteProfesionalFile(file.path);
        }
        throw new ForbiddenException(
          'No puede crear profesionales en otra sede.',
        );
      }
    }

    if (user?.role === Role.COMPANY_ADMIN) {
      if (!user.empresaId || user.empresaId !== sede.empresaId) {
        if (file) {
          this.safeDeleteProfesionalFile(file.path);
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
        imagenPath = this.moveProfesionalFileToFinalPath(file);
      }

      // 3. Crear el profesional en la base de datos
      const profesional = await this.prisma.profesional.create({
        data: {
          ...createProfesionalDto,
          imagen: imagenPath,
        },
      });

      return profesional;
    } catch (error) {
      // 4. Limpiar el archivo si algo falla
      if (file) {
        this.safeDeleteProfesionalFile(imagenPath || file.path);
      }
      // 5. Manejar errores de Prisma, por ejemplo, teléfono duplicado
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'El número de teléfono ya está en uso.',
          );
        }
      }
      throw error;
    }
  }

  async findAll() {
    return this.prisma.profesional.findMany();
  }

  async findOne(id: number) {
    const profesional = await this.prisma.profesional.findUnique({
      where: { id },
    });
    if (!profesional) {
      throw new NotFoundException(`Profesional con ID ${id} no encontrado.`);
    }
    return profesional;
  }

  async findProfesionalConServiciosYSede(
    profesionalId: number,
    language: string = 'es',
  ) {
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
      imagen: profesional.imagen,
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
      this.safeDeleteProfesionalFile(file.path);
      throw new NotFoundException(`Profesional con ID ${id} no encontrado.`);
    }

    const newImagenPath = this.moveProfesionalFileToFinalPath(file);

    try {
      // 1. Eliminar la imagen antigua si existe
      if (profesional.imagen) {
        this.safeDeleteProfesionalFile(profesional.imagen);
      }

      // 2. Actualizar la ruta de la imagen en la base de datos
      return await this.prisma.profesional.update({
        where: { id },
        data: {
          imagen: newImagenPath,
        },
      });
    } catch (error) {
      this.safeDeleteProfesionalFile(newImagenPath);
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
      this.safeDeleteProfesionalFile(profesional.imagen);
    }
    return this.prisma.profesional.delete({ where: { id } });
  }

  // 📦 Servicio para obtener los profesionales con sus servicios asociados por sede
  async findProfesionalesPorSede(sedeId: number, language: string = 'es') {
    const profesionales = await this.prisma.profesional.findMany({
      where: { sedeId },
      include: {
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
      const servicios = prof.serviceSedeProfesional
        .filter((ssp) => ssp.service) // ✅ evita incluir relaciones vacías
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
        id: prof.id,
        nombre: prof.nombre,
        biografia: prof.biografia,
        imagen: prof.imagen,
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
      };
    });
  }
}
