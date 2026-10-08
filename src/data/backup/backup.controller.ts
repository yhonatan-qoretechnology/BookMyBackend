import { Controller, Get, Logger, Res, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { once } from 'events';
import { AuthUser } from '../../auth/common/decorators/auth-user.decorator';
import { Roles } from '../../auth/common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { BackupService } from './backup.service';

/**
 * Copia de seguridad de la base.
 *
 * Solo SUPER_ADMIN, y por una razón concreta: el volcado lleva los datos de
 * TODAS las empresas, los correos y teléfonos de sus clientes y los hashes
 * de las contraseñas. No se deja en ningún sitio público —se escribe
 * directamente en la respuesta de una petición autenticada— para que no
 * quede un archivo descargable por URL.
 */
@ApiTags('Backup')
@Controller('backup')
@UseGuards(RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class BackupController {
  private readonly logger = new Logger(BackupController.name);

  constructor(private readonly backup: BackupService) {}

  @Get('resumen')
  @ApiOperation({
    summary: 'Qué tendría la copia de seguridad (sin generarla)',
    description: 'Número de tablas, de filas y tamaño de la base, para enseñarlo antes de descargar.',
  })
  @ApiOkResponse({ description: 'Tablas, filas y tamaño.' })
  resumen() {
    return this.backup.resumen();
  }

  @Get()
  @ApiOperation({
    summary: 'Descargar la copia de seguridad completa (solo SUPER_ADMIN)',
    description:
      'Devuelve un JSON con todas las tablas. Se genera por lotes y se escribe en streaming, ' +
      'así que no se carga la base entera en memoria. No incluye los archivos subidos.',
  })
  async descargar(@Res() res: Response, @AuthUser() user?: AuthenticatedUser) {
    const fecha = new Date().toISOString().slice(0, 10);
    const nombre = `bookmy-backup-${fecha}.json`;

    this.logger.log(`Copia de seguridad solicitada por ${user?.email ?? 'desconocido'}`);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    /* Sin esto el panel, que está en otro origen, no puede leer el nombre
       del archivo que manda la cabecera. */
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Cache-Control', 'no-store');

    try {
      for await (const trozo of this.backup.volcar()) {
        /* `write` devuelve false cuando el buffer de salida está lleno:
           esperar al 'drain' es lo que evita que una base grande se acumule
           en memoria pese a ir por lotes. */
        if (!res.write(trozo)) await once(res, 'drain');
      }
      res.end();
    } catch (error) {
      this.logger.error(
        `Fallo generando la copia: ${error instanceof Error ? error.message : error}`,
      );
      /* Si ya se envió algo no se puede cambiar el código de estado: se
         corta la conexión para que el archivo salga roto de forma evidente
         y nadie lo guarde creyendo que está completo. */
      if (res.headersSent) res.destroy();
      else res.status(500).json({ message: 'No se pudo generar la copia de seguridad.' });
    }
  }
}
