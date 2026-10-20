import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearLiquidacionWiseDto } from './dto/crear-liquidacion-wise.dto';

/**
 * Liquidaciones a negocios vía Wise — Bookmy les paga/liquida fondos, NO
 * cobra tarjetas de clientes (eso ya lo hace, simulado, PaymentService).
 *
 * Sin WISE_API_KEY/WISE_API_URL/WISE_PROFILE_ID en el entorno, isEnabled()
 * es false: el registro se crea igual (queda en PENDIENTE) pero nunca se
 * intenta la llamada real, así que esto se puede desplegar hoy mismo sin
 * credenciales y sin romper nada — mismo patrón que SftpStorageService.
 * Cuando existan credenciales reales, crearCotizacion/crearDestinatario/
 * crearTransferencia son el punto exacto a completar (igual que el
 * comentario de PaymentService.simulateBankResponse señala para el banco).
 */
@Injectable()
export class WiseService {
  private readonly logger = new Logger(WiseService.name);
  private enabledCache: boolean | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  isEnabled(): boolean {
    if (this.enabledCache !== null) return this.enabledCache;
    const apiKey = this.configService.get<string>('WISE_API_KEY');
    const apiUrl = this.configService.get<string>('WISE_API_URL');
    const profileId = this.configService.get<string>('WISE_PROFILE_ID');
    this.enabledCache = Boolean(apiKey && apiUrl && profileId);
    return this.enabledCache;
  }

  private async get<T>(path: string): Promise<T> {
    const apiUrl = this.configService.get<string>('WISE_API_URL');
    const apiKey = this.configService.get<string>('WISE_API_KEY');
    const { data } = await firstValueFrom(
      this.httpService.get<T>(`${apiUrl}${path}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
    );
    return data;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const apiUrl = this.configService.get<string>('WISE_API_URL');
    const apiKey = this.configService.get<string>('WISE_API_KEY');
    const { data } = await firstValueFrom(
      this.httpService.post<T>(`${apiUrl}${path}`, body, {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
    );
    return data;
  }

  /**
   * Crea el registro de liquidación siempre. Si hay credenciales reales,
   * intenta además la cotización en Wise (primer paso de una transferencia:
   * cuánto cuesta convertir/enviar ese monto) y deja la respuesta cruda
   * guardada para depurar. Un fallo de Wise no pierde el registro: queda
   * en PENDIENTE con el motivo en `respuestaWise`.
   */
  async crear(dto: CrearLiquidacionWiseDto) {
    const liquidacion = await this.prisma.liquidacionWise.create({
      data: {
        empresaId: dto.empresaId,
        monto: dto.monto,
        moneda: dto.moneda ?? 'EUR',
      },
    });

    if (!this.isEnabled()) {
      this.logger.warn(
        `Wise no está configurado: liquidación ${liquidacion.id} queda PENDIENTE sin intentar la API.`,
      );
      return liquidacion;
    }

    try {
      const cotizacion = await this.post<{ id: string }>('/v3/quotes', {
        sourceCurrency: 'EUR',
        targetCurrency: liquidacion.moneda,
        sourceAmount: liquidacion.monto,
      });
      return this.prisma.liquidacionWise.update({
        where: { id: liquidacion.id },
        data: {
          wiseQuoteId: cotizacion.id,
          estado: 'ENVIADA',
          respuestaWise: cotizacion as any,
        },
      });
    } catch (error) {
      this.logger.error(
        `Fallo la cotizacion Wise de la liquidacion ${liquidacion.id}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return this.prisma.liquidacionWise.update({
        where: { id: liquidacion.id },
        data: {
          estado: 'FALLIDA',
          respuestaWise: { error: error instanceof Error ? error.message : String(error) },
        },
      });
    }
  }

  async listar(empresaId?: number) {
    return this.prisma.liquidacionWise.findMany({
      where: empresaId ? { empresaId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { empresa: { select: { id: true, nombre: true } } },
    });
  }

  async buscar(id: number) {
    const liquidacion = await this.prisma.liquidacionWise.findUnique({
      where: { id },
      include: { empresa: { select: { id: true, nombre: true } } },
    });
    if (!liquidacion) throw new NotFoundException('La liquidación no existe.');
    return liquidacion;
  }
}
