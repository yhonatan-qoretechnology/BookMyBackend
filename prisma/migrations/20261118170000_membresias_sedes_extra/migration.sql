-- Membresía Pro pagada online y sedes extra.
ALTER TABLE "empresas" ADD COLUMN "pro_pagado_hasta" TIMESTAMP(3),
ADD COLUMN "ciclo_pro" VARCHAR(10),
ADD COLUMN "sedes_extra" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "empresa_plan_pagos" ADD COLUMN "ciclo" VARCHAR(10) NOT NULL DEFAULT 'MENSUAL',
ADD COLUMN "sedes_extra" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "stripe_session_id" TEXT,
ADD COLUMN "periodo_hasta" TIMESTAMP(3);
CREATE UNIQUE INDEX "empresa_plan_pagos_stripe_session_id_key" ON "empresa_plan_pagos"("stripe_session_id");

-- Precios de Pro (los cambia el superadmin desde el panel).
CREATE TABLE "config_membresia" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "precio_mensual" DOUBLE PRECISION NOT NULL DEFAULT 29,
    "precio_anual" DOUBLE PRECISION NOT NULL DEFAULT 290,
    "sedes_incluidas" INTEGER NOT NULL DEFAULT 10,
    "precio_sede_extra" DOUBLE PRECISION NOT NULL DEFAULT 9,
    "dias_aviso" INTEGER NOT NULL DEFAULT 7,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "config_membresia_pkey" PRIMARY KEY ("id")
);
INSERT INTO "config_membresia" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
