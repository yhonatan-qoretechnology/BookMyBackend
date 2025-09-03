/*
  Warnings:

  - Added the required column `tipo` to the `resenas` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."ResenaType" AS ENUM ('SEDE', 'SERVICIO');

-- AlterTable
ALTER TABLE "public"."resenas" ADD COLUMN     "tipo" "public"."ResenaType" NOT NULL;
