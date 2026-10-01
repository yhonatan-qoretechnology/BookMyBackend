-- 1.6: "regla configurada" para permitir partir un servicio en dos citas
-- enlazadas (hoy hasta el cierre + el resto el próximo día disponible del
-- mismo profesional) cuando no alcanza el tiempo. Off por defecto.
ALTER TABLE "service_sede_profesional" ADD COLUMN     "permite_continuar_otro_dia" BOOLEAN NOT NULL DEFAULT false;

-- CONTINUACION_OTRO_DIA: se registra en appointment_history cuando ocurre
-- una de estas divisiones.
ALTER TYPE "AppointmentHistoryAction" ADD VALUE 'CONTINUACION_OTRO_DIA';
