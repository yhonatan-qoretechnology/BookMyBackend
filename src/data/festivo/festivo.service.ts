import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AmbitoFestivo } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { enTitulo, inferirMunicipio, inferirRegion, normalizar } from './region-lookup';
import { QueryFestivosDto } from './dto/query-festivos.dto';

/**
 * Lo que cambia de un país a otro en el calendario laboral.
 *
 * `regiones` mapea nuestro código ISO 3166-2 (el que guardan `Sede.region`
 * y `Festivo.region`) al slug que usa la API externa. España tiene sus 19
 * comunidades y ciudades autónomas; Colombia no tiene festivos regionales
 * —los 18 son nacionales, por la Ley 51/1983— así que su mapa está vacío
 * a propósito y el bucle regional no itera.
 */
const CALENDARIO_POR_PAIS: Record<string, { slug: string; regiones: Record<string, string> }> = {
  ES: {
    slug: 'es',
    regiones: {
      AN: 'and', AR: 'ara', AS: 'ast', CN: 'can', CB: 'cnt', CL: 'cyl',
      CM: 'clm', CT: 'cat', CE: 'ceu', MD: 'mad', NC: 'nav', VC: 'val',
      EX: 'ext', GA: 'gal', IB: 'bal', RI: 'rio', ML: 'mel', PV: 'eus',
      MC: 'mur',
    },
  },
  CO: {
    slug: 'co',
    /* Los traslados de la Ley Emiliani (Reyes al lunes siguiente, etc.) ya
       vienen aplicados por la API en el propio campo `date`, así que no hay
       que calcular nada aquí. */
    regiones: {},
  },
};

const PAIS_POR_DEFECTO = 'ES';

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
 *
 * Todo va acotado por país. Sin eso, sincronizar Colombia renombraba en
 * silencio los festivos españoles: los dos calendarios comparten seis
 * fechas nacionales y la "Fiesta Nacional de España" se convertía en el
 * "Día de la Raza".
 */
@Injectable()
export class FestivoService {
  private readonly logger = new Logger(FestivoService.name);
  private readonly EXTERNAL_API_BASE = 'https://calendariosnacionales.com';
  /**
   * Fiestas locales oficiales, en CSV: PROVINCIA, LOCALIDAD, FECHA, TIPO,
   * DESCRIPCION. Es la fuente que publica la Seguridad Social y de la que
   * beben los demas calendarios; la API de calendariosnacionales.com, que ya
   * usamos para nacionales y autonomicos, NO expone los municipios.
   *
   * Dos limites que conviene tener claros:
   *  - Solo sirve el ano en curso: el servlet ignora cualquier parametro de
   *    ano y siempre devuelve el actual.
   *  - Trae 457 municipios, no los 8.131 de Espana (los que tienen oficina).
   *    Torremolinos, por ejemplo, no esta: esos se siguen cargando a mano.
   */
  private readonly CSV_FIESTAS_LOCALES =
    'https://www.seg-social.es/wps/PA_POINCALAB/CalendarioServlet?exportacion=CSV&tipo=0';

  constructor(
    private prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Festivos que aplican a una sede: los nacionales de SU país, los de su
   * región y los de su municipio. Sin sede, devuelve los nacionales del
   * país que se pida (España si no se indica ninguno).
   */
  async findAll(query: QueryFestivosDto) {
    const anio = query.anio ?? new Date().getFullYear();
    const { pais, regiones, municipios } = await this.resolverAmbito(query);

    const desde = new Date(Date.UTC(anio, 0, 1));
    const hasta = new Date(Date.UTC(anio + 1, 0, 1));

    const festivos = await this.prisma.festivo.findMany({
      where: {
        pais: pais ?? PAIS_POR_DEFECTO,
        fecha: { gte: desde, lt: hasta },
        OR: [
          { ambito: AmbitoFestivo.NACIONAL },
          ...(regiones.size
            ? [{ ambito: AmbitoFestivo.REGIONAL, region: { in: [...regiones] } }]
            : []),
          /* Los locales se filtran despues, a mano: ver abajo. */
          ...(municipios.size ? [{ ambito: AmbitoFestivo.LOCAL }] : []),
        ],
      },
      orderBy: { fecha: 'asc' },
    });

    /* El municipio no se puede comparar con un `in` de Prisma: la tabla
       guarda "Malaga" y las sedes "Málaga" o "Benalmádena", y un igual
       exacto no casa por una tilde. Se comparan normalizados (sin tildes
       y en minúsculas), que es como ya se resuelve la región. */
    const buscados = new Set([...municipios].map(normalizar));
    return festivos.filter(
      (f) =>
        f.ambito !== AmbitoFestivo.LOCAL ||
        (!!f.municipio && buscados.has(normalizar(f.municipio))),
    );
  }

  /**
   * De QUIEN son los festivos que se van a devolver: pais, regiones y
   * municipios. Se resuelve igual para el listado y para el contexto que
   * muestra el panel, que es como el usuario comprueba que al cambiar de
   * sede cambia de verdad el calendario.
   *
   * Una sede marca una region; una empresa, tantas como sedes tenga
   * repartidas — el dueno ve un solo calendario y le tienen que salir todas
   * las de sus sedes, no solo las nacionales.
   */
  private async resolverAmbito(query: QueryFestivosDto) {
    const regiones = new Set<string>();
    const municipios = new Set<string>();
    if (query.region) regiones.add(query.region);
    if (query.municipio) municipios.add(query.municipio);
    let pais = query.pais?.toUpperCase();

    const sedes =
      query.sedeId || query.empresaId
        ? await this.prisma.sede.findMany({
            where: query.sedeId ? { id: query.sedeId } : { empresaId: query.empresaId },
            select: {
              id: true,
              nombre: true,
              region: true,
              municipio: true,
              localidad: true,
              direccion: true,
              provincia: true,
              country: { select: { isoCode: true, tieneRegiones: true } },
              empresa: { select: { country: { select: { isoCode: true } } } },
            },
          })
        : [];

    const porSede: {
      sedeId: number;
      nombre: string;
      municipio?: string;
      /* De donde salio el municipio: 'provincia' significa "del campo
         antiguo", el que guarda la provincia en sedes que no estan en la
         capital, y el panel pide que lo confirmen. */
      origenMunicipio?: string;
      region?: string;
    }[] = [];

    for (const sede of sedes) {
      /* El pais de la sede manda; si es una sede antigua sin pais, se cae
         al de su empresa, que si es obligatorio. */
      pais = pais ?? sede.country?.isoCode ?? sede.empresa?.country?.isoCode;
      const paisSede = pais ?? PAIS_POR_DEFECTO;

      /* El municipio sale de la direccion, no del campo `provincia`: ese
         guarda "Malaga" en sedes que estan en Marbella y les colaba las
         fiestas de la capital. Ver inferirMunicipio(). */
      const resuelto = inferirMunicipio(paisSede, sede);
      const municipio = resuelto?.nombre;
      if (municipio) municipios.add(municipio);

      /* En un pais sin festivos regionales no se infiere nada: preguntar
         por la region de una sede de Bogota no tiene sentido. */
      const region =
        sede.country?.tieneRegiones === false
          ? undefined
          : sede.region ?? inferirRegion(paisSede, municipio, sede.provincia);
      if (region) regiones.add(region);

      porSede.push({
        sedeId: sede.id,
        nombre: sede.nombre,
        municipio,
        origenMunicipio: resuelto?.origen,
        region: region ?? undefined,
      });
    }

    return { pais, regiones, municipios, porSede };
  }

  /**
   * Que se le esta aplicando a esta sede (o empresa): pais, region y
   * municipio. El panel lo escribe encima del calendario; sin esto, dos
   * sedes del mismo pueblo parecen "no refrescar" cuando en realidad les
   * toca lo mismo, y una sede con el municipio mal cargado no se nota.
   */
  async contexto(query: QueryFestivosDto) {
    const { pais, regiones, municipios, porSede } = await this.resolverAmbito(query);
    return {
      pais: pais ?? PAIS_POR_DEFECTO,
      regiones: [...regiones],
      municipios: [...municipios],
      sedes: porSede,
    };
  }

  /**
   * Alta manual de un festivo LOCAL (el de un municipio). La API externa
   * solo publica los nacionales y los autonómicos: los patronos de cada
   * pueblo los carga el superadmin, y son justo los que cambian de
   * Benalmádena a Marbella aunque estén a veinte minutos.
   */
  async crearLocal(datos: {
    fecha: string;
    nombre: string;
    municipio: string;
    pais?: string;
  }) {
    const fecha = new Date(`${datos.fecha}T00:00:00.000Z`);
    if (Number.isNaN(fecha.getTime())) {
      throw new BadRequestException('La fecha debe tener formato YYYY-MM-DD.');
    }
    const municipio = datos.municipio.trim();
    if (!municipio) throw new BadRequestException('Indica el municipio.');

    return this.prisma.festivo.upsert({
      where: {
        pais_fecha_ambito_region_municipio: {
          pais: (datos.pais ?? PAIS_POR_DEFECTO).toUpperCase(),
          fecha,
          ambito: AmbitoFestivo.LOCAL,
          region: '',
          municipio,
        },
      },
      update: { nombre: datos.nombre.trim() },
      create: {
        pais: (datos.pais ?? PAIS_POR_DEFECTO).toUpperCase(),
        fecha,
        nombre: datos.nombre.trim(),
        ambito: AmbitoFestivo.LOCAL,
        region: '',
        municipio,
      },
    });
  }

  /** Los festivos locales ya cargados, para la pantalla que los gestiona. */
  async locales(anio?: number, pais = PAIS_POR_DEFECTO) {
    const anioFinal = anio ?? new Date().getFullYear();
    return this.prisma.festivo.findMany({
      where: {
        pais: pais.toUpperCase(),
        ambito: AmbitoFestivo.LOCAL,
        fecha: {
          gte: new Date(Date.UTC(anioFinal, 0, 1)),
          lt: new Date(Date.UTC(anioFinal + 1, 0, 1)),
        },
      },
      orderBy: [{ municipio: 'asc' }, { fecha: 'asc' }],
    });
  }

  /** Quita un festivo local cargado a mano. */
  async borrarLocal(id: number) {
    const festivo = await this.prisma.festivo.findUnique({ where: { id } });
    if (!festivo || festivo.ambito !== AmbitoFestivo.LOCAL) {
      throw new BadRequestException('Solo se pueden borrar festivos locales.');
    }
    await this.prisma.festivo.delete({ where: { id } });
  }

  /**
   * `region` y `municipio` se guardan como cadena vacía en vez de NULL
   * cuando no aplican: en Postgres un UNIQUE no restringe filas con NULL,
   * así que con NULL el índice no deduplicaba nada y los nacionales
   * entraban repetidos en cada sincronización.
   */
  private async upsertFestivo(
    pais: string,
    fecha: string,
    nombre: string,
    ambito: AmbitoFestivo,
    region: string,
  ) {
    await this.prisma.festivo.upsert({
      where: {
        pais_fecha_ambito_region_municipio: {
          pais,
          fecha: new Date(`${fecha}T00:00:00.000Z`),
          ambito,
          region,
          municipio: '',
        },
      },
      update: { nombre },
      create: {
        pais,
        fecha: new Date(`${fecha}T00:00:00.000Z`),
        nombre,
        ambito,
        region,
        municipio: '',
      },
    });
  }

  /**
   * Trae los festivos NACIONAL y, si el país los tiene, los REGIONAL desde
   * calendariosnacionales.com y los guarda en la tabla `Festivo`. Se traen
   * todas las regiones, no solo las que ya tienen sede hoy, para que una
   * sede nueva en cualquier parte ya encuentre su calendario hecho.
   *
   * No trae LOCAL: esos se siguen cargando a mano (ver seedFestivos() en
   * seed.service.ts), porque habria que mapear el slug exacto de cada
   * municipio contra esa API.
   *
   * Es manual a propósito (lo dispara un SUPER_ADMIN cuando hace falta,
   * típicamente en octubre/noviembre cuando salen los calendarios del año
   * siguiente) — no hay ningún cron corriendo solo. Guarda los datos
   * localmente en vez de consultar la API en cada reserva, tanto por
   * rendimiento como porque sus términos piden no abusar.
   */
  async sincronizarAnio(anio: number, paisPedido?: string) {
    const pais = (paisPedido ?? PAIS_POR_DEFECTO).toUpperCase();
    const calendario = CALENDARIO_POR_PAIS[pais];
    if (!calendario) {
      throw new BadRequestException(
        `No hay calendario de festivos configurado para el país ${pais}. ` +
          `Disponibles: ${Object.keys(CALENDARIO_POR_PAIS).join(', ')}.`,
      );
    }

    const base = `${this.EXTERNAL_API_BASE}/${calendario.slug}/v1`;
    let nacionalesCount = 0;
    let regionalesCount = 0;
    const fallos: string[] = [];

    try {
      const { data: nacional } = await firstValueFrom(
        this.httpService.get<{ holidays: FestivoExterno[] }>(
          `${base}/${anio}/nacionales.json`,
          // family:4 evita fallos de resolución DNS en entornos donde IPv6
          // está mal configurado (visto en desarrollo local en Windows).
          { family: 4 } as any,
        ),
      );
      for (const f of nacional.holidays) {
        await this.upsertFestivo(pais, f.date, f.name, AmbitoFestivo.NACIONAL, '');
        nacionalesCount++;
      }
    } catch (error) {
      this.logger.error(
        `No se pudo sincronizar festivos nacionales de ${pais} ${anio}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      throw new BadRequestException(
        `No se pudo contactar la API de festivos de ${pais} para el año ${anio}. Prueba de nuevo más tarde.`,
      );
    }

    for (const [regionIso, slug] of Object.entries(calendario.regiones)) {
      try {
        const { data } = await firstValueFrom(
          this.httpService.get<{ holidays: { regional: FestivoExterno[] } }>(
            `${base}/${anio}/regiones/${slug}.json`,
            { family: 4 } as any,
          ),
        );
        for (const f of data.holidays.regional) {
          await this.upsertFestivo(pais, f.date, f.name, AmbitoFestivo.REGIONAL, regionIso);
          regionalesCount++;
        }
      } catch (error) {
        this.logger.warn(
          `No se pudo sincronizar festivos de ${regionIso} (${pais} ${anio}): ${
            error instanceof Error ? error.message : error
          }`,
        );
        fallos.push(regionIso);
      }
    }

    /* Las del municipio, que son justo las que cambian de Benalmadena a
       Marbella y antes habia que teclear una por una. */
    const locales = pais === 'ES' ? await this.sincronizarLocalesEspana(anio) : null;

    this.logger.log(
      `Festivos de ${pais} sincronizados para ${anio}: ${nacionalesCount} nacionales, ` +
        `${regionalesCount} regionales, ${locales?.localesCount ?? 0} locales ` +
        `(${fallos.length} regiones fallaron)`,
    );

    return {
      pais,
      anio,
      nacionalesCount,
      regionalesCount,
      localesCount: locales?.localesCount ?? 0,
      municipiosCount: locales?.municipiosCount ?? 0,
      /* Si se pide otro ano, el CSV no lo tiene: se dice en claro en vez de
         devolver 0 locales sin explicacion. */
      localesOmitidas: locales?.omitidas ?? null,
      regionesFallidas: fallos,
      fuente: 'https://calendariosnacionales.com',
      fuenteLocales: 'https://www.seg-social.es',
    };
  }

  /**
   * Fiestas locales de Espana del ano en curso, desde el CSV de la
   * Seguridad Social.
   *
   * El municipio se guarda en Titulo ("Benalmadena", no "BENALMADENA") y, si
   * ya habia una fila cargada a mano para ese dia y ese pueblo, se actualiza
   * esa en vez de crear otra: el `upsert` de Prisma distingue "Benalmadena"
   * de "Benalmádena" y se veria el festivo duplicado en el calendario.
   */
  private async sincronizarLocalesEspana(anio: number) {
    let csv: string;
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<ArrayBuffer>(this.CSV_FIESTAS_LOCALES, {
          responseType: 'arraybuffer',
          /* El servlet responde ISO-8859-1: sin esto "Malaga" llega partida. */
          headers: { 'User-Agent': 'Bookmy/1.0' },
          family: 4,
        } as any),
      );
      csv = Buffer.from(data as any).toString('latin1');
    } catch (error) {
      this.logger.warn(
        `No se pudieron sincronizar fiestas locales: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return { localesCount: 0, municipiosCount: 0, omitidas: 'No se pudo contactar la fuente' };
    }

    const filas: { fecha: Date; municipio: string; nombre: string }[] = [];
    const anios = new Set<number>();
    for (const linea of csv.split(/\r?\n/).slice(1)) {
      const m = /^([^,]*),([^,]*),(\d{2})-(\d{2})-(\d{4}),([^,]*),(.*)$/.exec(linea);
      if (!m) continue;
      const [, , localidad, dia, mes, anioFila, tipo, descripcion] = m;
      if (!localidad.trim() || !normalizar(tipo).includes('local')) continue;
      anios.add(Number(anioFila));
      filas.push({
        fecha: new Date(Date.UTC(Number(anioFila), Number(mes) - 1, Number(dia))),
        municipio: enTitulo(localidad.trim()),
        nombre: descripcion.replace(/^"|"$/g, '').trim() || 'Fiesta local',
      });
    }

    /* El CSV solo publica el ano en curso. Si se esta sincronizando otro, no
       se toca nada: mas vale decirlo que dejar el calendario a medias. */
    if (!anios.has(anio)) {
      return {
        localesCount: 0,
        municipiosCount: 0,
        omitidas: `La fuente oficial solo publica ${[...anios].join(', ')}: las fiestas locales de ${anio} se cargan a mano`,
      };
    }

    const delAnio = filas.filter((f) => f.fecha.getUTCFullYear() === anio);

    /* Lo que ya hay cargado, indexado sin tildes: asi una fila manual
       "Benalmádena" se reconoce como la misma que "Benalmadena". */
    const existentes = await this.prisma.festivo.findMany({
      where: {
        pais: 'ES',
        ambito: AmbitoFestivo.LOCAL,
        fecha: {
          gte: new Date(Date.UTC(anio, 0, 1)),
          lt: new Date(Date.UTC(anio + 1, 0, 1)),
        },
      },
      select: { id: true, fecha: true, municipio: true },
    });
    const yaEsta = new Map(
      existentes.map((f) => [
        `${f.fecha.toISOString().slice(0, 10)}|${normalizar(f.municipio ?? '')}`,
        f.id,
      ]),
    );

    const municipios = new Set<string>();
    let localesCount = 0;
    for (const fila of delAnio) {
      const clave = `${fila.fecha.toISOString().slice(0, 10)}|${normalizar(fila.municipio)}`;
      const id = yaEsta.get(clave);
      if (id) {
        /* Ya estaba: no se toca. El CSV oficial llama a todas "Fiesta
           Local" y las cargadas a mano suelen tener el nombre de verdad
           ("Feria de Málaga"), que es mas util en el calendario. */
      } else {
        /* Se guarda el id recien creado, no un centinela: el CSV repite
           filas (un mismo dia y pueblo sale mas de una vez) y con un id
           inventado el segundo paso intentaba actualizar una fila que no
           existe. */
        const creado = await this.prisma.festivo.create({
          data: {
            pais: 'ES',
            fecha: fila.fecha,
            nombre: fila.nombre,
            ambito: AmbitoFestivo.LOCAL,
            region: '',
            municipio: fila.municipio,
          },
        });
        yaEsta.set(clave, creado.id);
      }
      municipios.add(normalizar(fila.municipio));
      localesCount++;
    }

    return { localesCount, municipiosCount: municipios.size, omitidas: null };
  }
}
