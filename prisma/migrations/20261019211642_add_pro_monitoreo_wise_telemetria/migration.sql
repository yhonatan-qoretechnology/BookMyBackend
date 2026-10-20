-- Monitoreo manual de Bookmy CRM Pro (no hay cobro automatico todavia).
-- CreateEnum
CREATE TYPE "EstadoPagoPlan" AS ENUM ('PENDIENTE', 'PAGADO', 'VENCIDO');

-- Liquidaciones a negocios via Wise (scaffold, sin credenciales reales).
-- CreateEnum
CREATE TYPE "EstadoLiquidacionWise" AS ENUM ('PENDIENTE', 'ENVIADA', 'COMPLETADA', 'FALLIDA');

-- Telemetria del panel y la web publica de bookmy-next, mas la apertura
-- de la app movil como proxy de distribucion por plataforma.
-- CreateEnum
CREATE TYPE "TipoEventoTelemetria" AS ENUM ('PAGEVIEW', 'APP_SESSION');

-- Para no repetir el correo de "tu prueba acaba pronto" cada dia que pasa
-- el cron (EmpresaPlanPagoCron). Se resetea en PlanService.activarPrueba().
-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "trial_aviso_enviado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "empresa_plan_pagos" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "vence" TIMESTAMP(3) NOT NULL,
    "pagado_en" TIMESTAMP(3),
    "estado" "EstadoPagoPlan" NOT NULL DEFAULT 'PENDIENTE',
    "notificado" BOOLEAN NOT NULL DEFAULT false,
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresa_plan_pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidaciones_wise" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "wise_quote_id" TEXT,
    "wise_recipient_id" TEXT,
    "wise_transfer_id" TEXT,
    "estado" "EstadoLiquidacionWise" NOT NULL DEFAULT 'PENDIENTE',
    "respuesta_wise" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liquidaciones_wise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetria_eventos" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoEventoTelemetria" NOT NULL,
    "ruta" TEXT,
    "plataforma" TEXT,
    "user_id" INTEGER,
    "sesion_id" TEXT,
    "ip_address" TEXT,
    "pais" TEXT,
    "region" TEXT,
    "ciudad" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetria_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "empresa_plan_pagos_empresa_id_idx" ON "empresa_plan_pagos"("empresa_id");

-- CreateIndex
CREATE INDEX "empresa_plan_pagos_estado_idx" ON "empresa_plan_pagos"("estado");

-- CreateIndex
CREATE INDEX "empresa_plan_pagos_vence_idx" ON "empresa_plan_pagos"("vence");

-- CreateIndex
CREATE INDEX "liquidaciones_wise_empresa_id_idx" ON "liquidaciones_wise"("empresa_id");

-- CreateIndex
CREATE INDEX "telemetria_eventos_tipo_created_at_idx" ON "telemetria_eventos"("tipo", "created_at");

-- CreateIndex
CREATE INDEX "telemetria_eventos_ruta_idx" ON "telemetria_eventos"("ruta");

-- CreateIndex
CREATE INDEX "telemetria_eventos_plataforma_idx" ON "telemetria_eventos"("plataforma");

-- CreateIndex
CREATE INDEX "telemetria_eventos_pais_idx" ON "telemetria_eventos"("pais");

-- AddForeignKey
ALTER TABLE "empresa_plan_pagos" ADD CONSTRAINT "empresa_plan_pagos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones_wise" ADD CONSTRAINT "liquidaciones_wise_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetria_eventos" ADD CONSTRAINT "telemetria_eventos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
