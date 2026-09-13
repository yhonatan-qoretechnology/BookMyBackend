-- Extender una cita en curso ya no estira la cita: crea otra cita enlazada
-- a la original (extensionDeId) para registrar y cobrar el tiempo extra
-- como una reserva más del cliente (ver AppointmentService.extend()).

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "extensionDeId" INTEGER;

-- CreateIndex
CREATE INDEX "Appointment_extensionDeId_idx" ON "Appointment"("extensionDeId");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_extensionDeId_fkey" FOREIGN KEY ("extensionDeId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- La clave única (profesionalId, horaInicio) contaba también las citas
-- canceladas, que conservan su hora: al cancelar la cita siguiente para
-- hacer sitio, la extensión no se podía crear a esa misma hora.
-- DropIndex
DROP INDEX "Appointment_profesionalId_horaInicio_key";

-- CreateIndex
CREATE INDEX "Appointment_profesionalId_horaInicio_idx" ON "Appointment"("profesionalId", "horaInicio");
