-- Tickets y facturas: todo cobro nace como TICKET; "Pasar a factura" le da
-- un consecutivo propio dentro del negocio.
ALTER TABLE "payments" ADD COLUMN "tipo_documento" VARCHAR(10) NOT NULL DEFAULT 'TICKET',
ADD COLUMN "numero_factura" INTEGER,
ADD COLUMN "factura_empresa_id" INTEGER,
ADD COLUMN "facturada_en" TIMESTAMP(3);
CREATE UNIQUE INDEX "payments_factura_empresa_id_numero_factura_key" ON "payments"("factura_empresa_id", "numero_factura");

-- Servicio comodín «Otro servicio» (no se lista).
ALTER TABLE "servicios" ADD COLUMN "interno" BOOLEAN NOT NULL DEFAULT false;

-- Motivo, comentario y soporte al desactivar un profesional.
ALTER TABLE "profesionales" ADD COLUMN "motivo_inactivo" VARCHAR(20),
ADD COLUMN "comentario_inactivo" TEXT,
ADD COLUMN "soporte_inactivo_url" TEXT,
ADD COLUMN "inactivo_desde" TIMESTAMP(3);

-- Filtros de clientes guardados por cada negocio.
CREATE TABLE "filtros_clientes" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "criterios" JSONB NOT NULL,
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "filtros_clientes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "filtros_clientes_empresa_id_idx" ON "filtros_clientes"("empresa_id");
ALTER TABLE "filtros_clientes" ADD CONSTRAINT "filtros_clientes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Campañas de cada negocio a un filtro guardado.
CREATE TABLE "campanas_clientes" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "filtro_id" INTEGER,
    "nombre" VARCHAR(120) NOT NULL,
    "canal" VARCHAR(10) NOT NULL,
    "asunto" VARCHAR(200),
    "mensaje" TEXT NOT NULL,
    "estado" "EstadoCampana" NOT NULL DEFAULT 'BORRADOR',
    "programada_para" TIMESTAMP(3),
    "enviada_en" TIMESTAMP(3),
    "destinatarios" INTEGER NOT NULL DEFAULT 0,
    "enviados" INTEGER NOT NULL DEFAULT 0,
    "fallidos" INTEGER NOT NULL DEFAULT 0,
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campanas_clientes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "campanas_clientes_empresa_id_idx" ON "campanas_clientes"("empresa_id");
CREATE INDEX "campanas_clientes_estado_programada_para_idx" ON "campanas_clientes"("estado", "programada_para");
ALTER TABLE "campanas_clientes" ADD CONSTRAINT "campanas_clientes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campanas_clientes" ADD CONSTRAINT "campanas_clientes_filtro_id_fkey" FOREIGN KEY ("filtro_id") REFERENCES "filtros_clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
