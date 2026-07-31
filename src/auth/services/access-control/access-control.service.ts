import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthenticatedUser } from '../../types/authenticated-user.interface';

@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  hasRequiredRole(requiredRoles: Role[], user?: AuthenticatedUser): boolean {
    if (requiredRoles.length === 0 || !user) {
      return true;
    }

    return requiredRoles.includes(user.role);
  }

  async ensureServiceAccessForUser(
    serviceId: number,
    user?: AuthenticatedUser,
  ) {
    if (!user) {
      return;
    }

    if (user.role === Role.SUPER_ADMIN) {
      return;
    }

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: { sedes: { select: { empresaId: true, id: true } } },
    });

    if (!service) {
      throw new ForbiddenException('Servicio no encontrado.');
    }

    const empresasRelacionadas = new Set(
      service.sedes.map((sede) => sede.empresaId),
    );

    if (user.role === Role.COMPANY_ADMIN) {
      if (!user.empresaId || !empresasRelacionadas.has(user.empresaId)) {
        throw new ForbiddenException(
          'No puede gestionar servicios fuera de su empresa.',
        );
      }
      return;
    }

    if (user.role === Role.BRANCH_ADMIN) {
      if (!user.sedeId) {
        throw new ForbiddenException(
          'No se encontró la sede asociada al administrador.',
        );
      }

      const sedeIds = service.sedes.map((sede) => sede.id);

      if (!sedeIds.includes(user.sedeId)) {
        throw new ForbiddenException(
          'No puede gestionar servicios fuera de su sede.',
        );
      }
    }
  }

  async ensureSedeAccessForUser(sedeId: number, user?: AuthenticatedUser) {
    if (!user) {
      return;
    }

    if (user.role === Role.SUPER_ADMIN) {
      return;
    }

    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
      select: { id: true, empresaId: true },
    });

    if (!sede) {
      throw new ForbiddenException('Sede no encontrada.');
    }

    if (user.role === Role.COMPANY_ADMIN) {
      if (!user.empresaId || user.empresaId !== sede.empresaId) {
        throw new ForbiddenException(
          'No puede gestionar sedes fuera de su empresa.',
        );
      }
      return;
    }

    if (user.role === Role.BRANCH_ADMIN) {
      if (user.sedeId !== sede.id) {
        throw new ForbiddenException('No puede gestionar otra sede.');
      }
    }
  }

  async ensureProfessionalAccessForUser(
    profesionalId: number,
    user?: AuthenticatedUser,
  ) {
    if (!user) {
      return;
    }

    if (user.role === Role.SUPER_ADMIN) {
      return;
    }

    const profesional = await this.prisma.profesional.findUnique({
      where: { id: profesionalId },
      select: {
        id: true,
        sedeId: true,
        sede: { select: { empresaId: true } },
      },
    });

    if (!profesional) {
      throw new ForbiddenException('Profesional no encontrado.');
    }

    if (user.role === Role.COMPANY_ADMIN) {
      if (
        !user.empresaId ||
        !profesional.sede?.empresaId ||
        profesional.sede.empresaId !== user.empresaId
      ) {
        throw new ForbiddenException(
          'No puede gestionar profesionales fuera de su empresa.',
        );
      }
      return;
    }

    if (user.role === Role.BRANCH_ADMIN) {
      if (!user.sedeId || profesional.sedeId !== user.sedeId) {
        throw new ForbiddenException(
          'No puede gestionar profesionales fuera de su sede.',
        );
      }
    }
  }

  /**
   * Ensure a user can access a chat conversation between userAId and userBId.
   *
   * Allowed:
   * - SUPER_ADMIN (always).
   * - Either participant of the conversation.
   * - A BRANCH_ADMIN/COMPANY_ADMIN whose sede/empresa matches at least one
   *   participant (via their Profesional or AdminProfile record).
   */
  async ensureChatAccessForUser(
    userAId: number,
    userBId: number,
    user: AuthenticatedUser,
  ) {
    if (user.role === Role.SUPER_ADMIN) {
      return;
    }

    if (user.userId === userAId || user.userId === userBId) {
      return;
    }

    if (user.role !== Role.BRANCH_ADMIN && user.role !== Role.COMPANY_ADMIN) {
      throw new ForbiddenException(
        'No tiene permisos para acceder a esta conversación.',
      );
    }

    const participants = await this.prisma.users.findMany({
      where: { id: { in: [userAId, userBId] } },
      select: {
        id: true,
        profesionales: {
          select: { sedeId: true, sede: { select: { empresaId: true } } },
        },
        AdminProfile: { select: { sedeId: true, empresaId: true } },
      },
    });

    const hasAccess = participants.some((participant) => {
      if (user.role === Role.BRANCH_ADMIN) {
        const sedeIds = [
          participant.profesionales?.sedeId,
          participant.AdminProfile?.sedeId,
        ].filter((id): id is number => id != null);

        return user.sedeId != null && sedeIds.includes(user.sedeId);
      }

      const empresaIds = [
        participant.profesionales?.sede?.empresaId,
        participant.AdminProfile?.empresaId,
      ].filter((id): id is number => id != null);

      return user.empresaId != null && empresaIds.includes(user.empresaId);
    });

    if (!hasAccess) {
      throw new ForbiddenException(
        'No tiene permisos para acceder a esta conversación.',
      );
    }
  }
}
