import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { GuardarCuentaPagoDto } from './dto/guardar-cuenta-pago.dto';

/**
 * Configuración de cómo cobra ONLINE un negocio (Wise o cuenta bancaria):
 * la carga el propio dueño una vez, en Configuración, para que Bookmy
 * sepa a dónde liquidarle. Distinto de LiquidacionWise, que es el
 * registro de cada pago que Bookmy ya efectuó.
 */
@Injectable()
export class EmpresaCuentaPagoService {
  constructor(private readonly prisma: PrismaService) {}

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

    const data = {
      metodo: dto.metodo,
      wiseEmail: dto.wiseEmail ?? null,
      bancoTitular: dto.bancoTitular ?? null,
      bancoNumero: dto.bancoNumero ?? null,
      bancoTipoCuenta: dto.bancoTipoCuenta ?? null,
    };

    return this.prisma.empresaCuentaPago.upsert({
      where: { empresaId },
      create: { empresaId, ...data },
      update: data,
    });
  }
}
