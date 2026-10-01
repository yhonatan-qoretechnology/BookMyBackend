-- Bloqueo administrativo de empresas (solo SUPER_ADMIN): no borra nada,
-- solo impide login de sus admins/profesionales y reservar en sus sedes.
ALTER TABLE "empresas" ADD COLUMN     "bloqueada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bloqueada_en" TIMESTAMP(3),
ADD COLUMN     "bloqueada_motivo" TEXT;
