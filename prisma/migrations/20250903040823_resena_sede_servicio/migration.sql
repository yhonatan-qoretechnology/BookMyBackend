/*
  Warnings:

  - You are about to drop the column `sedeId` on the `servicios` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."ResenaState" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- DropForeignKey
ALTER TABLE "public"."resenas" DROP CONSTRAINT "resenas_sedeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."servicios" DROP CONSTRAINT "servicios_sedeId_fkey";

-- AlterTable
ALTER TABLE "public"."resenas" ADD COLUMN     "aprobado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estado" "public"."ResenaState" NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "serviceId" INTEGER,
ALTER COLUMN "calificacion" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "sedeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."servicios" DROP COLUMN "sedeId";

-- AddForeignKey
ALTER TABLE "public"."resenas" ADD CONSTRAINT "resenas_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "public"."sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resenas" ADD CONSTRAINT "resenas_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."servicios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
