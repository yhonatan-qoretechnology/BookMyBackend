/*
  Warnings:

  - You are about to drop the column `hora` on the `Appointment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[profesionalId,horaInicio]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `duracion` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `horaFin` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `horaInicio` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Appointment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- DropIndex
DROP INDEX "public"."Appointment_profesionalId_fecha_hora_key";

-- AlterTable
ALTER TABLE "public"."Appointment" DROP COLUMN "hora",
ADD COLUMN     "duracion" INTEGER NOT NULL,
ADD COLUMN     "estado" "public"."AppointmentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "horaFin" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "horaInicio" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "notas" TEXT,
ADD COLUMN     "userId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "public"."horario_sede" (
    "id" SERIAL NOT NULL,
    "sedeId" INTEGER NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaApertura" TEXT NOT NULL,
    "horaCierre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "horario_sede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dias_cerrados_sede" (
    "id" SERIAL NOT NULL,
    "sedeId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "todoElDia" BOOLEAN NOT NULL DEFAULT true,
    "horaInicio" TEXT,
    "horaFin" TEXT,

    CONSTRAINT "dias_cerrados_sede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."disponibilidad_profesional" (
    "id" SERIAL NOT NULL,
    "profesionalId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "horaInicio" TEXT,
    "horaFin" TEXT,
    "motivo" TEXT,

    CONSTRAINT "disponibilidad_profesional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "horario_sede_sedeId_diaSemana_key" ON "public"."horario_sede"("sedeId", "diaSemana");

-- CreateIndex
CREATE INDEX "dias_cerrados_sede_sedeId_fecha_idx" ON "public"."dias_cerrados_sede"("sedeId", "fecha");

-- CreateIndex
CREATE INDEX "disponibilidad_profesional_profesionalId_fecha_idx" ON "public"."disponibilidad_profesional"("profesionalId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "disponibilidad_profesional_profesionalId_fecha_key" ON "public"."disponibilidad_profesional"("profesionalId", "fecha");

-- CreateIndex
CREATE INDEX "Appointment_fecha_idx" ON "public"."Appointment"("fecha");

-- CreateIndex
CREATE INDEX "Appointment_profesionalId_fecha_idx" ON "public"."Appointment"("profesionalId", "fecha");

-- CreateIndex
CREATE INDEX "Appointment_sedeId_fecha_idx" ON "public"."Appointment"("sedeId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_profesionalId_horaInicio_key" ON "public"."Appointment"("profesionalId", "horaInicio");

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."horario_sede" ADD CONSTRAINT "horario_sede_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "public"."sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dias_cerrados_sede" ADD CONSTRAINT "dias_cerrados_sede_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "public"."sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."disponibilidad_profesional" ADD CONSTRAINT "disponibilidad_profesional_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "public"."profesionales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
