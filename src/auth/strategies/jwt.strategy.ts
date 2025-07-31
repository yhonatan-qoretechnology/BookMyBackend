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

    const user = await this.prisma.userAuth.findUnique({
      where: {
        id: payload.id,
      },
    });

    if (!user) throw new UnauthorizedException('Invalid token');

    return { userId: payload.id, email: payload.email };
  }
}
