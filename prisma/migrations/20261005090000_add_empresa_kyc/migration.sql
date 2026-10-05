-- Verificación de identidad del negocio (KYC), revisada a mano por el
-- SUPER_ADMIN. No bloquea nada: el negocio sigue trabajando mientras tanto.

-- CreateEnum
CREATE TYPE "KycEstado" AS ENUM ('PENDIENTE', 'EN_REVISION', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "empresa_kyc" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "estado" "KycEstado" NOT NULL DEFAULT 'PENDIENTE',
    "nif_cif" TEXT,
    "documento_tipo" TEXT,
    "documento_frente" TEXT,
    "documento_dorso" TEXT,
    "selfie" TEXT,
    "justificante" TEXT,
    "enviado_en" TIMESTAMP(3),
    "revisado_en" TIMESTAMP(3),
    "revisado_por_id" INTEGER,
    "motivo_rechazo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresa_kyc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresa_kyc_empresa_id_key" ON "empresa_kyc"("empresa_id");

-- CreateIndex
CREATE INDEX "empresa_kyc_estado_idx" ON "empresa_kyc"("estado");

-- AddForeignKey
ALTER TABLE "empresa_kyc" ADD CONSTRAINT "empresa_kyc_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa_kyc" ADD CONSTRAINT "empresa_kyc_revisado_por_id_fkey" FOREIGN KEY ("revisado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
