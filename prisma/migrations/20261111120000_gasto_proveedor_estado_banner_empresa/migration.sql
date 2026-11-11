-- Gastos: proveedor (opcional) y estado del pago al proveedor.
-- Los gastos existentes quedan como PAGADO.
ALTER TABLE "gastos" ADD COLUMN "proveedor" VARCHAR(160),
ADD COLUMN "estado" VARCHAR(20) NOT NULL DEFAULT 'PAGADO';

-- Empresas: portada (banner) que se ve en la app.
ALTER TABLE "empresas" ADD COLUMN "banner_url" TEXT;
