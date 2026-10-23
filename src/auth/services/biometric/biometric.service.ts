import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AuthService,
  LOGIN_USER_SELECT,
  LoginContexto,
} from '../../auth.service';
import { EnableBiometricDto } from '../../dto/biometric.dto';
import { HashService } from '../hash/hash.service';

/** Sin usar el login con huella en este tiempo, el telefono pide la contraseña otra vez. */
const DIAS_VALIDEZ = 90;

/** Mismo formato de error que `login()`: HTTP 200 con `{ error, code }`. */
const BIOMETRIC_INVALID = {
  error: 'El acceso con huella ya no es válido. Entrá con tu contraseña.',
  code: 'BIOMETRIC_INVALID',
} as const;

/**
 * Login con huella / Face ID de la app movil.
 *
 * El backend nunca ve la biometria: la comprueba el telefono y, si pasa, saca
 * del llavero un token largo de este dispositivo y lo cambia aqui por un JWT
 * normal. Cada uso gasta el token y devuelve uno nuevo (rotacion), asi que un
 * token copiado sirve como mucho una vez y delata el robo al dueño, que deja de
 * poder entrar con huella.
 *
 * Como en PasswordSetupService, en la base solo se guarda el hash del token.
 */
@Injectable()
export class BiometricService {
  private readonly logger = new Logger(BiometricService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hashService: HashService,
    private readonly authService: AuthService,
  ) {}

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private nuevoToken() {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + DIAS_VALIDEZ * 24 * 60 * 60 * 1000);
    return { token, tokenHash: this.hash(token), expiresAt };
  }

  /** Activa la huella en un telefono. Pide la contraseña aunque haya sesion. */
  async enable(userId: number, dto: EnableBiometricDto) {
    const userAuth = await this.prisma.userAuth.findUnique({
      where: { user_id: userId },
      select: { id: true, password: true },
    });

    const ok =
      !!userAuth?.password &&
      (await this.hashService.compare(dto.password, userAuth.password));
    /* 400 y no 401, como ensureCurrentPasswordMatches: la app trata cualquier
       401 como sesion caducada y cerraria la sesion por un error de tecleo. */
    if (!userAuth || !ok) {
      throw new BadRequestException({
        message: 'La contraseña actual es incorrecta.',
        code: 'INVALID_PASSWORD',
      });
    }

    const { token, tokenHash, expiresAt } = this.nuevoToken();
    await this.prisma.biometricDevice.create({
      data: {
        userAuthId: userAuth.id,
        tokenHash,
        credentialStamp: this.hash(userAuth.password),
        deviceName: dto.deviceName,
        platform: dto.platform,
        expiresAt,
      },
    });

    return { deviceToken: token, expiresAt };
  }

  /** Cambia el token del dispositivo por una sesion y un token nuevo. */
  async login(deviceToken: string, contexto?: LoginContexto) {
    const device = await this.prisma.biometricDevice.findUnique({
      where: { tokenHash: this.hash(deviceToken) },
      select: {
        id: true,
        credentialStamp: true,
        expiresAt: true,
        revokedAt: true,
        userAuth: {
          select: {
            email: true,
            password: true,
            user: { select: LOGIN_USER_SELECT },
          },
        },
      },
    });

    if (!device || device.revokedAt || device.expiresAt < new Date()) {
      return BIOMETRIC_INVALID;
    }

    /* La contraseña cambio desde que se activo: la huella deja de valer. */
    if (device.credentialStamp !== this.hash(device.userAuth.password)) {
      await this.revocar(device.id);
      return BIOMETRIC_INVALID;
    }

    const user = device.userAuth.user;
    if (!user) return BIOMETRIC_INVALID;

    const sesion = await this.authService.emitirSesion(
      user,
      device.userAuth.email,
      contexto,
    );
    /* Cuenta inactiva o empresa bloqueada: el token sigue valido para cuando
       se levante el bloqueo, y el error es el mismo que da el login normal. */
    if (!('token' in sesion)) return sesion;

    /* Rotacion atomica: si dos peticiones llegan con el mismo token, solo la
       primera lo encuentra sin cambiar; la otra no actualiza nada. */
    const siguiente = this.nuevoToken();
    const { count } = await this.prisma.biometricDevice.updateMany({
      where: { id: device.id, tokenHash: this.hash(deviceToken), revokedAt: null },
      data: {
        tokenHash: siguiente.tokenHash,
        expiresAt: siguiente.expiresAt,
        lastUsedAt: new Date(),
      },
    });
    if (count === 0) return BIOMETRIC_INVALID;

    return { ...sesion, deviceToken: siguiente.token };
  }

  /**
   * Desactiva la huella en este telefono. Publica como el logout: tiene que
   * funcionar con el JWT ya caducado, y quien tiene el token ya podria usarlo.
   */
  async disable(deviceToken: string) {
    await this.prisma.biometricDevice.updateMany({
      where: { tokenHash: this.hash(deviceToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  private async revocar(id: number) {
    await this.prisma.biometricDevice.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    this.logger.log(`Huella revocada (contraseña cambiada) en dispositivo ${id}`);
  }
}
