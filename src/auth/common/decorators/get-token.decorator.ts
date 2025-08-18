// src/common/decorators/get-token.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetToken = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Retorna solo el token (sin el prefijo "Bearer ")
      return authHeader.split(' ')[1];
    }
    // Si no hay token o no tiene el formato Bearer, retorna undefined
    return undefined;
  },
);
