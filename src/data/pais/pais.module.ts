import { Global, Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PaisController } from './pais.controller';
import { PaisService } from './pais.service';

/**
 * Global a proposito: casi todos los modulos necesitan saber de que pais es
 * el negocio con el que estan tratando -para la moneda, el huso, los
 * formatos o las etiquetas-, y encadenar imports en todos ellos solo
 * anadiria ruido.
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [PaisController],
  providers: [PaisService],
  exports: [PaisService],
})
export class PaisModule {}
