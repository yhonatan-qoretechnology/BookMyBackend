import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: { message?: string } | undefined) {
    if (info?.message === 'No auth token') {
      throw new UnauthorizedException('Token not found');
    }

    if (info?.message === 'invalid token') {
      throw new UnauthorizedException('Invalid token');
    }

    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return user;
  }
}
