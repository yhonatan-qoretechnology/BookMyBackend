import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [HttpModule],
  controllers: [PaymentController],
  providers: [PaymentService, PrismaService],
})
export class PaymentModule {}
