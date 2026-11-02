import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../types/authenticated-user.interface';

/**
 * Para rutas `/:id` de una empresa: el SUPER_ADMIN, o un admin de esa misma
 * empresa. Antes PATCH /empresas/:id y /:id/logo dejaban a cualquier sesión
 * cambiar el nombre, el NIT o el logo de otro negocio.
 */
@Injectable()
export class EmpresaAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    const empresaId = Number(request.params?.id ?? request.params?.empresaId);

    if (!Number.isInteger(empresaId)) {
      throw new BadRequestException('Id de empresa inválido.');
    }
    if (user?.role === Role.SUPER_ADMIN) return true;
    if (user?.empresaId === empresaId) return true;

    throw new ForbiddenException('No puede gestionar otra empresa.');
  }
}
