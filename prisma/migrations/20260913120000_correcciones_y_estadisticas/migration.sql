-- Correcciones del PDF + base para las estadisticas
--
-- Contiene SOLO los cambios de esta tanda. El `prisma migrate diff` contra
-- produccion incluia ademas un DROP/ADD de 4 claves foraneas y cambios de tipo
-- en `gastos` y `categorias_gasto`: eso NO es de este trabajo, es el desfase
-- que ya existia entre produccion y schema.prisma (produccion se construyo con
-- `db push`, no con estas migraciones), y se deja fuera a proposito.
--
--   payment_items          -> adicionales de factura (punto 3 del PDF)
--   Appointment.observacion_espera -> observacion de espera (punto 2)
--   sedes.pais/municipio/localidad -> geografia de la sede (punto 4)
--   festivos               -> festivos del calendario (punto 5)
--   profesionales.email_personal, user_auth.must_change_password,
--   password_setup_tokens  -> alta del empleado por correo (punto 6)
--   entity_views           -> registro de vistas (estadisticas 2.2-2.7)
--   user_locations.city/*  -> ciudad del usuario (estadisticas 2.1 y 2.8)

-- CreateEnum
CREATE TYPE "AmbitoFestivo" AS ENUM ('NACIONAL', 'AUTONOMICO', 'LOCAL');


-- CreateEnum
CREATE TYPE "ViewEntityType" AS ENUM ('EMPRESA', 'SEDE', 'SERVICIO', 'PROFESIONAL', 'CATEGORIA');



-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "observacion_espera" TEXT;


-- AlterTable
ALTER TABLE "profesionales" ADD COLUMN     "email_personal" TEXT;


-- AlterTable
ALTER TABLE "sedes" ADD COLUMN     "localidad" TEXT,
ADD COLUMN     "municipio" TEXT,
ADD COLUMN     "pais" TEXT;


-- AlterTable
ALTER TABLE "user_auth" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_changed_at" TIMESTAMP(3);


-- AlterTable
ALTER TABLE "user_locations" ADD COLUMN     "city" VARCHAR(120),
ADD COLUMN     "city_normalized" VARCHAR(120),
ADD COLUMN     "country" VARCHAR(120),
ADD COLUMN     "region" VARCHAR(120);


-- CreateTable
CREATE TABLE "payment_items" (
    "id" SERIAL NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "concepto" VARCHAR(160) NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "precio_unitario" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_items_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "festivos" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "nombre" VARCHAR(160) NOT NULL,
    "ambito" "AmbitoFestivo" NOT NULL,
    "pais" VARCHAR(2) NOT NULL DEFAULT 'ES',
    "ccaa" VARCHAR(60),
    "municipio" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "festivos_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "password_setup_tokens" (
    "id" SERIAL NOT NULL,
    "user_auth_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_setup_tokens_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "entity_views" (
    "id" SERIAL NOT NULL,
    "entity_type" "ViewEntityType" NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "empresa_id" INTEGER,
    "sede_id" INTEGER,
    "city" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_views_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX "payment_items_payment_id_idx" ON "payment_items"("payment_id");


-- CreateIndex
CREATE INDEX "festivos_fecha_idx" ON "festivos"("fecha");


-- CreateIndex
CREATE UNIQUE INDEX "festivos_fecha_ambito_ccaa_municipio_key" ON "festivos"("fecha", "ambito", "ccaa", "municipio");


-- CreateIndex
CREATE UNIQUE INDEX "password_setup_tokens_token_hash_key" ON "password_setup_tokens"("token_hash");


-- CreateIndex
CREATE INDEX "password_setup_tokens_user_auth_id_idx" ON "password_setup_tokens"("user_auth_id");


-- CreateIndex
CREATE INDEX "entity_views_entity_type_entity_id_idx" ON "entity_views"("entity_type", "entity_id");


-- CreateIndex
CREATE INDEX "entity_views_created_at_idx" ON "entity_views"("created_at");


-- CreateIndex
CREATE INDEX "entity_views_empresa_id_idx" ON "entity_views"("empresa_id");


-- AddForeignKey
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "password_setup_tokens" ADD CONSTRAINT "password_setup_tokens_user_auth_id_fkey" FOREIGN KEY ("user_auth_id") REFERENCES "user_auth"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "entity_views" ADD CONSTRAINT "entity_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
