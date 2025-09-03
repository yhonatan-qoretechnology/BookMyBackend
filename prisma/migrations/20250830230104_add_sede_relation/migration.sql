/*
  Warnings:

  - You are about to drop the `SedeService` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `sedeId` to the `servicios` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."SedeService" DROP CONSTRAINT "SedeService_sedeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SedeService" DROP CONSTRAINT "SedeService_serviceId_fkey";

-- AlterTable
ALTER TABLE "public"."servicios" ADD COLUMN     "sedeId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "public"."SedeService";

-- AddForeignKey
ALTER TABLE "public"."servicios" ADD CONSTRAINT "servicios_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "public"."sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
