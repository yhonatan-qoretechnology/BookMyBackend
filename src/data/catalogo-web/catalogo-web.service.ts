import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { SftpStorageService } from 'src/storage/sftp-storage.service';

/**
 * El mayor id que cabe en un INTEGER. Los ids empiezan en 1: fuera de 1..MAX_ID
 * el negocio no puede existir, y un id que no cabe en la columna no tiene que
 * llegar a Prisma, que lo rechaza con un 500.
 */
const MAX_ID = 2_147_483_647;

/**
 * El escaparate de un negocio: lo que ha publicado de su inventario, con el
 * stock sumado de todas sus sedes. Lo lee su web desde el servidor y sin
 * sesión, así que no sale nada que no sea para el público.
 */
@Injectable()
export class CatalogoWebService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly sftpStorage: SftpStorageService,
  ) {}

  /** `origen` es el de la petición (https://api.bookmy.es), para las fotos. */
  async catalogo(empresaId: number, origen: string) {
    const empresa =
      empresaId >= 1 && empresaId <= MAX_ID
        ? await this.prisma.empresa.findUnique({
            where: { id: empresaId },
            select: { id: true, nombre: true },
          })
        : null;
    if (!empresa) throw new NotFoundException('Ese negocio no existe.');

    const insumos = await this.prisma.insumo.findMany({
      where: { empresaId, activo: true, publicadoWeb: true },
      orderBy: [{ ordenWeb: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      include: {
        existencias: {
          where: { sede: { empresaId } },
          select: { stock: true, updatedAt: true },
        },
      },
    });

    const base = this.baseDeFotos(origen);
    const fechas = insumos.flatMap((insumo) => [
      insumo.updatedAt.getTime(),
      ...insumo.existencias.map((e) => e.updatedAt.getTime()),
    ]);

    return {
      empresa,
      actualizadoEn: new Date(
        fechas.length ? Math.max(...fechas) : Date.now(),
      ).toISOString(),
      productos: insumos.map((insumo) => {
        const stock = insumo.existencias.reduce(
          (total, e) => total + e.stock,
          0,
        );
        return {
          id: insumo.id,
          nombre: insumo.nombre,
          categoria: insumo.categoria,
          subcategoria: insumo.subcategoria,
          marca: insumo.marca,
          etiqueta: insumo.etiqueta,
          descripcion: insumo.descripcion,
          descripcionLarga: insumo.descripcionLarga,
          precio: insumo.precioRef,
          imagenes: insumo.imagenes.map((ruta) => urlDeFoto(ruta, base)),
          especificaciones: Array.isArray(insumo.especificaciones)
            ? insumo.especificaciones
            : null,
          conVariantes: insumo.conVariantes,
          stock,
          disponible: stock > 0,
          orden: insumo.ordenWeb,
        };
      }),
    };
  }

  /**
   * Base de las fotos guardadas con ruta relativa. Con SFTP viven en el
   * espacio web (UPLOADS_PUBLIC_BASE_URL); sin él están en el disco de este
   * servidor, que las sirve en /uploads, y la base es la de la petición.
   */
  private baseDeFotos(origen: string) {
    const publica = (
      this.configService.get<string>('UPLOADS_PUBLIC_BASE_URL') ?? ''
    )
      .trim()
      .replace(/\/+$/, '');
    return this.sftpStorage.isEnabled() && publica
      ? publica
      : origen.replace(/\/+$/, '');
  }
}

/** Las URLs completas salen tal cual; las rutas relativas, con la base. */
function urlDeFoto(ruta: string, base: string) {
  return /^https?:\/\//i.test(ruta)
    ? ruta
    : `${base}/${ruta.replace(/^\/+/, '')}`;
}
