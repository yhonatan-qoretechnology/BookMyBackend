import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { KycEstado, Role } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { SftpStorageService } from '../../storage/sftp-storage.service';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';

/** Archivos que puede traer el envío (todos opcionales salvo el frente). */
export interface ArchivosKyc {
  documentoFrente?: Express.Multer.File[];
  documentoDorso?: Express.Multer.File[];
  selfie?: Express.Multer.File[];
  justificante?: Express.Multer.File[];
}

/**
 * Verificación de identidad del negocio (KYC), manual.
 *
 * El negocio sube su documentación y queda EN_REVISION; el SUPER_ADMIN la
 * aprueba o la rechaza con un motivo. No bloquea nada por decisión de
 * producto: una empresa sin verificar trabaja igual, solo ve el aviso en
 * su panel y aparece en la cola de revisión.
 */
/**
 * Dias que tiene un negocio para subir su documentacion, contados desde
 * que creo la cuenta. Pasado el plazo el aviso se vuelve urgente, pero la
 * cuenta sigue funcionando: no se le tira el negocio a nadie por un papel,
 * y menos a quien ya tiene citas cogidas.
 */
export const DIAS_PARA_VERIFICAR = 7;

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private prisma: PrismaService,
    private readonly sftpStorage: SftpStorageService,
  ) {}

  /** Mueve el archivo subido a uploads/kyc (o al SFTP) y devuelve su ruta relativa. */
  private async guardar(file: Express.Multer.File): Promise<string> {
    const ext = path.extname(file.originalname) || '';
    const nombre = `${file.filename}${ext}`;
    const relativa = path.join('uploads', 'kyc', nombre).replace(/\\/g, '/');

    if (this.sftpStorage.isEnabled()) {
      await this.sftpStorage.uploadLocalFile({
        localPath: file.path,
        remoteRelativePath: relativa,
        deleteLocalAfter: true,
      });
      return relativa;
    }

    const destino = path.join(process.cwd(), 'uploads', 'kyc');
    if (!fs.existsSync(destino)) fs.mkdirSync(destino, { recursive: true });

    const origen = path.isAbsolute(file.path)
      ? file.path
      : path.join(process.cwd(), file.path);
    const final = path.join(destino, nombre);
    if (origen !== final) fs.renameSync(origen, final);

    return relativa;
  }

  /**
   * Quien puede ver o enviar el KYC de una empresa: el superadmin y el
   * dueño de ESA empresa. Un admin de otra empresa no pinta nada aquí.
   */
  /**
   * Quien puede gestionar la verificacion de una empresa.
   *
   * Lo envia cualquier ADMINISTRADOR de esa empresa, sea el dueno o el
   * administrador de una sede. Al principio solo podia el dueno, y eso
   * dejaba fuera a nueve de las trece empresas de produccion: no tienen
   * cuenta de dueno, asi que su verificacion no la podia enviar nadie.
   *
   * Quien no entra: los profesionales (EMPLOYEE), los clientes, y cualquier
   * administrador de OTRA empresa.
   */
  private exigirAcceso(empresaId: number, user?: AuthenticatedUser) {
    if (!user) throw new ForbiddenException('Sesión requerida.');
    if (user.role === Role.SUPER_ADMIN) return;
    const esAdminDeLaEmpresa =
      (user.role === Role.COMPANY_ADMIN || user.role === Role.BRANCH_ADMIN) &&
      user.empresaId === empresaId;
    if (esAdminDeLaEmpresa) return;
    throw new ForbiddenException(
      'Solo un administrador de la empresa o un superadmin pueden gestionar su verificación.',
    );
  }

  /** Estado actual; si nunca se envió nada, se devuelve PENDIENTE sin crear fila. */
  async estadoDe(empresaId: number, user?: AuthenticatedUser) {
    this.exigirAcceso(empresaId, user);

    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true, nombre: true, createdAt: true },
    });
    if (!empresa) throw new NotFoundException('La empresa no existe.');

    const kyc = await this.prisma.empresaKyc.findUnique({
      where: { empresaId },
      include: { revisadoPor: { select: { id: true, email: true } } },
    });

    /* El plazo cuenta desde que se creo la cuenta, que es el unico
       momento que el negocio reconoce como "cuando empece". */
    const limite = new Date(empresa.createdAt);
    limite.setDate(limite.getDate() + DIAS_PARA_VERIFICAR);
    const restantes = Math.ceil((limite.getTime() - Date.now()) / 86_400_000);
    const plazo = {
      diasParaVerificar: Math.max(0, restantes),
      limiteVerificacion: limite.toISOString(),
      plazoVencido: restantes <= 0,
    };

    return (
      kyc
        ? { ...kyc, ...plazo }
        : {
        empresaId,
        estado: KycEstado.PENDIENTE,
        nifCif: null,
        documentoTipo: null,
        documentoNumero: null,
        documentoFrente: null,
        documentoDorso: null,
        selfie: null,
        justificante: null,
        enviadoEn: null,
        revisadoEn: null,
        revisadoPorId: null,
        motivoRechazo: null,
        revisadoPor: null,
        ...plazo,
      }
    );
  }

  /**
   * Envía (o reenvía, si fue rechazada) la documentación. Los archivos que
   * no vengan conservan lo que ya hubiera guardado, para poder corregir
   * solo lo que el superadmin pidió.
   * @throws BadRequestException si no hay documento del responsable.
   */
  async enviar(
    empresaId: number,
    datos: { nifCif?: string; documentoTipo?: string; documentoNumero?: string },
    archivos: ArchivosKyc,
    user?: AuthenticatedUser,
  ) {
    this.exigirAcceso(empresaId, user);

    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true },
    });
    if (!empresa) throw new NotFoundException('La empresa no existe.');

    const previo = await this.prisma.empresaKyc.findUnique({ where: { empresaId } });
    if (previo?.estado === KycEstado.APROBADA) {
      throw new BadRequestException('Esta empresa ya está verificada.');
    }

    const [frente, dorso, selfie, justificante] = await Promise.all([
      archivos.documentoFrente?.[0] ? this.guardar(archivos.documentoFrente[0]) : null,
      archivos.documentoDorso?.[0] ? this.guardar(archivos.documentoDorso[0]) : null,
      archivos.selfie?.[0] ? this.guardar(archivos.selfie[0]) : null,
      archivos.justificante?.[0] ? this.guardar(archivos.justificante[0]) : null,
    ]);

    const documentoFrente = frente ?? previo?.documentoFrente ?? null;
    if (!documentoFrente) {
      throw new BadRequestException(
        'Falta la foto del documento del responsable del negocio.',
      );
    }

    const datosComunes = {
      estado: KycEstado.EN_REVISION,
      nifCif: datos.nifCif?.trim() || previo?.nifCif || null,
      documentoTipo: datos.documentoTipo?.trim() || previo?.documentoTipo || null,
      documentoNumero:
        datos.documentoNumero?.trim() || previo?.documentoNumero || null,
      documentoFrente,
      documentoDorso: dorso ?? previo?.documentoDorso ?? null,
      selfie: selfie ?? previo?.selfie ?? null,
      justificante: justificante ?? previo?.justificante ?? null,
      enviadoEn: new Date(),
      /* Se limpia la revisión anterior: vuelve a la cola como nueva. */
      revisadoEn: null,
      revisadoPorId: null,
      motivoRechazo: null,
    };

    return this.prisma.empresaKyc.upsert({
      where: { empresaId },
      create: { empresaId, ...datosComunes },
      update: datosComunes,
    });
  }

  /** Cola de revisión del superadmin: lo enviado y aún sin resolver. */
  async pendientes() {
    return this.prisma.empresaKyc.findMany({
      where: { estado: KycEstado.EN_REVISION },
      orderBy: { enviadoEn: 'asc' },
      include: {
        empresa: { select: { id: true, nombre: true, email: true, telefono: true } },
      },
    });
  }

  /** Aprueba la verificación (solo SUPER_ADMIN, lo exige el controlador). */
  async aprobar(empresaId: number, user?: AuthenticatedUser) {
    const kyc = await this.prisma.empresaKyc.findUnique({ where: { empresaId } });
    if (!kyc) throw new NotFoundException('Esta empresa no ha enviado documentación.');

    return this.prisma.empresaKyc.update({
      where: { empresaId },
      data: {
        estado: KycEstado.APROBADA,
        revisadoEn: new Date(),
        revisadoPorId: user?.userId ?? null,
        motivoRechazo: null,
      },
    });
  }

  /**
   * Rechaza con motivo: el negocio lo ve en su panel y puede volver a
   * enviar la documentación corregida.
   */
  async rechazar(empresaId: number, motivo: string, user?: AuthenticatedUser) {
    if (!motivo?.trim()) {
      throw new BadRequestException('Indica el motivo del rechazo.');
    }

    const kyc = await this.prisma.empresaKyc.findUnique({ where: { empresaId } });
    if (!kyc) throw new NotFoundException('Esta empresa no ha enviado documentación.');

    return this.prisma.empresaKyc.update({
      where: { empresaId },
      data: {
        estado: KycEstado.RECHAZADA,
        revisadoEn: new Date(),
        revisadoPorId: user?.userId ?? null,
        motivoRechazo: motivo.trim(),
      },
    });
  }
}
