-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CARD', 'CASH');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'RESERVED', 'PAID', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" SERIAL NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "reservedAmount" DOUBLE PRECISION,
    "paidAmount" DOUBLE PRECISION,
    "transactionId" TEXT,
    "bankResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_appointmentId_key" ON "public"."payments"("appointmentId");

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "public"."Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
