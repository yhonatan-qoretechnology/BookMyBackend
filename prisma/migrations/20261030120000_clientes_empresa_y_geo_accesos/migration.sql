-- Cliente dado de alta a mano por un negocio (POST /clients) y coordenadas
-- aproximadas (geoip-lite) en la auditoría de login.

-- AlterTable
ALTER TABLE "accesos_usuario" ADD COLUMN     "latitud" DOUBLE PRECISION,
ADD COLUMN     "longitud" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "clientes_empresa" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "sede_id" INTEGER,
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clientes_empresa_empresa_id_idx" ON "clientes_empresa"("empresa_id");

-- CreateIndex
CREATE INDEX "clientes_empresa_sede_id_idx" ON "clientes_empresa"("sede_id");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_empresa_user_id_empresa_id_key" ON "clientes_empresa"("user_id", "empresa_id");

-- AddForeignKey
ALTER TABLE "clientes_empresa" ADD CONSTRAINT "clientes_empresa_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes_empresa" ADD CONSTRAINT "clientes_empresa_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

