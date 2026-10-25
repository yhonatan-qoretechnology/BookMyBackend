import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ParseIntPipe,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EstadoSolicitud, Insumo, Prisma, Role } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { compressChatImageInPlace } from 'src/data/chatMessage/chat-image-compressor';
import { PrismaService } from 'src/prisma/prisma.service';
import { SftpStorageService } from 'src/storage/sftp-storage.service';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import {
  BOOKMY_EVENTS,
  InventarioCambiadoEvento,
  MotivoInventario,
} from '../../common/events/event-names';
import { ActualizarInsumoDto } from './dto/actualizar-insumo.dto';
import { CrearInsumoDto } from './dto/crear-insumo.dto';
import {
  INSUMO_IMAGEN_EXTENSIONES,
  INSUMO_MAX_IMAGENES,
} from './insumo-imagen.constants';
import { tipoRealDeFoto } from './insumo-imagen.filter';

/**
 * Stock e insumos.
 *
 * El catálogo es de cada EMPRESA —una peluquería y una clínica no gastan
 * lo mismo— y las existencias son de cada SEDE, que es donde de verdad se
 * acaba el bote. Todo empieza vacío y en cero: un negocio recién creado no
 * tiene nada hasta que lo da de alta.
 *
 * Todo va acotado por empresa desde el primer día. Es un módulo nuevo y no
 * tiene por qué repetir la historia de reseñas o del equipo, donde el
 * aislamiento llegó después.
 *
 * Cada cambio del catálogo o de las existencias emite inventario.cambiado:
 * el catálogo web lo escucha para que la web del negocio se refresque.
 */
@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private prisma: PrismaService,
    private readonly sftpStorage: SftpStorageService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * La empresa con la que trabaja esta sesión. El superadmin tiene que
   * decir cuál, porque no es de ninguna.
   */
  private empresaDe(user: AuthenticatedUser | undefined, empresaId?: number): number {
    if (user?.role === Role.SUPER_ADMIN) {
      if (!empresaId) {
        throw new BadRequestException(
          'Indica de qué empresa es el inventario (empresaId).',
        );
      }
      return empresaId;
    }
    if (!user?.empresaId) {
      throw new ForbiddenException('Tu sesión no pertenece a ningún negocio.');
    }
    /* Pedir otra empresa desde una sesión de negocio es un intento de
       mirar el inventario ajeno: se ignora y manda la suya. */
    return user.empresaId;
  }

  /** Comprueba que una sede es de esa empresa antes de tocar su stock. */
  private async exigirSedeDeEmpresa(sedeId: number, empresaId: number) {
    const sede = await this.prisma.sede.findFirst({
      where: { id: sedeId, empresaId },
      select: { id: true },
    });
    if (!sede) {
      throw new NotFoundException('Esa sede no es de este negocio.');
    }
  }

  /** El insumo, si es de esa empresa. */
  private async insumoDeEmpresa(
    id: number,
    empresaId: number,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const insumo = await db.insumo.findFirst({
      where: { id, empresaId },
    });
    if (!insumo) {
      throw new NotFoundException('Ese insumo no es de este negocio.');
    }
    return insumo;
  }

  /**
   * El insumo con su fila bloqueada hasta que acabe la transacción. Quien
   * cambie sus fotos a la vez espera su turno y lee la lista ya cambiada, en
   * vez de escribir encima la que leyó antes: así no se pierde una foto
   * recién subida ni vuelve una recién borrada.
   */
  private async insumoBloqueado(
    tx: Prisma.TransactionClient,
    id: number,
    empresaId: number,
  ) {
    await tx.$queryRaw`SELECT 1 FROM insumos WHERE id = ${id} AND empresa_id = ${empresaId} FOR UPDATE`;
    return this.insumoDeEmpresa(id, empresaId, tx);
  }

  /** El @@unique([empresaId, nombre]) sale como un 400 legible, no un 500. */
  private async conNombreUnico<T>(nombre: string, guardar: () => Promise<T>) {
    try {
      return await guardar();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Ya tienes un insumo llamado "${nombre}".`,
        );
      }
      throw error;
    }
  }

  /** Cuenta que el inventario de un negocio ha cambiado. */
  private avisarCambio(empresaId: number, motivo: MotivoInventario) {
    const evento: InventarioCambiadoEvento = { empresaId, motivo };
    this.eventEmitter.emit(BOOKMY_EVENTS.INVENTARIO_CAMBIADO, evento);
  }

  /* ── Catálogo ─────────────────────────────────────────── */

  async listarInsumos(user: AuthenticatedUser, empresaId?: number, incluirArchivados = false) {
    return this.prisma.insumo.findMany({
      where: {
        empresaId: this.empresaDe(user, empresaId),
        ...(incluirArchivados ? {} : { activo: true }),
      },
      orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    });
  }

  async crearInsumo(user: AuthenticatedUser, datos: CrearInsumoDto) {
    const empresaId = this.empresaDe(user, datos.empresaId);
    const nombre = datos.nombre?.trim();
    if (!nombre) throw new BadRequestException('El insumo necesita un nombre.');
    exigirPrecioParaPublicar({
      publicadoWeb: datos.publicadoWeb ?? false,
      precioRef: datos.precioRef ?? 0,
    });

    const insumo = await this.conNombreUnico(nombre, () =>
      this.prisma.insumo.create({
        data: {
          empresaId,
          nombre,
          categoria: datos.categoria?.trim() || 'General',
          unidad: datos.unidad?.trim() || 'ud',
          precioRef: datos.precioRef ?? 0,
          ...(datos.maxPorDefecto != null
            ? { maxPorDefecto: datos.maxPorDefecto }
            : {}),
          ...(datos.activo != null ? { activo: datos.activo } : {}),
          ...camposWeb(datos),
        },
      }),
    );
    this.avisarCambio(empresaId, 'insumo-creado');
    return insumo;
  }

  /**
   * Cambia lo que venga en la petición; lo demás se queda como estaba.
   * Un null en un campo que no puede quedar vacío (nombre, precio...) se
   * ignora en vez de romper.
   */
  async actualizarInsumo(
    user: AuthenticatedUser,
    id: number,
    datos: ActualizarInsumoDto,
    motivo: MotivoInventario = 'insumo-actualizado',
  ) {
    const empresaId = this.empresaDe(user, datos.empresaId);
    await this.insumoDeEmpresa(id, empresaId);

    const nombre = datos.nombre?.trim();
    if (datos.nombre != null && !nombre) {
      throw new BadRequestException('El insumo necesita un nombre.');
    }

    const insumo = await this.conNombreUnico(nombre ?? '', () =>
      this.prisma.$transaction(async (tx) => {
        const actualizado = await tx.insumo.update({
          where: { id },
          data: {
            ...(nombre ? { nombre } : {}),
            ...(datos.categoria != null
              ? { categoria: datos.categoria.trim() || 'General' }
              : {}),
            ...(datos.unidad != null
              ? { unidad: datos.unidad.trim() || 'ud' }
              : {}),
            ...(datos.precioRef != null ? { precioRef: datos.precioRef } : {}),
            ...(datos.maxPorDefecto != null
              ? { maxPorDefecto: datos.maxPorDefecto }
              : {}),
            ...(datos.activo != null ? { activo: datos.activo } : {}),
            ...camposWeb(datos),
          },
        });
        /* Se mira cómo queda, no lo que trae la petición: publicar uno que
           está a 0, o poner a 0 uno publicado, tampoco vale. Dentro de la
           transacción, para que el error deshaga el cambio aunque otra
           petición haya tocado el insumo a la vez. */
        exigirPrecioParaPublicar(actualizado);
        return actualizado;
      }),
    );
    this.avisarCambio(empresaId, motivo);
    return insumo;
  }

  /**
   * Archiva un insumo en vez de borrarlo: las solicitudes antiguas lo
   * citan y borrarlo dejaría el historial del negocio con huecos.
   */
  async archivarInsumo(user: AuthenticatedUser, id: number, empresaId?: number) {
    return this.actualizarInsumo(
      user,
      id,
      { activo: false, empresaId },
      'insumo-archivado',
    );
  }

  /* ── Fotos del catálogo web ───────────────────────────── */

  /**
   * Añade fotos al final de `imagenes`. Se comprimen como los tickets de
   * gastos y van al espacio web por SFTP, guardando la URL completa, o, sin
   * SFTP, al disco de este servidor, guardando la ruta relativa que sirve
   * /uploads.
   *
   * El id llega como texto de la ruta y se valida aquí, con el mismo 400 que
   * ParseIntPipe, para que un id que no vale también pase por el finally que
   * vacía el temporal de multer.
   */
  async agregarImagenes(
    user: AuthenticatedUser,
    idDeRuta: string,
    archivos: Express.Multer.File[],
    empresaId?: number,
  ) {
    try {
      const id = await new ParseIntPipe().transform(idDeRuta, {
        type: 'param',
        data: 'id',
      });
      if (!archivos.length) {
        throw new BadRequestException('Sube al menos una foto.');
      }
      const empresa = this.empresaDe(user, empresaId);
      /* Antes de comprimir y subir nada, que es lo lento. Al guardar se
         vuelve a mirar: otra subida puede haber llenado el hueco entretanto. */
      const { imagenes } = await this.insumoDeEmpresa(id, empresa);
      exigirHuecoParaFotos(imagenes.length, archivos.length);

      /* Todas antes de guardar ninguna: si una no es una foto de verdad, no
         sube nada. */
      const tipos = archivos.map((archivo) => tipoRealDeFoto(archivo.path));
      if (tipos.some((tipo) => !tipo)) {
        throw new BadRequestException(
          'Formato no permitido. Solo se aceptan fotos JPG, PNG, WebP o GIF.',
        );
      }

      const nuevas: string[] = [];
      try {
        for (const [i, archivo] of archivos.entries()) {
          nuevas.push(await this.guardarImagen(empresa, archivo, tipos[i]!));
        }
        const insumo = await this.prisma.$transaction(async (tx) => {
          const actual = await this.insumoBloqueado(tx, id, empresa);
          exigirHuecoParaFotos(actual.imagenes.length, nuevas.length);
          return tx.insumo.update({
            where: { id },
            data: { imagenes: { push: nuevas } },
          });
        });
        this.avisarCambio(empresa, 'imagenes-anadidas');
        return insumo;
      } catch (error) {
        /* Las que llegaron a guardarse no las cita nadie: las de una subida
           que falló a medias y las que al final ya no cabían. */
        await Promise.all(
          nuevas.map((ruta) => this.borrarImagen(empresa, ruta)),
        );
        throw error;
      }
    } finally {
      /* Lo que no llegó a su sitio no se queda en el temporal de multer. */
      for (const archivo of archivos) borrarTemporal(archivo.path);
    }
  }

  /**
   * Quita fotos de `imagenes` y borra sus ficheros cuando los subió este
   * backend. Las que no estaban en la lista se ignoran. Los ficheros se
   * borran cuando la lista ya está guardada sin ellos, nunca antes.
   */
  async quitarImagenes(
    user: AuthenticatedUser,
    id: number,
    quitar: string[],
    empresaId?: number,
  ) {
    const empresa = this.empresaDe(user, empresaId);
    const fuera = new Set(quitar.map((ruta) => ruta.trim()));

    const { insumo, quitadas } = await this.prisma.$transaction(async (tx) => {
      const actual = await this.insumoBloqueado(tx, id, empresa);
      const enLaLista = actual.imagenes.filter((ruta) => fuera.has(ruta));
      if (!enLaLista.length) return { insumo: actual, quitadas: enLaLista };
      const restantes = actual.imagenes.filter((ruta) => !fuera.has(ruta));
      return {
        insumo: await tx.insumo.update({
          where: { id },
          data: { imagenes: restantes },
        }),
        quitadas: enLaLista,
      };
    });
    if (!quitadas.length) return insumo;

    await Promise.all(quitadas.map((ruta) => this.borrarImagen(empresa, ruta)));
    this.avisarCambio(empresa, 'imagenes-quitadas');
    return insumo;
  }

  /** `tipo` es el de tipoRealDeFoto, no el que declaró el cliente. */
  private async guardarImagen(
    empresaId: number,
    archivo: Express.Multer.File,
    tipo: string,
  ) {
    const temporal = path.resolve(archivo.path);
    await compressChatImageInPlace(temporal, tipo);
    const nombre = `${archivo.filename}${INSUMO_IMAGEN_EXTENSIONES.get(tipo) ?? ''}`;

    if (this.sftpStorage.isEnabled()) {
      const { publicUrl } = await this.sftpStorage.uploadLocalFile({
        localPath: temporal,
        remoteRelativePath: `uploads/bookmy/insumos/${empresaId}/${nombre}`,
      });
      return publicUrl;
    }

    const relativa = `uploads/insumos/${empresaId}/${nombre}`;
    const destino = path.resolve(relativa);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.renameSync(temporal, destino);
    return relativa;
  }

  /**
   * Borra el fichero de una foto si lo subió este backend para ESTE negocio;
   * una foto de fuera (una URL enlazada a mano) solo sale de la lista. Un
   * fallo se apunta y ya: la foto ha dejado de salir igualmente.
   */
  private async borrarImagen(empresaId: number, ruta: string) {
    try {
      if (/^https?:\/\//i.test(ruta)) {
        const propia = new URL(ruta).pathname.startsWith(
          `/uploads/bookmy/insumos/${empresaId}/`,
        );
        if (propia && this.sftpStorage.isEnabled()) {
          await this.sftpStorage.deleteByPublicUrl(ruta);
        }
        return;
      }
      const relativa = ruta.replace(/^\/+/, '');
      if (
        relativa.startsWith(`uploads/insumos/${empresaId}/`) &&
        !relativa.includes('..')
      ) {
        fs.rmSync(path.resolve(relativa), { force: true });
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo borrar la foto ${ruta}: ${(error as Error).message}`,
      );
    }
  }

  /* ── Existencias por sede ─────────────────────────────── */

  /**
   * Lo que hay en una sede. Devuelve TODOS los insumos del catálogo, no
   * solo los que tienen fila: un insumo del que nunca se ha comprado nada
   * está a cero, no es que no exista.
   */
  async stockDeSede(user: AuthenticatedUser, sedeId: number, empresaId?: number) {
    const empresa = this.empresaDe(user, empresaId);
    await this.exigirSedeDeEmpresa(sedeId, empresa);

    const [insumos, existencias] = await Promise.all([
      this.prisma.insumo.findMany({
        where: { empresaId: empresa, activo: true },
        orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
      }),
      this.prisma.stockSede.findMany({ where: { sedeId } }),
    ]);

    const porInsumo = new Map(existencias.map((e) => [e.insumoId, e]));
    return insumos.map((insumo) => {
      const e = porInsumo.get(insumo.id);
      return {
        sedeId,
        insumoId: insumo.id,
        insumo,
        stock: e?.stock ?? 0,
        /* Sin objetivo propio en la sede manda el del catalogo. Si esto
           devolviera 0, la barra de nivel marcaria todo como critico y el
           boton de reponer saldria siempre apagado. */
        max: e?.max || insumo.maxPorDefecto,
      };
    });
  }

  /** Ajusta las existencias de un insumo en una sede. */
  async ajustarStock(
    user: AuthenticatedUser,
    sedeId: number,
    insumoId: number,
    datos: { stock?: number; max?: number; empresaId?: number },
  ) {
    const empresa = this.empresaDe(user, datos.empresaId);
    await this.exigirSedeDeEmpresa(sedeId, empresa);

    const insumo = await this.prisma.insumo.findFirst({
      where: { id: insumoId, empresaId: empresa },
      select: { id: true },
    });
    if (!insumo) throw new NotFoundException('Ese insumo no es de este negocio.');

    if ((datos.stock ?? 0) < 0 || (datos.max ?? 0) < 0) {
      throw new BadRequestException('Las cantidades no pueden ser negativas.');
    }

    const existencias = await this.prisma.stockSede.upsert({
      where: { sedeId_insumoId: { sedeId, insumoId } },
      update: {
        ...(datos.stock !== undefined ? { stock: datos.stock } : {}),
        ...(datos.max !== undefined ? { max: datos.max } : {}),
      },
      create: {
        sedeId,
        insumoId,
        stock: datos.stock ?? 0,
        max: datos.max ?? 0,
      },
    });
    this.avisarCambio(empresa, 'stock-ajustado');
    return existencias;
  }

  /* ── Solicitudes de reposición ────────────────────────── */

  async listarSolicitudes(user: AuthenticatedUser, empresaId?: number, sedeId?: number) {
    const empresa = this.empresaDe(user, empresaId);
    if (sedeId) await this.exigirSedeDeEmpresa(sedeId, empresa);

    return this.prisma.solicitudInventario.findMany({
      where: {
        sede: { empresaId: empresa },
        ...(sedeId ? { sedeId } : {}),
      },
      include: {
        sede: { select: { id: true, nombre: true } },
        solicitante: {
          select: { id: true, email: true, UserData: { select: { name: true } } },
        },
        items: { include: { insumo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async crearSolicitud(
    user: AuthenticatedUser,
    datos: {
      sedeId: number;
      notas?: string;
      items: { insumoId: number; cantidad: number }[];
      empresaId?: number;
    },
  ) {
    const empresa = this.empresaDe(user, datos.empresaId);
    await this.exigirSedeDeEmpresa(datos.sedeId, empresa);

    const items = (datos.items ?? []).filter((i) => i.cantidad > 0);
    if (!items.length) {
      throw new BadRequestException('Añade al menos un insumo con cantidad.');
    }

    /* Que todos los insumos pedidos sean del catálogo de esta empresa:
       si no, se podrían colar ids de otro negocio en el pedido. */
    const validos = await this.prisma.insumo.findMany({
      where: { id: { in: items.map((i) => i.insumoId) }, empresaId: empresa },
      select: { id: true },
    });
    if (validos.length !== items.length) {
      throw new BadRequestException('Alguno de los insumos no es de este negocio.');
    }

    return this.prisma.solicitudInventario.create({
      data: {
        sedeId: datos.sedeId,
        solicitanteId: user.userId ?? null,
        notas: datos.notas?.trim() || null,
        items: { create: items },
      },
      include: { items: { include: { insumo: true } } },
    });
  }

  /**
   * Aprueba o rechaza un pedido. Al aprobarlo se suman las cantidades a
   * las existencias de la sede: es el momento en el que el material entra
   * de verdad.
   */
  async resolverSolicitud(
    user: AuthenticatedUser,
    id: number,
    estado: EstadoSolicitud,
    empresaId?: number,
  ) {
    const empresa = this.empresaDe(user, empresaId);
    const solicitud = await this.prisma.solicitudInventario.findFirst({
      where: { id, sede: { empresaId: empresa } },
      include: { items: true },
    });
    if (!solicitud) throw new NotFoundException('Esa solicitud no es de este negocio.');
    if (solicitud.estado !== EstadoSolicitud.PENDIENTE) {
      throw new BadRequestException('Esa solicitud ya estaba resuelta.');
    }

    const resuelta = await this.prisma.$transaction(async (tx) => {
      if (estado === EstadoSolicitud.APROBADA) {
        for (const item of solicitud.items) {
          await tx.stockSede.upsert({
            where: {
              sedeId_insumoId: { sedeId: solicitud.sedeId, insumoId: item.insumoId },
            },
            update: { stock: { increment: item.cantidad } },
            create: {
              sedeId: solicitud.sedeId,
              insumoId: item.insumoId,
              stock: item.cantidad,
              max: 0,
            },
          });
        }
      }

      return tx.solicitudInventario.update({
        where: { id },
        data: { estado, resueltaEn: new Date() },
        include: { items: { include: { insumo: true } } },
      });
    });
    /* Rechazarla no mueve nada; aprobarla mete el material en la sede. */
    if (estado === EstadoSolicitud.APROBADA) {
      this.avisarCambio(empresa, 'solicitud-aprobada');
    }
    return resuelta;
  }
}

/**
 * Los campos del catálogo web que trae la petición, listos para Prisma. Lo
 * que no viene no se toca; un texto vacío o null borra el valor.
 */
function camposWeb(datos: ActualizarInsumoDto) {
  return {
    ...(datos.publicadoWeb != null ? { publicadoWeb: datos.publicadoWeb } : {}),
    ...(datos.subcategoria !== undefined
      ? { subcategoria: textoOpcional(datos.subcategoria) }
      : {}),
    ...(datos.marca !== undefined ? { marca: textoOpcional(datos.marca) } : {}),
    ...(datos.etiqueta !== undefined
      ? { etiqueta: textoOpcional(datos.etiqueta) }
      : {}),
    ...(datos.descripcion !== undefined
      ? { descripcion: textoOpcional(datos.descripcion) }
      : {}),
    ...(datos.descripcionLarga !== undefined
      ? { descripcionLarga: textoOpcional(datos.descripcionLarga) }
      : {}),
    /* El orden manda (la primera es la principal); las repetidas, fuera. */
    ...(datos.imagenes != null
      ? { imagenes: [...new Set(datos.imagenes)] }
      : {}),
    ...(datos.especificaciones !== undefined
      ? { especificaciones: fichaTecnica(datos.especificaciones) }
      : {}),
    ...(datos.conVariantes != null ? { conVariantes: datos.conVariantes } : {}),
    ...(datos.ordenWeb !== undefined ? { ordenWeb: datos.ordenWeb } : {}),
  };
}

/** En la web no hay diferencia entre vacío y sin poner: los dos son null. */
function textoOpcional(texto: string | null | undefined) {
  return texto?.trim() || null;
}

/** La ficha sin filas vacías; sin ninguna, el insumo no tiene ficha (null). */
function fichaTecnica(pares: [string, string][] | null | undefined) {
  const filas = (pares ?? [])
    .map(([etiqueta, valor]): [string, string] => [
      etiqueta.trim(),
      valor.trim(),
    ])
    .filter(([etiqueta, valor]) => etiqueta || valor);
  return filas.length ? filas : Prisma.DbNull;
}

/** En la web el precio es precioRef: un insumo publicado a 0 saldría gratis. */
function exigirPrecioParaPublicar({
  publicadoWeb,
  precioRef,
}: Pick<Insumo, 'publicadoWeb' | 'precioRef'>) {
  if (publicadoWeb && precioRef <= 0) {
    throw new BadRequestException(
      'Para publicar un insumo en la web hace falta un precio mayor que 0.',
    );
  }
}

/** Las fotos nuevas caben todas o no entra ninguna. */
function exigirHuecoParaFotos(tiene: number, nuevas: number) {
  if (tiene + nuevas > INSUMO_MAX_IMAGENES) {
    throw new BadRequestException(
      `Un insumo puede tener como mucho ${INSUMO_MAX_IMAGENES} fotos y este ya tiene ${tiene}.`,
    );
  }
}

/** Un temporal que no se puede borrar no tiene por qué tapar la respuesta. */
function borrarTemporal(ruta: string) {
  try {
    fs.rmSync(path.resolve(ruta), { force: true });
  } catch {
    /* se queda en uploads/insumos/temp */
  }
}
