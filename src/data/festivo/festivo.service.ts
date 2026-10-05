import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AmbitoFestivo } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { inferirCcaa } from './ccaa-lookup';
import { QueryFestivosDto } from './dto/query-festivos.dto';

/**
 * Mapa de nuestro código ISO 3166-2:ES (el que usa `Sede.ccaa` y
 * `Festivo.ccaa`) al slug de 3 letras que usa la API externa
 * calendariosnacionales.com. Las 19 CCAA/ciudades autónomas de España.
 */
const CCAA_ISO_A_SLUG_EXTERNO: Record<string, string> = {
  AN: 'and', AR: 'ara', AS: 'ast', CN: 'can', CB: 'cnt', CL: 'cyl',
  CM: 'clm', CT: 'cat', CE: 'ceu', MD: 'mad', NC: 'nav', VC: 'val',
  EX: 'ext', GA: 'gal', IB: 'bal', RI: 'rio', ML: 'mel', PV: 'eus',
  MC: 'mur',
};

interface FestivoExterno {
  date: string;
  name: string;
}

/**
 * Festivos del calendario.
 *
 * Son INFORMATIVOS: se pintan en rojo pero no bloquean el agendado. Si una
 * sede no trabaja ese dia, se cierra con el mecanismo que ya existe
 * (dias_cerrados_sede), que es el que de verdad impide reservar.
 */
@Injectable()
export class FestivoService {
  private readonly logger = new Logger(FestivoService.name);
  private readonly EXTERNAL_API_BASE = 'https://calendariosnacionales.com/es/v1';

  constructor(
    private prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Festivos que aplican a una sede: los nacionales, los de su comunidad y
   * los de su municipio. Si no se indica sede, devuelve solo los nacionales.
   */
  async findAll(query: QueryFestivosDto) {
    const anio = query.anio ?? new Date().getFullYear();
    let { ccaa, municipio } = query;

    if (query.sedeId) {
      const sede = await this.prisma.sede.findUnique({
        where: { id: query.sedeId },
        select: { ccaa: true, municipio: true, provincia: true },
      });
      /* `provincia` es el campo antiguo y hoy guarda municipios
         ("Benalmadena"), asi que sirve de respaldo si `municipio` esta vacio. */
      municipio = municipio ?? sede?.municipio ?? sede?.provincia ?? undefined;
      // Antes esto asumía 'AN' (Andalucía) para CUALQUIER sede sin importar
      // dónde estuviera. Ahora usa el código cargado en la sede si existe,
      // y si no, lo infiere de su municipio/provincia (ver ccaa-lookup.ts).
      ccaa = ccaa ?? sede?.ccaa ?? inferirCcaa(sede?.municipio, sede?.provincia);
    }

    const desde = new Date(Date.UTC(anio, 0, 1));
    const hasta = new Date(Date.UTC(anio + 1, 0, 1));

    return this.prisma.festivo.findMany({
      where: {
        fecha: { gte: desde, lt: hasta },
        OR: [
          { ambito: AmbitoFestivo.NACIONAL },
          ...(ccaa ? [{ ambito: AmbitoFestivo.AUTONOMICO, ccaa }] : []),
          ...(municipio ? [{ ambito: AmbitoFestivo.LOCAL, municipio }] : []),
        ],
      },
      orderBy: { fecha: 'asc' },
    });
  }

  private async upsertFestivo(
    fecha: string,
    nombre: string,
    ambito: AmbitoFestivo,
    ccaa: string | null,
  ) {
    // Prisma no acepta `null` como parte del `where` de un unique compuesto
    // (fecha_ambito_ccaa_municipio) — mismo motivo por el que seedFestivos()
    // ya hacía la deduplicación a mano con findFirst en vez de upsert().
    const fechaDate = new Date(`${fecha}T00:00:00.000Z`);
    const existente = await this.prisma.festivo.findFirst({
      where: { fecha: fechaDate, ambito, ccaa, municipio: null },
      select: { id: true },
    });

    if (existente) {
      await this.prisma.festivo.update({
        where: { id: existente.id },
        data: { nombre },
      });
      return;
    }

    await this.prisma.festivo.create({
      data: { fecha: fechaDate, nombre, ambito, pais: 'ES', ccaa },
    });
  }

  /**
   * Trae festivos NACIONAL + AUTONOMICO (las 19 comunidades/ciudades
   * autónomas, no solo las que ya tienen sede hoy — así cualquier sede
   * nueva en cualquier parte de España ya tiene su calendario listo) desde
   * calendariosnacionales.com y los guarda en la tabla `Festivo` de
   * siempre. No trae LOCAL — esos se siguen cargando a mano (ver
   * seedFestivos() en seed.service.ts), porque requieren mapear el slug
   * exacto de cada municipio contra esa API.
   *
   * Es manual a propósito (lo dispara un SUPER_ADMIN cuando hace falta,
   * típicamente en octubre/noviembre cuando salen los calendarios del año
   * siguiente) — no hay ningún cron corriendo solo. Guarda los datos
   * localmente en vez de consultar la API en cada reserva, tanto por
   * performance como porque sus términos de uso piden no abusar de
   * sincronizaciones.
   */
  async sincronizarAnio(anio: number) {
    let nacionalesCount = 0;
    let autonomicosCount = 0;
    const fallos: string[] = [];

    try {
      const { data: nacional } = await firstValueFrom(
        this.httpService.get<{ holidays: FestivoExterno[] }>(
          `${this.EXTERNAL_API_BASE}/${anio}/nacionales.json`,
          // family:4 evita fallos de resolución DNS en entornos donde IPv6
          // está mal configurado (visto en desarrollo local en Windows).
          { family: 4 } as any,
        ),
      );
      for (const f of nacional.holidays) {
        await this.upsertFestivo(f.date, f.name, AmbitoFestivo.NACIONAL, null);
        nacionalesCount++;
      }
    } catch (error) {
      this.logger.error(
        `No se pudo sincronizar festivos nacionales de ${anio}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      throw new BadRequestException(
        `No se pudo contactar la API de festivos para el año ${anio}. Probá de nuevo más tarde.`,
      );
    }

    for (const [ccaaIso, slug] of Object.entries(CCAA_ISO_A_SLUG_EXTERNO)) {
      try {
        const { data } = await firstValueFrom(
          this.httpService.get<{ holidays: { regional: FestivoExterno[] } }>(
            `${this.EXTERNAL_API_BASE}/${anio}/regiones/${slug}.json`,
            { family: 4 } as any,
          ),
        );
        for (const f of data.holidays.regional) {
          await this.upsertFestivo(f.date, f.name, AmbitoFestivo.AUTONOMICO, ccaaIso);
          autonomicosCount++;
        }
      } catch (error) {
        this.logger.warn(
          `No se pudo sincronizar festivos de ${ccaaIso} (${anio}): ${
            error instanceof Error ? error.message : error
          }`,
        );
        fallos.push(ccaaIso);
      }
    }

    this.logger.log(
      `Festivos sincronizados para ${anio}: ${nacionalesCount} nacionales, ${autonomicosCount} autonómicos (${fallos.length} comunidades fallaron)`,
    );

    return {
      anio,
      nacionalesCount,
      autonomicosCount,
      comunidadesFallidas: fallos,
      fuente: 'https://calendariosnacionales.com',
    };
  }
}
