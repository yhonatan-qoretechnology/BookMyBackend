import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Búsqueda unificada por palabra clave a través de categorías, servicios,
   * sedes y profesionales. Pensada para que el asistente (u otro cliente)
   * resuelva consultas abiertas ("quiero manicura") en un solo llamado, en
   * vez de encadenar categoría -> servicios de esa categoría -> etc.
   */
  async search(q: string, lang = 'es', limit = 5) {
    const [categorias, servicios, sedes, profesionales] = await Promise.all([
      this.prisma.category.findMany({
        where: {
          translations: {
            some: {
              language: lang,
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
        take: limit,
        include: { translations: { where: { language: lang } } },
      }),
      this.prisma.service.findMany({
        where: {
          translations: {
            some: {
              language: lang,
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
        take: limit,
        include: {
          translations: { where: { language: lang } },
          prices: true,
          category: {
            include: { translations: { where: { language: lang } } },
          },
        },
      }),
      this.prisma.sede.findMany({
        where: {
          OR: [
            { nombre: { contains: q, mode: 'insensitive' } },
            { provincia: { contains: q, mode: 'insensitive' } },
            { direccion: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          nombre: true,
          direccion: true,
          provincia: true,
          empresaId: true,
        },
      }),
      this.prisma.profesional.findMany({
        where: { nombre: { contains: q, mode: 'insensitive' } },
        take: limit,
        select: {
          id: true,
          nombre: true,
          biografia: true,
          sedeId: true,
          imagen: true,
        },
      }),
    ]);

    return {
      query: q,
      categorias: categorias.map((c) => ({
        id: c.id,
        nombre: c.translations[0]?.name ?? null,
        descripcion: c.translations[0]?.description ?? null,
      })),
      servicios: servicios.map((s) => ({
        id: s.id,
        nombre: s.translations[0]?.name ?? null,
        descripcion: s.translations[0]?.description ?? null,
        categoriaId: s.categoryId,
        categoria: s.category?.translations[0]?.name ?? null,
        precios: s.prices.map((p) => ({
          id: p.id,
          amount: p.amount,
          duration: p.duration,
          currency: p.currency,
        })),
      })),
      sedes: sedes,
      profesionales: profesionales,
    };
  }
}
