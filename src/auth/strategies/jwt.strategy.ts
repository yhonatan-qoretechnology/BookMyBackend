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
      secretOrKey: configService.get<string>('JWT_SECRET_KEY'),
    });
  }

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
      },
    });

    if (!user) throw new UnauthorizedException('Invalid token');

    return {
      userId: user.id,
      email: user.email,
      role: payload.role,
      empresaId: payload.empresaId ?? null,
      sedeId: payload.sedeId ?? null,
      profesionalId: payload.profesionalId ?? null,
    };
  }
}
