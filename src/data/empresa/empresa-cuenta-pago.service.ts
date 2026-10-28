import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { WiseService } from '../wise/wise.service';
import { GuardarCuentaPagoDto } from './dto/guardar-cuenta-pago.dto';

/**
 * Configuración de cómo cobra ONLINE un negocio (Wise o cuenta bancaria):
 * la carga el propio dueño una vez, en Configuración, para que Bookmy
 * sepa a dónde liquidarle. Distinto de LiquidacionWise, que es el
 * registro de cada pago que Bookmy ya efectuó.
 *
 * Al guardar, si Wise está configurado, se crea el destinatario en Wise:
 * eso valida el IBAN o el email antes de aceptar la cuenta.
 */
@Injectable()
export class EmpresaCuentaPagoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wise: WiseService,
  ) {}

  /** Solo el SUPER_ADMIN o el dueño de ESA empresa puede ver/editar sus datos de cobro. */
  private exigirAcceso(empresaId: number, user?: AuthenticatedUser) {
    if (!user) throw new ForbiddenException('Sesión requerida.');
    if (user.role === Role.SUPER_ADMIN) return;
    if (user.role === Role.COMPANY_ADMIN && user.empresaId === empresaId) return;
    throw new ForbiddenException('No puede ver los datos de cobro de esta empresa.');
  }

  async obtener(empresaId: number, user?: AuthenticatedUser) {
    this.exigirAcceso(empresaId, user);
    return this.prisma.empresaCuentaPago.findUnique({ where: { empresaId } });
  }

  /** Upsert: una empresa tiene como mucho una configuración de cobro. */
  async guardar(empresaId: number, dto: GuardarCuentaPagoDto, user?: AuthenticatedUser) {
    this.exigirAcceso(empresaId, user);

    const empresa = await this.prisma.empresa.findUnique({ where: { id: empresaId } });
    if (!empresa) throw new NotFoundException('La empresa no existe.');

    const cuenta = {
      metodo: dto.metodo,
      wiseEmail: dto.wiseEmail?.trim() ?? null,
      bancoTitular: dto.bancoTitular?.trim() ?? null,
      bancoNumero: dto.bancoNumero?.replace(/\s+/g, '').toUpperCase() ?? null,
      bancoTipoCuenta: dto.bancoTipoCuenta ?? null,
    };
    // Lanza BadRequest con el motivo de Wise si la cuenta no es válida: así
    // no se guarda una cuenta a la que luego no se podría liquidar.
    const wiseRecipientId = await this.wise.crearDestinatario(cuenta, empresa.nombre);
    const data = { ...cuenta, wiseRecipientId };

    return this.prisma.empresaCuentaPago.upsert({
      where: { empresaId },
      create: { empresaId, ...data },
      update: data,
    });
  }
}
