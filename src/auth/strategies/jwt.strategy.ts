import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET_KEY'),
    });
  }

  async validate(payload: any) {
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

    return { userId: user.id, email: user.email };
  }
}
