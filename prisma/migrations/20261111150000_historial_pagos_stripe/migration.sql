-- Pagos devueltos al cliente y cobros reclamados al banco (disputas).
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';
ALTER TYPE "PaymentStatus" ADD VALUE 'DISPUTED';

-- Cliente de Stripe de cada usuario (sus tarjetas guardadas).
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" TEXT;
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

-- Historial de cada pago, con la respuesta completa de Stripe y Wise.
CREATE TABLE "payment_events" (
    "id" SERIAL NOT NULL,
    "payment_id" INTEGER,
    "tipo" VARCHAR(40) NOT NULL,
    "origen" VARCHAR(20) NOT NULL,
    "stripe_event_id" TEXT,
    "datos" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_events_stripe_event_id_key" ON "payment_events"("stripe_event_id");
CREATE INDEX "payment_events_payment_id_idx" ON "payment_events"("payment_id");

ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
