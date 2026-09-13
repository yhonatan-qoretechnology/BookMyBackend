import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EntityViewController } from './entity-view.controller';
import { EntityViewService } from './entity-view.service';

@Module({
  imports: [PrismaModule],
  controllers: [EntityViewController],
  providers: [EntityViewService],
  exports: [EntityViewService],
})
export class EntityViewModule {}
