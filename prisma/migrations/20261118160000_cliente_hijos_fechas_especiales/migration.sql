-- Clientes: hijos y fechas especiales que celebran (para campañas).
ALTER TABLE "user_data" ADD COLUMN "hijos" INTEGER,
ADD COLUMN "fechas_especiales" TEXT[] DEFAULT ARRAY[]::TEXT[];
