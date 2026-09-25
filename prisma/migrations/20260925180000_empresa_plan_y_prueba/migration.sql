-- Alta de negocios desde la web con 30 dias de prueba de Bookmy CRM Pro.
--
-- `plan` es lo contratado; la prueba vive en `trial_ends_at`. El plan
-- efectivo se calcula al vuelo (PRO si plan = 'PRO' o la prueba sigue
-- viva), asi que no hace falta ningun proceso que degrade cuentas.
-- `trial_used` impide regalar la prueba dos veces.

-- CreateEnum
CREATE TYPE "PlanEmpresa" AS ENUM ('FREE', 'PRO');

-- AlterTable
ALTER TABLE "empresas"
  ADD COLUMN "plan" "PlanEmpresa" NOT NULL DEFAULT 'FREE',
  ADD COLUMN "trial_ends_at" TIMESTAMP(3),
  ADD COLUMN "trial_used" BOOLEAN NOT NULL DEFAULT false;

-- Las empresas que ya existian se quedan con lo que tenian contratado:
-- hasta ahora todo el panel era accesible, asi que se les deja PRO para
-- no quitarles modulos de un dia para otro.
UPDATE "empresas" SET "plan" = 'PRO';
