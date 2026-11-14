-- CreateEnum
CREATE TYPE "TipoDescuento" AS ENUM ('PORCENTAJE', 'MONTO');

-- CreateEnum
CREATE TYPE "EstadoReferidoCliente" AS ENUM ('PENDIENTE', 'COMPLETADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "EstadoCupon" AS ENUM ('DISPONIBLE', 'USADO', 'VENCIDO', 'ANULADO');

-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "meses_pro_credito" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pro_gratis_hasta" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "empresa_plan_pagos" ADD COLUMN     "cubierto_por_referidos" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "codigos_referido" ADD COLUMN     "visitas" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "referidos" ADD COLUMN     "meses_referida" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "meses_referidor" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "recompensas_referido" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "meses" INTEGER NOT NULL,
    "motivo" VARCHAR(200) NOT NULL,
    "aplicada_como" VARCHAR(12) NOT NULL,
    "referido_id" INTEGER,
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recompensas_referido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programas_referidos_cliente" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "tipo_referidor" "TipoDescuento" NOT NULL DEFAULT 'PORCENTAJE',
    "valor_referidor" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "tipo_invitado" "TipoDescuento" NOT NULL DEFAULT 'PORCENTAJE',
    "valor_invitado" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "vigencia_dias" INTEGER NOT NULL DEFAULT 90,
    "max_por_cliente" INTEGER NOT NULL DEFAULT 0,
    "mensaje" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programas_referidos_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_referido_cliente" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_referido_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referidos_cliente" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "referidor_id" INTEGER NOT NULL,
    "invitado_id" INTEGER NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "estado" "EstadoReferidoCliente" NOT NULL DEFAULT 'PENDIENTE',
    "completado_en" TIMESTAMP(3),
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referidos_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cupones_cliente" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "tipo" "TipoDescuento" NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "motivo" VARCHAR(20) NOT NULL,
    "referido_id" INTEGER,
    "estado" "EstadoCupon" NOT NULL DEFAULT 'DISPONIBLE',
    "vence_en" TIMESTAMP(3),
    "usado_en" TIMESTAMP(3),
    "payment_id" INTEGER,
    "descuento" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cupones_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recompensas_referido_empresa_id_idx" ON "recompensas_referido"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "programas_referidos_cliente_empresa_id_key" ON "programas_referidos_cliente"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "codigos_referido_cliente_codigo_key" ON "codigos_referido_cliente"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "codigos_referido_cliente_empresa_id_user_id_key" ON "codigos_referido_cliente"("empresa_id", "user_id");

-- CreateIndex
CREATE INDEX "referidos_cliente_empresa_id_estado_idx" ON "referidos_cliente"("empresa_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "referidos_cliente_empresa_id_invitado_id_key" ON "referidos_cliente"("empresa_id", "invitado_id");

-- CreateIndex
CREATE UNIQUE INDEX "cupones_cliente_codigo_key" ON "cupones_cliente"("codigo");

-- CreateIndex
CREATE INDEX "cupones_cliente_empresa_id_estado_idx" ON "cupones_cliente"("empresa_id", "estado");

-- CreateIndex
CREATE INDEX "cupones_cliente_user_id_idx" ON "cupones_cliente"("user_id");

-- AddForeignKey
ALTER TABLE "recompensas_referido" ADD CONSTRAINT "recompensas_referido_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programas_referidos_cliente" ADD CONSTRAINT "programas_referidos_cliente_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_referido_cliente" ADD CONSTRAINT "codigos_referido_cliente_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_referido_cliente" ADD CONSTRAINT "codigos_referido_cliente_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referidos_cliente" ADD CONSTRAINT "referidos_cliente_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referidos_cliente" ADD CONSTRAINT "referidos_cliente_referidor_id_fkey" FOREIGN KEY ("referidor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referidos_cliente" ADD CONSTRAINT "referidos_cliente_invitado_id_fkey" FOREIGN KEY ("invitado_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupones_cliente" ADD CONSTRAINT "cupones_cliente_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupones_cliente" ADD CONSTRAINT "cupones_cliente_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupones_cliente" ADD CONSTRAINT "cupones_cliente_referido_id_fkey" FOREIGN KEY ("referido_id") REFERENCES "referidos_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

