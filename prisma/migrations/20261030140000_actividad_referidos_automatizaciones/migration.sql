-- Actividad del panel, avisos de uso de Pro, referidos y automatizaciones.

-- CreateEnum
CREATE TYPE "TipoAvisoUso" AS ENUM ('BAJO_USO', 'USO_INUSUAL', 'MANUAL');

-- CreateEnum
CREATE TYPE "EstadoReferido" AS ENUM ('PENDIENTE', 'RECOMPENSADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "AccionAutomatizacion" AS ENUM ('EMAIL', 'NOTIFICACION');

-- CreateEnum
CREATE TYPE "DestinoAutomatizacion" AS ENUM ('EMPRESA', 'SUPERADMINS');

-- CreateEnum
CREATE TYPE "EstadoEjecucion" AS ENUM ('PENDIENTE', 'ENVIADA', 'FALLIDA', 'OMITIDA');

-- CreateEnum
CREATE TYPE "EstadoCampana" AS ENUM ('BORRADOR', 'PROGRAMADA', 'ENVIANDO', 'ENVIADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "SegmentoCampana" AS ENUM ('TODAS', 'PRO', 'FREE', 'PRUEBA');

-- CreateTable
CREATE TABLE "actividad_panel" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "rol" VARCHAR(30) NOT NULL,
    "empresa_id" INTEGER,
    "sede_id" INTEGER,
    "recurso" VARCHAR(60) NOT NULL,
    "accion" VARCHAR(30) NOT NULL,
    "recurso_id" VARCHAR(40),
    "metodo" VARCHAR(10) NOT NULL,
    "ruta" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actividad_panel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avisos_uso_pro" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "tipo" "TipoAvisoUso" NOT NULL,
    "detalle" TEXT,
    "enviado_a" TEXT,
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avisos_uso_pro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_referido" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_referido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referidos" (
    "id" SERIAL NOT NULL,
    "referidor_id" INTEGER NOT NULL,
    "referida_id" INTEGER NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "estado" "EstadoReferido" NOT NULL DEFAULT 'PENDIENTE',
    "puntos_referidor" INTEGER NOT NULL DEFAULT 0,
    "puntos_referida" INTEGER NOT NULL DEFAULT 0,
    "recompensado_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_puntos" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "puntos" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "referido_id" INTEGER,
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_puntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automatizaciones" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" TEXT,
    "evento" VARCHAR(80) NOT NULL,
    "retraso_minutos" INTEGER NOT NULL DEFAULT 0,
    "accion" "AccionAutomatizacion" NOT NULL DEFAULT 'EMAIL',
    "destino" "DestinoAutomatizacion" NOT NULL DEFAULT 'EMPRESA',
    "asunto" VARCHAR(200) NOT NULL,
    "mensaje" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automatizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ejecuciones_automatizacion" (
    "id" SERIAL NOT NULL,
    "automatizacion_id" INTEGER NOT NULL,
    "empresa_id" INTEGER,
    "payload" JSONB,
    "estado" "EstadoEjecucion" NOT NULL DEFAULT 'PENDIENTE',
    "programada_para" TIMESTAMP(3) NOT NULL,
    "ejecutada_en" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ejecuciones_automatizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanas_email" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "asunto" VARCHAR(200) NOT NULL,
    "mensaje" TEXT NOT NULL,
    "segmento" "SegmentoCampana" NOT NULL DEFAULT 'TODAS',
    "estado" "EstadoCampana" NOT NULL DEFAULT 'BORRADOR',
    "programada_para" TIMESTAMP(3),
    "enviada_en" TIMESTAMP(3),
    "destinatarios" INTEGER NOT NULL DEFAULT 0,
    "enviados" INTEGER NOT NULL DEFAULT 0,
    "fallidos" INTEGER NOT NULL DEFAULT 0,
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campanas_email_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "actividad_panel_empresa_id_created_at_idx" ON "actividad_panel"("empresa_id", "created_at");

-- CreateIndex
CREATE INDEX "actividad_panel_user_id_idx" ON "actividad_panel"("user_id");

-- CreateIndex
CREATE INDEX "actividad_panel_created_at_idx" ON "actividad_panel"("created_at");

-- CreateIndex
CREATE INDEX "avisos_uso_pro_empresa_id_tipo_created_at_idx" ON "avisos_uso_pro"("empresa_id", "tipo", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "codigos_referido_empresa_id_key" ON "codigos_referido"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "codigos_referido_codigo_key" ON "codigos_referido"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "referidos_referida_id_key" ON "referidos"("referida_id");

-- CreateIndex
CREATE INDEX "referidos_referidor_id_idx" ON "referidos"("referidor_id");

-- CreateIndex
CREATE INDEX "referidos_estado_idx" ON "referidos"("estado");

-- CreateIndex
CREATE INDEX "movimientos_puntos_empresa_id_idx" ON "movimientos_puntos"("empresa_id");

-- CreateIndex
CREATE INDEX "automatizaciones_evento_activa_idx" ON "automatizaciones"("evento", "activa");

-- CreateIndex
CREATE INDEX "ejecuciones_automatizacion_estado_programada_para_idx" ON "ejecuciones_automatizacion"("estado", "programada_para");

-- CreateIndex
CREATE INDEX "ejecuciones_automatizacion_automatizacion_id_idx" ON "ejecuciones_automatizacion"("automatizacion_id");

-- CreateIndex
CREATE INDEX "campanas_email_estado_programada_para_idx" ON "campanas_email"("estado", "programada_para");

-- AddForeignKey
ALTER TABLE "avisos_uso_pro" ADD CONSTRAINT "avisos_uso_pro_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_referido" ADD CONSTRAINT "codigos_referido_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referidos" ADD CONSTRAINT "referidos_referidor_id_fkey" FOREIGN KEY ("referidor_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referidos" ADD CONSTRAINT "referidos_referida_id_fkey" FOREIGN KEY ("referida_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_puntos" ADD CONSTRAINT "movimientos_puntos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejecuciones_automatizacion" ADD CONSTRAINT "ejecuciones_automatizacion_automatizacion_id_fkey" FOREIGN KEY ("automatizacion_id") REFERENCES "automatizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

