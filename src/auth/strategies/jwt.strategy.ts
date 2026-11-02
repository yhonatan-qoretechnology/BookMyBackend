import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthenticatedUser } from '../types/authenticated-user.interface';

const cookieJwtExtractor = (req: any): string | null => {
  if (!req) return null;
  return req.cookies?.access_token ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      /*
       * El Bearer manda sobre la cookie, y no al contrario.
       *
       * Hasta ahora el panel y la API vivian en dominios registrables
       * distintos, asi que la cookie `access_token` (SameSite=Lax) no viajaba
       * nunca y este orden daba igual. Con bookmy.es y api.bookmy.es pasan a
       * ser el MISMO sitio: la cookie acompana a todas las peticiones y, si se
       * leyera primero, ganaria al token que el panel manda en la cabecera.
       * Abrir una segunda cuenta en otra pestana haria que la primera actuase
       * en silencio como la segunda, con sus clientes y sus citas delante. La
       * cookie se queda como respaldo, para quien no manda cabecera.
       */
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieJwtExtractor,
      ]),
      ignoreExpiration: false,
      // Solo el algoritmo con el que firmamos: nada de "none" ni de cambios.
      algorithms: ['HS256'],
      secretOrKey: configService.get<string>('JWT_SECRET_KEY'),
    });
  }

  /*
   * Rol, empresa, sede y estado salen de la BD, no del token. Antes se
   * confiaba en lo que traía el payload: un usuario deshabilitado, degradado
   * o de una empresa bloqueada seguía entrando hasta que caducase su token
   * (1 día), y quien tuviera la clave de firma elegía su propio rol.
   */
  async validate(payload: any): Promise<AuthenticatedUser> {
    if (!payload || isNaN(payload.id))
      throw new UnauthorizedException('Invalid token');

    // En el token estamos guardando el id de Users (ver AuthService.generateToken),
    // por lo que debemos validar contra la tabla Users y no contra userAuth.
    const user = await this.prisma.users.findUnique({
      where: {
        id: payload.id,
      },
      select: {
        id: true,
        email: true,
        role: true,
        state: true,
        AdminProfile: {
          select: {
            empresaId: true,
            sedeId: true,
            empresa: { select: { bloqueada: true } },
          },
        },
        profesionales: {
          select: {
            id: true,
            sedeId: true,
            sede: {
              select: { empresaId: true, empresa: { select: { bloqueada: true } } },
            },
          },
        },
      },
    });

    if (!user || user.state !== 'enabled')
      throw new UnauthorizedException('Invalid token');

    const admin = user.AdminProfile;
    const profesional = user.profesionales;
    if (admin?.empresa?.bloqueada || profesional?.sede?.empresa?.bloqueada)
      throw new UnauthorizedException('Empresa bloqueada');

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      empresaId: admin?.empresaId ?? profesional?.sede?.empresaId ?? null,
      sedeId: admin?.sedeId ?? profesional?.sedeId ?? null,
      profesionalId: profesional?.id ?? null,
    };
  }
}
