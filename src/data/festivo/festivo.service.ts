import { Injectable, Logger } from '@nestjs/common';
import { AmbitoFestivo } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryFestivosDto } from './dto/query-festivos.dto';

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

  constructor(private prisma: PrismaService) {}

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
        select: { municipio: true, provincia: true },
      });
      /* `provincia` es el campo antiguo y hoy guarda municipios
         ("Benalmadena"), asi que sirve de respaldo si `municipio` esta vacio. */
      municipio = municipio ?? sede?.municipio ?? sede?.provincia ?? undefined;
      ccaa = ccaa ?? 'AN';
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
}
