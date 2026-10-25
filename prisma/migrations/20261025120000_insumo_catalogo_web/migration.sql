-- Catalogo web: los insumos de un negocio pueden salir en su propia web.
--
-- QORE Technology vende en su web lo mismo que lleva en el inventario de
-- Bookmy. En vez de mantener el catalogo dos veces, la web lo lee de aqui
-- (GET /catalogo-web/:empresaId): un insumo sale cuando el negocio lo
-- publica, con sus fotos, su ficha y el stock de todas sus sedes.
--
-- Todas las columnas son opcionales o llevan valor por defecto: los insumos
-- que ya existen se quedan como estaban y SIN publicar, y el backend de antes
-- sigue funcionando con ellas puestas. Por eso se aplica ANTES de desplegar
-- el codigo nuevo, que las pide en cada consulta del inventario.
--
-- Escrita a mano e idempotente (ADD COLUMN IF NOT EXISTS) porque en
-- produccion se aplica con scripts/aplicar-migracion-catalogo-web.sh, y
-- volver a ejecutarla no cambia nada.
ALTER TABLE "insumos"
  ADD COLUMN IF NOT EXISTS "publicado_web"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "subcategoria"      VARCHAR(60),
  ADD COLUMN IF NOT EXISTS "marca"             VARCHAR(60),
  -- "Nuevo", "Top" u "Oferta": lo valida el API.
  ADD COLUMN IF NOT EXISTS "etiqueta"          VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "descripcion"       VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "descripcion_larga" TEXT,
  -- La primera es la principal.
  ADD COLUMN IF NOT EXISTS "imagenes"          TEXT[] DEFAULT ARRAY[]::TEXT[],
  -- Lista de pares [etiqueta, valor].
  ADD COLUMN IF NOT EXISTS "especificaciones"  JSONB,
  ADD COLUMN IF NOT EXISTS "con_variantes"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "orden_web"         INTEGER;
