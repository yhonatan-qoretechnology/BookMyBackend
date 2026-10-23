-- Como cobra ONLINE un negocio (Wise o cuenta bancaria).
-- CreateEnum
CREATE TYPE "MetodoCobroOnline" AS ENUM ('WISE', 'BANCO');

-- Hoja de vida (PDF/doc) de cada profesional, mismo mecanismo que `imagen`.
-- AlterTable
ALTER TABLE "profesionales" ADD COLUMN     "hoja_de_vida_url" TEXT;

-- Moneda de un adicional de factura, cuando se cobro en una distinta a
-- la del negocio ("Otros / Adicionales" multidivisa).
-- AlterTable
ALTER TABLE "payment_items" ADD COLUMN     "moneda" TEXT;

-- CreateTable
CREATE TABLE "empresa_cuentas_pago" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "metodo" "MetodoCobroOnline" NOT NULL,
    "wise_email" TEXT,
    "banco_titular" TEXT,
    "banco_numero" TEXT,
    "banco_tipo_cuenta" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresa_cuentas_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresa_cuentas_pago_empresa_id_key" ON "empresa_cuentas_pago"("empresa_id");

-- AddForeignKey
ALTER TABLE "empresa_cuentas_pago" ADD CONSTRAINT "empresa_cuentas_pago_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
