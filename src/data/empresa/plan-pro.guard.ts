import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanService } from './plan.service';

export const MODULO_PRO_KEY = 'moduloPro';

/**
 * Marca un controlador (o una ruta) como parte de Bookmy CRM Pro.
 * El texto es el que se le enseña al negocio si no lo tiene contratado.
 */
export const ModuloPro = (nombre: string) => SetMetadata(MODULO_PRO_KEY, nombre);

/**
 * Deja pasar solo a quien tenga Pro (contratado o de prueba).
 *
 * El panel ya oculta y bloquea estos módulos, pero eso es una cortesía
 * del navegador: sin este guard, cualquiera con una sesión de plan
 * gratuito podía llamar al API a mano y usarlos igual.
 */
@Injectable()
export class PlanProGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private planService: PlanService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const nombre =
      this.reflector.getAllAndOverride<string>(MODULO_PRO_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'Este módulo';

    const request = context.switchToHttp().getRequest();
    await this.planService.exigirPro(request.user, nombre);
    return true;
  }
}
