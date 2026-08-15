import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { SearchService } from '../data/search/search.service';

export interface ToolExecutionResult {
  ok: boolean;
  result?: unknown;
  requiresConfirmation?: boolean;
  message?: string;
  /** Resumen legible por humanos (nombres, no ids) para mostrar en la traza de /chat/test. */
  label?: string;
}

/**
 * SOLO PARA MODO PRUEBA (endpoint /assistant/chat/test).
 *
 * En la app real, la app móvil es quien ejecuta cada tool_call (contra los
 * endpoints ya existentes) y le manda el resultado de vuelta al asistente —
 * así se definió en el contrato con el equipo mobile. Este servicio replica
 * esa misma ejecución del lado del servidor, únicamente para poder probar
 * el asistente de punta a punta desde Swagger sin tener que armar el loop
 * a mano.
 *
 * Reglas:
 * - Solo ejecuta tools de LECTURA. `cancelar_cita` nunca se ejecuta acá
 *   (se corta el loop y se avisa que requiere confirmación), igual que
 *   tendría que pasar en la app real.
 * - Las tools de navegación (iniciar_reserva, ir_a_pantalla) no llaman a
 *   ningún endpoint real: solo confirman qué haría la app.
 */
@Injectable()
export class AssistantToolExecutorService {
  private readonly logger = new Logger(AssistantToolExecutorService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly searchService: SearchService,
  ) {}

  private get baseUrl(): string {
    const port = this.configService.get<string>('PORT') ?? '3000';
    return `http://localhost:${port}`;
  }

  async execute(
    name: string,
    args: Record<string, any>,
    userId?: number,
  ): Promise<ToolExecutionResult> {
    try {
      switch (name) {
        case 'buscar_todo': {
          const result = await this.searchService.search(args.q ?? '', 'es', 5);
          const nombres = [
            ...result.categorias.map((c) => c.nombre),
            ...result.servicios.map((s) => s.nombre),
            ...result.sedes.map((s) => s.nombre),
            ...result.profesionales.map((p) => p.nombre),
          ].filter(Boolean);
          return {
            ok: true,
            result,
            label:
              nombres.length > 0
                ? `Encontrado: ${nombres.slice(0, 4).join(', ')}`
                : `Sin resultados para "${args.q}"`,
          };
        }

        case 'buscar_categoria': {
          const result = await this.searchService.search(
            args.query ?? '',
            'es',
            5,
          );
          const nombres = result.categorias.map((c) => c.nombre).filter(Boolean);
          return {
            ok: true,
            result: result.categorias,
            label:
              nombres.length > 0
                ? `Categorías: ${nombres.join(', ')}`
                : `Sin categorías para "${args.query}"`,
          };
        }

        case 'listar_servicios_categoria': {
          const res = await this.get(`/services/category/${args.categoryId}`);
          return { ...res, label: this.summarizeServiceNames(res.result) };
        }

        case 'listar_sedes_empresa': {
          const res = await this.get(`/sedes/empresa/${args.companyId}`);
          const nombres = Array.isArray(res.result)
            ? res.result.map((s: any) => s?.nombre).filter(Boolean)
            : [];
          return {
            ...res,
            label: nombres.length > 0 ? `Sedes: ${nombres.join(', ')}` : undefined,
          };
        }

        case 'listar_servicios_sede': {
          const res = await this.get(`/services/by-sede/${args.sedeId}`);
          const sedeNombre = Array.isArray(res.result)
            ? res.result[0]?.sede?.nombre
            : undefined;
          const resumenServicios = this.summarizeServiceNames(res.result);
          return {
            ...res,
            label: sedeNombre
              ? `${sedeNombre} — ${resumenServicios ?? 'sin servicios'}`
              : resumenServicios,
          };
        }

        case 'ver_profesional': {
          const res = await this.get(`/profesionales/${args.profesionalId}/detalle`);
          const nombre = (res.result as any)?.nombre;
          return { ...res, label: nombre ? `Profesional: ${nombre}` : undefined };
        }

        case 'consultar_mis_citas': {
          if (!userId) {
            return {
              ok: false,
              message:
                'Esta tool requiere sesión iniciada (mandá Authorization: Bearer <token> para probarla).',
            };
          }
          const res = await this.get(`/appointments/users/${userId}/services`);
          return { ...res, label: 'Citas del usuario' };
        }

        case 'iniciar_reserva':
        case 'ir_a_pantalla':
          return {
            ok: true,
            result: { navegacion: name, parametros: args },
            label:
              name === 'ir_a_pantalla'
                ? `Navegar a: ${args.pantalla}`
                : `Ir a reservar (servicio ${args.serviceId ?? '?'})`,
            message:
              'Acción de navegación: en la app real esto abre una pantalla, no llama a ningún endpoint. En modo prueba no hay nada más que "ejecutar".',
          };

        case 'cancelar_cita':
          return {
            ok: false,
            requiresConfirmation: true,
            message:
              'cancelar_cita es una tool de escritura y requiere confirmación explícita del usuario. No se ejecuta automáticamente, ni siquiera en modo prueba.',
          };

        default:
          return { ok: false, message: `Tool desconocida: "${name}".` };
      }
    } catch (error: any) {
      this.logger.error(`Error ejecutando tool "${name}": ${error.message}`);
      return { ok: false, message: `Error ejecutando "${name}": ${error.message}` };
    }
  }

  private summarizeServiceNames(result: unknown): string | undefined {
    if (!Array.isArray(result) || result.length === 0) return undefined;
    const nombres = result
      .map((s: any) => s?.name ?? s?.nombre)
      .filter(Boolean);
    if (nombres.length === 0) return undefined;
    const extra = nombres.length > 3 ? ` y ${nombres.length - 3} más` : '';
    return `Servicios: ${nombres.slice(0, 3).join(', ')}${extra}`;
  }

  private async get(
    path: string,
    params?: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}${path}`, {
          params,
          timeout: 10000,
        }),
      );
      return { ok: true, result: response.data };
    } catch (error: any) {
      return {
        ok: false,
        message:
          error?.response?.data?.message ??
          error.message ??
          `No se pudo resolver ${path}.`,
      };
    }
  }
}
