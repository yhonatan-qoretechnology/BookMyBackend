-- Tiempo adicional (buffer) configurable por servicio+sede: minutos que se
-- bloquean automáticamente después de cada cita (limpieza, preparación).
ALTER TABLE "service_sede_profesional" ADD COLUMN     "tiempo_adicional_minutos" INTEGER NOT NULL DEFAULT 0;
