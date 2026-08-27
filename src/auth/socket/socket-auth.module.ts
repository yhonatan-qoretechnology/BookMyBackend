import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SocketAuthService } from './socket-auth.service';

/**
 * Módulo aparte (y no AuthModule) para que los gateways de chat y de
 * notificaciones puedan verificar el token sin arrastrar AuthService entero
 * ni crear una dependencia circular.
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET_KEY'),
      }),
    }),
  ],
  providers: [SocketAuthService],
  exports: [SocketAuthService],
})
export class SocketAuthModule {}
