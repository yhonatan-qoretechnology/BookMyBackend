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
    const url = process.env.DATABASE_URL ?? '';

    /* El Postgres de produccion (Seenode) exige TLS, pero uno local -el de
       Docker o el del portatil- no lo soporta y la conexion muere con
       "P1011: The server does not support SSL connections". Con el `ssl`
       fijo, este backend no podia arrancar contra NINGUNA base local, asi
       que no habia forma de desarrollar sin apuntar a produccion.
       Fuera de localhost el comportamiento es exactamente el de antes. */
    const esLocal = /@(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)[:\/]/.test(url);

    const pool = new Pool({
      connectionString: url,
      ssl: esLocal ? false : { rejectUnauthorized: false },
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
