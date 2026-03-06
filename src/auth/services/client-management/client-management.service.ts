import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClientListDto, UpdateClientDto } from '../../dto/client-management.dto';
import { AuthenticatedUser } from '../../types/authenticated-user.interface';

@Injectable()
export class ClientManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async searchClient(email: string) {
    // Buscar por email
    const client = await this.prisma.users.findFirst({
      where: {
        email: email.toLowerCase(),
        role: Role.CLIENT,
      },
      include: {
        UserData: true,
        UserLocation: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado con el email proporcionado');
    }

    // Formatear respuesta
    return {
      id: client.id,
      email: client.email,
      state: client.state,
      createdAt: client.createdAt,
      userData: client.UserData ? {
        name: client.UserData.name,
        phone: client.UserData.phone,
        idioma: client.UserData.idioma,
        gender: client.UserData.gender,
        birthdate: client.UserData.birthdate,
      } : null,
      userLocation: client.UserLocation ? {
        address: client.UserLocation.address,
        latitude: client.UserLocation.latitude,
        longitude: client.UserLocation.longitude,
      } : null,
    };
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
        include: {
          UserData: true,
          UserLocation: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.users.count({ where: whereClause })
    ]);

    return {
      clients: clients.map(client => ({
        id: client.id,
        email: client.email,
        state: client.state,
        createdAt: client.createdAt,
        userData: client.UserData ? {
          name: client.UserData.name,
          phone: client.UserData.phone,
          idioma: client.UserData.idioma,
          gender: client.UserData.gender,
          birthdate: client.UserData.birthdate,
        } : null,
        userLocation: client.UserLocation ? {
          address: client.UserLocation.address,
          latitude: client.UserLocation.latitude,
          longitude: client.UserLocation.longitude,
        } : null,
      })),
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
    const client = await this.prisma.users.findFirst({
      where: {
        id,
        role: Role.CLIENT,
      },
      include: {
        UserData: true,
        UserLocation: true,
      },
    });

    if (!client) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    return {
      id: client.id,
      email: client.email,
      state: client.state,
      createdAt: client.createdAt,
      userData: client.UserData ? {
        name: client.UserData.name,
        phone: client.UserData.phone,
        idioma: client.UserData.idioma,
        gender: client.UserData.gender,
        birthdate: client.UserData.birthdate,
      } : null,
      userLocation: client.UserLocation ? {
        address: client.UserLocation.address,
        latitude: client.UserLocation.latitude,
        longitude: client.UserLocation.longitude,
      } : null,
    };
  }

  async updateClient(id: number, updateClientDto: UpdateClientDto, user: AuthenticatedUser) {
    // Verificar que el cliente existe
    const existingClient = await this.prisma.users.findFirst({
      where: {
        id,
        role: Role.CLIENT,
      },
      include: {
        UserData: true,
        UserLocation: true,
      },
    });

    if (!existingClient) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    // Validar permisos según el rol
    this.validateClientAccess(user, existingClient);

    const userDataUpdate: any = {};
    const userLocationUpdate: any = {};

    // Preparar datos para actualizar UserData
    if (updateClientDto.name !== undefined) userDataUpdate.name = updateClientDto.name;
    if (updateClientDto.phone !== undefined) userDataUpdate.phone = updateClientDto.phone;
    if (updateClientDto.idioma !== undefined) userDataUpdate.idioma = updateClientDto.idioma;
    if (updateClientDto.gender !== undefined) userDataUpdate.gender = updateClientDto.gender;
    if (updateClientDto.birthdate !== undefined) {
      userDataUpdate.birthdate = updateClientDto.birthdate ? new Date(updateClientDto.birthdate) : null;
    }

    // Preparar datos para actualizar UserLocation
    if (updateClientDto.countryId !== undefined) {
      userLocationUpdate.country = { connect: { id: updateClientDto.countryId } };
    }

    try {
      // Actualizar UserData si hay cambios
      if (Object.keys(userDataUpdate).length > 0) {
        await this.prisma.userData.update({
          where: { userId: id },
          data: userDataUpdate,
        });
      }

      // Actualizar UserLocation si hay cambios
      if (Object.keys(userLocationUpdate).length > 0) {
        if (existingClient.UserLocation) {
          await this.prisma.userLocation.update({
            where: { userId: id },
            data: userLocationUpdate,
          });
        } else {
          await this.prisma.userLocation.create({
            data: {
              userId: id,
              ...userLocationUpdate,
            },
          });
        }
      }

      // Devolver cliente actualizado
      return this.getClientById(id);
    } catch (error) {
      throw new BadRequestException('Error al actualizar los datos del cliente');
    }
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
