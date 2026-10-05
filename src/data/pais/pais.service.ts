import { BadRequestException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';

/**
 * La configuración del mercado en el que opera un negocio.
 *
 * Es lo que antes estaba cableado en el código: el euro, el tope de 1.000,
 * `Europe/Madrid`, la palabra "CIF". Ahora sale de la tabla `country` y se
 * resuelve una sola vez, aquí, para que ningún módulo tenga que volver a
 * suponer de qué país es nadie.
 */
export interface ConfigPais {
  id: number;
  isoCode: string;
  nombre: string;
  moneda: string;
  decimalesMoneda: number;
  locale: string;
  precioMinimo: number;
  precioMaximo: number;
  zonaHoraria: string;
  etiquetaFiscal: string;
  etiquetaRegion: string;
  etiquetaMunicipio: string;
  etiquetaImpuesto: string;
  tieneRegiones: boolean;
  impuestoPorDefecto: number;
}

/** España, que es lo que era todo antes de operar en varios países. */
const POR_DEFECTO = 'ES';

const CAMPOS = {
  id: true,
  isoCode: true,
  name: true,
  moneda: true,
  decimalesMoneda: true,
  locale: true,
  precioMinimo: true,
  precioMaximo: true,
  zonaHoraria: true,
  etiquetaFiscal: true,
  etiquetaRegion: true,
  etiquetaMunicipio: true,
  etiquetaImpuesto: true,
  tieneRegiones: true,
  impuestoPorDefecto: true,
} as const;

@Injectable()
export class PaisService {
  constructor(private prisma: PrismaService) {}

  private aConfig(c: {
    id: number;
    isoCode: string;
    name: string;
    moneda: string;
    decimalesMoneda: number;
    locale: string;
    precioMinimo: number;
    precioMaximo: number;
    zonaHoraria: string;
    etiquetaFiscal: string;
    etiquetaRegion: string;
    etiquetaMunicipio: string;
    etiquetaImpuesto: string;
    tieneRegiones: boolean;
    impuestoPorDefecto: number;
  }): ConfigPais {
    const { name, ...resto } = c;
    return { ...resto, nombre: name };
  }

  /** Por su código ISO 3166-1 alfa-2. */
  async porIso(isoCode?: string): Promise<ConfigPais> {
    const iso = (isoCode?.trim() || POR_DEFECTO).toUpperCase();
    const pais = await this.prisma.country.findUnique({
      where: { isoCode: iso },
      select: CAMPOS,
    });
    if (!pais) {
      throw new BadRequestException(`Todavía no operamos en el país ${iso}.`);
    }
    return this.aConfig(pais);
  }

  /** El del negocio. */
  async porEmpresa(empresaId: number): Promise<ConfigPais> {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { country: { select: CAMPOS } },
    });
    if (!empresa?.country) return this.porIso(POR_DEFECTO);
    return this.aConfig(empresa.country);
  }

  /**
   * El de la sede. Normalmente coincide con el de su empresa; se mira la
   * sede primero porque los festivos y el huso son de donde está el local,
   * no de donde está la razón social.
   */
  async porSede(sedeId: number): Promise<ConfigPais> {
    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
      select: {
        country: { select: CAMPOS },
        empresa: { select: { country: { select: CAMPOS } } },
      },
    });
    const pais = sede?.country ?? sede?.empresa?.country;
    if (!pais) return this.porIso(POR_DEFECTO);
    return this.aConfig(pais);
  }

  /**
   * El de quien está usando el panel. El SUPER_ADMIN no tiene empresa, así
   * que ve el país por defecto salvo que pida uno concreto.
   */
  async porSesion(user?: AuthenticatedUser): Promise<ConfigPais> {
    if (user?.empresaId && user.role !== Role.SUPER_ADMIN) {
      return this.porEmpresa(user.empresaId);
    }
    if (user?.sedeId) return this.porSede(user.sedeId);
    return this.porIso(POR_DEFECTO);
  }

  /**
   * La zona horaria con la que hay que leer y escribir las horas de una
   * sede. Una sede puede llevar la suya propia para los casos en que no
   * coincide con la del país (Canarias es `Atlantic/Canary`, una hora por
   * detrás de la Península); si no la lleva, manda la del país.
   */
  async zonaHorariaDeSede(sedeId: number): Promise<string> {
    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
      select: {
        zonaHoraria: true,
        country: { select: { zonaHoraria: true } },
        empresa: { select: { country: { select: { zonaHoraria: true } } } },
      },
    });
    return (
      sede?.zonaHoraria ||
      sede?.country?.zonaHoraria ||
      sede?.empresa?.country?.zonaHoraria ||
      'Europe/Madrid'
    );
  }

  /**
   * Comprueba que un precio cabe en lo que ese país considera razonable y
   * devuelve la moneda con la que hay que guardarlo. Antes esto era un
   * `@Max(1000)` con mensaje en euros, que hacía imposible dar de alta
   * cualquier servicio colombiano.
   */
  validarPrecio(pais: ConfigPais, amount: number): string {
    if (amount < pais.precioMinimo || amount > pais.precioMaximo) {
      const fmt = (v: number) =>
        new Intl.NumberFormat(pais.locale, {
          style: 'currency',
          currency: pais.moneda,
          maximumFractionDigits: pais.decimalesMoneda,
        }).format(v);
      throw new BadRequestException(
        `El precio tiene que estar entre ${fmt(pais.precioMinimo)} y ${fmt(pais.precioMaximo)}.`,
      );
    }
    return pais.moneda;
  }

  /** Los países en los que se puede dar de alta un negocio hoy. */
  async disponibles() {
    const paises = await this.prisma.country.findMany({
      where: { activo: true },
      select: { ...CAMPOS, dialingCode: true, flagUrl: true },
      orderBy: { name: 'asc' },
    });
    return paises.map((p) => ({
      ...this.aConfig(p),
      dialingCode: p.dialingCode,
      flagUrl: p.flagUrl,
    }));
  }
}
