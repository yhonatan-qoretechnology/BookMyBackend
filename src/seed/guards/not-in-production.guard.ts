import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Ningún endpoint de /seed debería poder llamarse en producción — son
 * herramientas de desarrollo (crean/resetean datos, y algunas hasta
 * usuarios admin con contraseña fija hardcodeada en el código fuente).
 *
 * Antes no tenían ningún guard: alguien llamó a /seed/seedSedes,
 * /seed/branch-admin y /seed/company-admin directo contra producción
 * (probablemente desde el propio Swagger) y creó sedes duplicadas +
 * usuarios BRANCH_ADMIN/COMPANY_ADMIN reales con credenciales públicas.
 *
 * A propósito NO se basa en `NODE_ENV === 'production'` (como sí hace
 * AuthService.bootstrapSuperAdmin): nada en este repo setea NODE_ENV en
 * el arranque de prod (`start:prod` es solo `node dist/src/main.js`), así
 * que confiar en eso depende de que el hosting lo esté seteando bien, y
 * eso no se puede verificar desde el código. Acá es al revés: bloqueado
 * SIEMPRE por defecto, salvo que se habilite a propósito con una var de
 * entorno explícita en el `.env` local.
 */
@Injectable()
export class NotInProductionGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (process.env.ALLOW_SEED !== 'true') {
      throw new ForbiddenException(
        'Los endpoints de /seed están deshabilitados. Para usarlos en desarrollo, ' +
          'agregá ALLOW_SEED=true a tu .env local.',
      );
    }
    return true;
  }
}
