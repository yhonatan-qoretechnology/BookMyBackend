import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClientListDto, UpdateClientDto } from '../../dto/client-management.dto';
import { AuthenticatedUser } from '../../types/authenticated-user.interface';
import { HashService } from '../hash/hash.service';

/** Relaciones necesarias para componer la respuesta de un cliente. */
const CLIENT_INCLUDE = {
  UserData: true,
  UserLocation: true,
} as const;

/**
 * Historial que impide borrar a un cliente de la base de datos.
 * Son registros contables o públicos que deben sobrevivir a la baja:
 * las citas y los pagos sostienen la facturación y las reseñas son
 * contenido publicado. Además ninguna de estas relaciones está en
 * cascada en el esquema, así que un `delete` directo reventaría por
 * clave foránea.
 */
const HISTORY_COUNT = {
  Appointment: true,
  payments: true,
  resenas: true,
  gastos: true,
} as const;

type ClientWithRelations = Prisma.UsersGetPayload<{
  include: typeof CLIENT_INCLUDE;
}>;

@Injectable()
export class ClientManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashService: HashService,
  ) {}

  /**
   * Forma única de la respuesta de cliente. Antes estaba repetida en
   * los cuatro métodos, lo que hizo que `fotoPerfil` faltara en todos
   * y el panel no pudiera mostrar el avatar del cliente.
   */
  private toClientResponse(client: ClientWithRelations) {
    return {
      id: client.id,
      email: client.email,
      state: client.state,
      createdAt: client.createdAt,
      /** Avatar del cliente; el panel lo resuelve con fotoUrl() */
      fotoPerfil: client.fotoPerfil,
      userData: client.UserData
        ? {
            name: client.UserData.name,
            phone: client.UserData.phone,
            idioma: client.UserData.idioma,
            gender: client.UserData.gender,
            birthdate: client.UserData.birthdate,
            /** Vive en `user_data`, no en `user_locations` */
            direccion: client.UserData.direccion,
            countryId: client.UserData.countryId,
          }
        : null,
      userLocation: client.UserLocation
        ? {
            address: client.UserLocation.address,
            latitude: client.UserLocation.latitude,
            longitude: client.UserLocation.longitude,
          }
        : null,
    };
  }

  async searchClient(email: string) {
    // Buscar por email
    const client = await this.prisma.users.findFirst({
      where: {
        email: email.toLowerCase(),
        role: Role.CLIENT,
      },
      include: CLIENT_INCLUDE,
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado con el email proporcionado');
    }

    return this.toClientResponse(client);
  }

  async listClients(filters: ClientListDto, user: AuthenticatedUser) {
    const { email, id, name, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    // Construir where clause
    const whereClause: any = {
      role: Role.CLIENT,
    };

    // Filtros
    if (email) {
      whereClause.email = {
        contains: email.toLowerCase(),
        mode: 'insensitive'
      };
    }

    if (id) {
      whereClause.id = id;
    }

    if (name) {
      whereClause.UserData = {
        name: {
          contains: name,
          mode: 'insensitive'
        }
      };
    }

    // Según el rol, filtrar por empresa/sede si es necesario
    if (user.role === Role.COMPANY_ADMIN && user.empresaId) {
      // COMPANY_ADMIN puede ver todos los clientes de su empresa
      // Aquí podrías agregar lógica adicional si los clientes están asociados a empresas
    } else if (user.role === Role.BRANCH_ADMIN && user.sedeId) {
      // BRANCH_ADMIN puede ver clientes de su sede
      // Aquí podrías agregar lógica adicional si los clientes están asociados a sedes
    }
    // SUPER_ADMIN puede ver todos los clientes

    const [clients, total] = await Promise.all([
      this.prisma.users.findMany({
        where: whereClause,
        include: CLIENT_INCLUDE,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.users.count({ where: whereClause })
    ]);

    return {
      clients: clients.map((client) => this.toClientResponse(client)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      }
    };
  }

  async getClientById(id: number) {
    const client = await this.findClientOr404(id);

    /* El historial acompaña a la ficha para que el panel pueda
       avisar de qué se conservará antes de dar de baja la cuenta. */
    return {
      ...this.toClientResponse(client),
      historial: await this.countHistory(id),
    };
  }

  async updateClient(id: number, updateClientDto: UpdateClientDto, user: AuthenticatedUser) {
    const existingClient = await this.findClientOr404(id);
    this.validateClientAccess(user, existingClient);

    if (!existingClient.UserData) {
      throw new BadRequestException(
        `El cliente con ID ${id} no tiene ficha de datos personales.`,
      );
    }

    const email = updateClientDto.email?.trim().toLowerCase();
    await this.ensureEmailIsFree(email, id);

    /**
     * `countryId` vive en `user_data`, no en `user_locations`: esa
     * tabla solo guarda coordenadas y dirección. Antes se intentaba
     * conectar ahí una relación inexistente, así que cualquier
     * petición que enviara el país fallaba con un 400 genérico.
     */
    const userDataUpdate: Prisma.UserDataUpdateInput = {};
    if (updateClientDto.name !== undefined) userDataUpdate.name = updateClientDto.name;
    if (updateClientDto.phone !== undefined) userDataUpdate.phone = updateClientDto.phone;
    if (updateClientDto.idioma !== undefined) userDataUpdate.idioma = updateClientDto.idioma;
    if (updateClientDto.gender !== undefined) userDataUpdate.gender = updateClientDto.gender;
    if (updateClientDto.direccion !== undefined) userDataUpdate.direccion = updateClientDto.direccion;
    if (updateClientDto.countryId !== undefined) {
      userDataUpdate.country = { connect: { id: updateClientDto.countryId } };
    }
    if (updateClientDto.birthdate !== undefined) {
      userDataUpdate.birthdate = updateClientDto.birthdate
        ? new Date(updateClientDto.birthdate)
        : null;
    }
    if (email) userDataUpdate.email = email;

    const usersUpdate: Prisma.UsersUpdateInput = {};
    if (updateClientDto.state !== undefined) usersUpdate.state = updateClientDto.state;
    if (email) usersUpdate.email = email;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (Object.keys(userDataUpdate).length > 0) {
          await tx.userData.update({ where: { userId: id }, data: userDataUpdate });
        }

        if (Object.keys(usersUpdate).length > 0) {
          await tx.users.update({ where: { id }, data: usersUpdate });
        }

        /* user_auth guarda su propia copia del correo y es la que
           consulta el login: si no se sincroniza, cambiar el email
           deja al cliente sin poder entrar. */
        if (email) {
          await tx.userAuth.updateMany({
            where: { user_id: id },
            data: { email },
          });
        }
      });
    } catch (error) {
      throw this.toReadableError(error, 'actualizar los datos del cliente');
    }

    return this.getClientById(id);
  }

  /**
   * Fija una contraseña nueva sin pedir la anterior: la establece un
   * administrador, que por definición no la conoce.
   */
  async changeClientPassword(id: number, password: string, user: AuthenticatedUser) {
    const client = await this.findClientOr404(id);
    this.validateClientAccess(user, client);

    const hashed = await this.hashService.hash(password);

    /* Los clientes dados de alta por vías que no crean `user_auth`
       no tienen fila que actualizar; el upsert la crea en ese caso
       para que el cambio de contraseña nunca falle en silencio. */
    await this.prisma.userAuth.upsert({
      where: { user_id: id },
      update: { password: hashed },
      create: { user_id: id, email: client.email, password: hashed },
    });

    return { message: 'Contraseña actualizada correctamente.' };
  }

  /**
   * Da de baja la cuenta de un cliente.
   *
   * Si nunca reservó ni pagó nada, se borra de verdad. Si tiene
   * historial, se anonimiza y se deja sin acceso: las citas, los
   * pagos y las reseñas se conservan porque son la base de la
   * facturación y borrarlos descuadraría las cuentas. En ambos casos
   * el cliente deja de poder iniciar sesión y sus datos personales
   * desaparecen.
   */
  async deleteClient(id: number, user: AuthenticatedUser) {
    const client = await this.findClientOr404(id);
    this.validateClientAccess(user, client);

    const historial = await this.countHistory(id);
    const conservaHistorial = Object.values(historial).some((n) => n > 0);

    if (!conservaHistorial) {
      await this.prisma.$transaction(async (tx) => {
        await tx.paymentCard.deleteMany({ where: { userId: id } });
        await tx.userCategory.deleteMany({ where: { userId: id } });
        await tx.userLocation.deleteMany({ where: { userId: id } });
        await tx.userAuth.deleteMany({ where: { user_id: id } });
        await tx.userData.deleteMany({ where: { userId: id } });
        await tx.users.delete({ where: { id } });
      });

      return {
        message: 'Cliente eliminado definitivamente.',
        mode: 'deleted' as const,
        historial,
      };
    }

    /* Marcas únicas: `users.email`, `user_data.email` y
       `user_data.phone` tienen índice único, así que el valor
       anonimizado tiene que seguir siendo distinto entre clientes.
       El teléfono además está limitado a 20 caracteres. */
    const emailAnonimo = `eliminado+${id}@bookmy.local`;
    const telefonoAnonimo = `eliminado-${id}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentCard.deleteMany({ where: { userId: id } });
      await tx.userLocation.deleteMany({ where: { userId: id } });
      await tx.userAuth.deleteMany({ where: { user_id: id } });

      await tx.userData.updateMany({
        where: { userId: id },
        data: {
          name: 'Cliente eliminado',
          email: emailAnonimo,
          phone: telefonoAnonimo,
          direccion: null,
          birthdate: null,
        },
      });

      await tx.users.update({
        where: { id },
        data: {
          email: emailAnonimo,
          fotoPerfil: null,
          state: 'disabled',
        },
      });
    });

    return {
      message:
        'Cuenta dada de baja y datos personales anonimizados. Se conserva el historial de citas y pagos por requisitos de facturación.',
      mode: 'anonymized' as const,
      historial,
    };
  }

  /** Registros que atan al cliente y que no se pueden borrar. */
  private async countHistory(id: number) {
    const conteo = await this.prisma.users.findUnique({
      where: { id },
      select: { _count: { select: HISTORY_COUNT } },
    });

    return {
      citas: conteo?._count.Appointment ?? 0,
      pagos: conteo?._count.payments ?? 0,
      resenas: conteo?._count.resenas ?? 0,
      gastos: conteo?._count.gastos ?? 0,
    };
  }

  private async findClientOr404(id: number): Promise<ClientWithRelations> {
    const client = await this.prisma.users.findFirst({
      where: { id, role: Role.CLIENT },
      include: CLIENT_INCLUDE,
    });

    if (!client) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    return client;
  }

  /** Se comprueba antes de escribir para dar un mensaje concreto. */
  private async ensureEmailIsFree(email: string | undefined, id: number) {
    if (!email) return;

    const enUso = await this.prisma.users.findFirst({
      where: { email, id: { not: id } },
      select: { id: true },
    });

    if (enUso) {
      throw new BadRequestException(
        `El correo ${email} ya está en uso por otra cuenta.`,
      );
    }
  }

  /**
   * Traduce los choques de índice único de Prisma. Antes cualquier
   * fallo acababa en el mismo 400 genérico y no se sabía qué campo
   * estaba repetido.
   */
  private toReadableError(error: unknown, accion: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const campos = (error.meta?.target as string[] | undefined) ?? [];
      const etiquetas: Record<string, string> = {
        phone: 'teléfono',
        email: 'correo',
      };
      const campo = campos.map((c) => etiquetas[c] ?? c).join(', ');
      return new BadRequestException(
        campo
          ? `Ya existe otra cuenta con ese ${campo}.`
          : 'Ya existe otra cuenta con esos datos.',
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return new BadRequestException(
        'Alguno de los datos referenciados no existe (revisa el país).',
      );
    }

    return new BadRequestException(`Error al ${accion}.`);
  }

  private validateClientAccess(user: AuthenticatedUser, client: any): void {
    // SUPER_ADMIN puede acceder a todos los clientes
    if (user.role === Role.SUPER_ADMIN) {
      return;
    }

    // COMPANY_ADMIN y BRANCH_ADMIN pueden acceder a clientes
    // Aquí podrías agregar validaciones adicionales según tu lógica de negocio
    // Por ahora, permitimos acceso a todos los clientes para estos roles
    if (user.role === Role.COMPANY_ADMIN || user.role === Role.BRANCH_ADMIN) {
      return;
    }

    throw new ForbiddenException('No tienes permisos para acceder a este cliente');
  }
}
