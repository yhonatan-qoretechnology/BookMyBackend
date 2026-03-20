import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 15,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    try {
      // console.log('🔌 Conectando a la base de datos...');
      await this.$connect();
      console.log('✅ Conexión a DB establecida');
    } catch (error) {
      console.error('❌ Error conectando a la base de datos:', error.message);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
