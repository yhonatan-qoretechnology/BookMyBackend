-- Stock e Insumos deja de ser una maqueta.
--
-- Hasta ahora el catalogo vivia en memoria del navegador, con ocho
-- productos de ejemplo iguales para todos los negocios, y lo que alguien
-- escribia se perdia al recargar la pagina.
--
-- El catalogo es de cada EMPRESA -una peluqueria y una clinica no gastan
-- lo mismo- y las existencias son de cada SEDE, que es donde de verdad se
-- acaba el bote. Todo empieza vacio y en cero: nadie tiene nada hasta que
-- lo da de alta.

CREATE TYPE "EstadoSolicitud" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- ── El catalogo del negocio ──────────────────────────────────
CREATE TABLE "insumos" (
  "id"         SERIAL       PRIMARY KEY,
  "empresa_id" INTEGER      NOT NULL,
  "nombre"     VARCHAR(120) NOT NULL,
  "categoria"  VARCHAR(60)  NOT NULL DEFAULT 'General',
  "unidad"     VARCHAR(20)  NOT NULL DEFAULT 'ud',
  "precio_ref" DOUBLE PRECISION NOT NULL DEFAULT 0,
  -- Se archiva en vez de borrarse: las solicitudes antiguas lo citan.
  "activo"     BOOLEAN      NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "insumos_empresa_id_fkey" FOREIGN KEY ("empresa_id")
    REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "insumos_empresa_id_nombre_key" ON "insumos"("empresa_id", "nombre");
CREATE INDEX "insumos_empresa_id_idx" ON "insumos"("empresa_id");

-- ── Lo que queda en cada sede ────────────────────────────────
CREATE TABLE "stock_sede" (
  "id"         SERIAL  PRIMARY KEY,
  "sede_id"    INTEGER NOT NULL,
  "insumo_id"  INTEGER NOT NULL,
  "stock"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  -- Capacidad objetivo, para saber si el nivel es critico, medio o bueno.
  "max"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stock_sede_sede_id_fkey" FOREIGN KEY ("sede_id")
    REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "stock_sede_insumo_id_fkey" FOREIGN KEY ("insumo_id")
    REFERENCES "insumos"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "stock_sede_sede_id_insumo_id_key" ON "stock_sede"("sede_id", "insumo_id");
CREATE INDEX "stock_sede_sede_id_idx" ON "stock_sede"("sede_id");

-- ── Pedidos de reposicion ────────────────────────────────────
CREATE TABLE "solicitudes_inventario" (
  "id"             SERIAL PRIMARY KEY,
  "sede_id"        INTEGER NOT NULL,
  "solicitante_id" INTEGER,
  "estado"         "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',
  "notas"          VARCHAR(500),
  "resuelta_en"    TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "solicitudes_inventario_sede_id_fkey" FOREIGN KEY ("sede_id")
    REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  -- Si el usuario se da de baja, la solicitud se queda: es historico del negocio.
  CONSTRAINT "solicitudes_inventario_solicitante_id_fkey" FOREIGN KEY ("solicitante_id")
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "solicitudes_inventario_sede_id_estado_idx"
  ON "solicitudes_inventario"("sede_id", "estado");

CREATE TABLE "solicitud_items" (
  "id"           SERIAL PRIMARY KEY,
  "solicitud_id" INTEGER NOT NULL,
  "insumo_id"    INTEGER NOT NULL,
  "cantidad"     DOUBLE PRECISION NOT NULL,
  CONSTRAINT "solicitud_items_solicitud_id_fkey" FOREIGN KEY ("solicitud_id")
    REFERENCES "solicitudes_inventario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  -- RESTRICT: no se borra un insumo que aparece en un pedido; se archiva.
  CONSTRAINT "solicitud_items_insumo_id_fkey" FOREIGN KEY ("insumo_id")
    REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "solicitud_items_solicitud_id_insumo_id_key"
  ON "solicitud_items"("solicitud_id", "insumo_id");
