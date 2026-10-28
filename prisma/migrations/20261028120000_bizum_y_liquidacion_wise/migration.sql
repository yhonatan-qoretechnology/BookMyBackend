-- Bizum como método de pago propio (hoy simulado; antes se guardaba como
-- CASH con una nota de "confirmación manual").
-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'BIZUM';

-- Destinatario de Wise creado con la cuenta del negocio: Wise valida el
-- IBAN o el email al crearlo, y las liquidaciones se envían a este id.
-- AlterTable
ALTER TABLE "empresa_cuentas_pago" ADD COLUMN     "wise_recipient_id" TEXT;

-- Cada liquidación apunta al pago del cliente que la origina. Único: un
-- mismo pago no se liquida dos veces.
-- AlterTable
ALTER TABLE "liquidaciones_wise" ADD COLUMN     "payment_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "liquidaciones_wise_payment_id_key" ON "liquidaciones_wise"("payment_id");

-- AddForeignKey
ALTER TABLE "liquidaciones_wise" ADD CONSTRAINT "liquidaciones_wise_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
