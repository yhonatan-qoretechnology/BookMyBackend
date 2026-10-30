-- Datos que Wise exige para liquidar en pesos colombianos (COP) y la moneda
-- en la que recibe cada negocio. Las cuentas existentes quedan en EUR.
ALTER TABLE "empresa_cuentas_pago" ADD COLUMN     "banco_codigo" TEXT,
ADD COLUMN     "moneda" VARCHAR(3) NOT NULL DEFAULT 'EUR',
ADD COLUMN     "titular_ciudad" TEXT,
ADD COLUMN     "titular_codigo_postal" TEXT,
ADD COLUMN     "titular_direccion" TEXT,
ADD COLUMN     "titular_documento_numero" TEXT,
ADD COLUMN     "titular_documento_tipo" TEXT,
ADD COLUMN     "titular_telefono" TEXT;
