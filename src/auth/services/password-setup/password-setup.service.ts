import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { HashService } from '../hash/hash.service';

/** Un alta puede tardar en abrirse: el empleado quiza no mire el correo hasta el lunes. */
const HORAS_VALIDEZ = 72;

/**
 * Enlace de un solo uso para que el empleado fije su propia contrasena.
 *
 * En la base se guarda SOLO el hash del token: si alguien leyera la tabla no
 * podria reconstruir los enlaces vigentes. El token en claro existe unicamente
 * dentro del correo.
 */
@Injectable()
export class PasswordSetupService {
  private readonly logger = new Logger(PasswordSetupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hashService: HashService,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Genera un token nuevo e invalida los anteriores del mismo usuario. */
  async createForUserAuth(userAuthId: number) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + HORAS_VALIDEZ * 60 * 60 * 1000);

    /* Un alta reenviada deja el enlace anterior inservible. */
    await this.prisma.passwordSetupToken.updateMany({
      where: { userAuthId, usedAt: null },
      data: { usedAt: new Date() },
    });

    await this.prisma.passwordSetupToken.create({
      data: { userAuthId, tokenHash: this.hash(token), expiresAt },
    });

    return { token, expiresAt };
  }

  /** Comprueba que el enlace sigue sirviendo, sin gastarlo. */
  async validate(token: string) {
    const registro = await this.prisma.passwordSetupToken.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { userAuth: true },
    });

    if (!registro || registro.usedAt || registro.expiresAt < new Date()) {
      throw new BadRequestException(
        'El enlace no es valido o ya ha caducado. Pide uno nuevo al administrador.',
      );
    }

    return { valido: true as const, email: registro.userAuth.email };
  }

  /**
   * Fija la contrasena y gasta el token.
   *
   * La comprobacion y el marcado van en una transaccion para que dos peticiones
   * simultaneas no puedan usar el mismo enlace dos veces.
   */
  async complete(token: string, password: string) {
    const tokenHash = this.hash(token);

    return this.prisma.$transaction(async (tx) => {
      const registro = await tx.passwordSetupToken.findUnique({
        where: { tokenHash },
      });

      if (!registro || registro.usedAt || registro.expiresAt < new Date()) {
        throw new BadRequestException(
          'El enlace no es valido o ya ha caducado. Pide uno nuevo al administrador.',
        );
      }

      const hashed = await this.hashService.hash(password);

      await tx.userAuth.update({
        where: { id: registro.userAuthId },
        data: {
          password: hashed,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
        },
      });

      await tx.passwordSetupToken.update({
        where: { id: registro.id },
        data: { usedAt: new Date() },
      });

      this.logger.log(`Contrasena fijada para userAuth ${registro.userAuthId}`);
      return { message: 'Contrasena establecida. Ya puedes iniciar sesion.' };
    });
  }
}
