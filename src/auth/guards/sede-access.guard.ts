import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AccessControlService } from '../services/access-control/access-control.service';
import { AuthenticatedUser } from '../types/authenticated-user.interface';

/**
 * Para rutas `/:id` (o `/:sedeId`) que modifican una sede: el usuario tiene
 * que administrarla. Va detrás de los guards globales (JWT y roles), así que
 * `req.user` ya está; la regla es la de `ensureSedeAccessForUser`.
 *
 * Existe porque el controller de sedes no comprobaba nada: cualquier sesión,
 * incluida la de un cliente, editaba o borraba la sede de otro negocio.
 */
@Injectable()
export class SedeAccessGuard implements CanActivate {
  constructor(private readonly accessControlService: AccessControlService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sedeId = Number(request.params?.id ?? request.params?.sedeId);
    if (!Number.isInteger(sedeId)) {
      throw new BadRequestException('Id de sede inválido.');
    }

    await this.accessControlService.ensureSedeAccessForUser(
      sedeId,
      request.user as AuthenticatedUser | undefined,
    );
    return true;
  }
}
