import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EmpresaService } from '../data/empresa/empresa.service';
import { OtpModule } from '../data/otp/otp.module';
import { SedeService } from '../data/sede/sede.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminManagementController } from './controllers/admin-management.controller';
import { ClientManagementController } from './controllers/client-management.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AccessControlService } from './services/access-control/access-control.service';
import { AdminManagementService } from './services/admin-management/admin-management.service';
import { ClientManagementService } from './services/client-management/client-management.service';
import { HashService } from './services/hash/hash.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    OtpModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        name: 'jwt',
        secret: configService.get<string>('JWT_SECRET_KEY'),
        signOptions: { expiresIn: '12h' },
      }),
    }),
    PrismaModule,
  ],
  controllers: [
    AuthController,
    AdminManagementController,
    ClientManagementController,
  ],
  providers: [
    JwtStrategy,
    AuthService,
    HashService,
    AccessControlService,
    AdminManagementService,
    ClientManagementService,
    JwtAuthGuard,
    RolesGuard,
    EmpresaService,
    SedeService,
  ],
})
export class AuthModule {}
