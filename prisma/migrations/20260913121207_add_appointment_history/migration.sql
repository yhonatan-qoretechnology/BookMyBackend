-- Auditoría de cambios sobre una cita: extender duración, reasignar
-- especialista, reprogramar o cancelar. Pedido para poder rastrear qué
-- pasó cuando una cita se atrasa y choca con la siguiente reserva del
-- mismo profesional (ver AppointmentService.extend()/reassign()).

-- CreateEnum
CREATE TYPE "AppointmentHistoryAction" AS ENUM ('EXTENDED', 'EXTEND_CONFLICT_DETECTED', 'REASSIGNED', 'RESCHEDULED', 'CANCELLED');

-- CreateTable
CREATE TABLE "appointment_history" (
    "id" SERIAL NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "action" "AppointmentHistoryAction" NOT NULL,
    "previousData" JSONB,
    "newData" JSONB,
    "performedByUserId" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointment_history_appointmentId_idx" ON "appointment_history"("appointmentId");

-- AddForeignKey
ALTER TABLE "appointment_history" ADD CONSTRAINT "appointment_history_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_history" ADD CONSTRAINT "appointment_history_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
