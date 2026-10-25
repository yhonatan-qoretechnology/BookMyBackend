import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CatalogoWebController } from './catalogo-web.controller';
import { CatalogoWebListener } from './catalogo-web.listener';
import { CatalogoWebService } from './catalogo-web.service';

/**
 * El catálogo que un negocio enseña en su web y el aviso a esa web cuando
 * cambia el inventario. Va aparte de StockModule a propósito: el controlador
 * de stock lleva en la clase los guards de roles y del plan Pro, y esto es
 * público.
 */
@Module({
  imports: [PrismaModule],
  controllers: [CatalogoWebController],
  providers: [CatalogoWebService, CatalogoWebListener],
})
export class CatalogoWebModule {}
