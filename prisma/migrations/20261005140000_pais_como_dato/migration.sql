-- Separar Bookmy Colombia de Bookmy Espana.
--
-- El pais deja de estar cableado en el codigo y pasa a ser un dato: de el
-- salen la moneda, el huso, los festivos, el documento fiscal y los
-- formatos. Asi el negocio no tiene que elegir nada y anadir un tercer
-- pais no es tocar codigo.
--
-- Escrita a mano porque la que genera Prisma falla sobre datos existentes:
-- anade columnas NOT NULL sin valor previo y castea el enum en vez de
-- renombrarlo.

-- ─────────────────────────────────────────────────────────────
-- 1. `country` pasa de catalogo de banderas a configuracion de mercado
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "country"
  ADD COLUMN "moneda"              VARCHAR(3)  NOT NULL DEFAULT 'EUR',
  ADD COLUMN "decimales_moneda"    INTEGER     NOT NULL DEFAULT 2,
  ADD COLUMN "locale"              VARCHAR(10) NOT NULL DEFAULT 'es-ES',
  ADD COLUMN "precio_minimo"       DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  ADD COLUMN "precio_maximo"       DOUBLE PRECISION NOT NULL DEFAULT 1000,
  ADD COLUMN "zona_horaria"        VARCHAR(64) NOT NULL DEFAULT 'Europe/Madrid',
  ADD COLUMN "etiqueta_fiscal"     VARCHAR(24) NOT NULL DEFAULT 'NIF/CIF',
  ADD COLUMN "etiqueta_region"     VARCHAR(32) NOT NULL DEFAULT 'Provincia',
  ADD COLUMN "etiqueta_municipio"  VARCHAR(32) NOT NULL DEFAULT 'Municipio',
  ADD COLUMN "etiqueta_impuesto"   VARCHAR(24) NOT NULL DEFAULT 'IVA',
  ADD COLUMN "tiene_regiones"      BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN "impuesto_por_defecto" DOUBLE PRECISION NOT NULL DEFAULT 21,
  ADD COLUMN "activo"              BOOLEAN     NOT NULL DEFAULT true;

-- Espana: lo que ya habia, ahora escrito.
UPDATE "country" SET
  "moneda" = 'EUR', "decimales_moneda" = 2, "locale" = 'es-ES',
  "precio_minimo" = 0.5, "precio_maximo" = 1000,
  "zona_horaria" = 'Europe/Madrid',
  "etiqueta_fiscal" = 'NIF/CIF', "etiqueta_region" = 'Provincia',
  "etiqueta_municipio" = 'Municipio', "etiqueta_impuesto" = 'IVA',
  "tiene_regiones" = true, "impuesto_por_defecto" = 21
WHERE "iso_code" = 'ES';

-- Colombia. El peso no usa decimales y el tope de precio sube cuatro
-- ordenes de magnitud: un corte de pelo son unos 45.000 COP.
INSERT INTO "country" (
  "name", "iso_code", "dialing_code",
  "moneda", "decimales_moneda", "locale", "precio_minimo", "precio_maximo",
  "zona_horaria",
  "etiqueta_fiscal", "etiqueta_region", "etiqueta_municipio", "etiqueta_impuesto",
  "tiene_regiones", "impuesto_por_defecto", "activo"
) VALUES (
  'Colombia', 'CO', '+57',
  'COP', 0, 'es-CO', 1000, 50000000,
  'America/Bogota',
  'NIT', 'Departamento', 'Ciudad', 'IVA',
  -- Colombia no tiene festivos regionales: los 18 son nacionales (Ley 51/1983).
  false, 19, true
)
ON CONFLICT ("iso_code") DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 2. El pais del negocio. En tres pasos: sin valor no se puede
--    anadir una columna obligatoria a una tabla con filas.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "empresas" ADD COLUMN "country_id" INTEGER;

-- Todo lo que existe hoy es espanol.
UPDATE "empresas"
   SET "country_id" = (SELECT "id" FROM "country" WHERE "iso_code" = 'ES')
 WHERE "country_id" IS NULL;

ALTER TABLE "empresas" ALTER COLUMN "country_id" SET NOT NULL;
ALTER TABLE "empresas"
  ADD CONSTRAINT "empresas_country_id_fkey"
  FOREIGN KEY ("country_id") REFERENCES "country"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "empresas_country_id_idx" ON "empresas"("country_id");

-- ─────────────────────────────────────────────────────────────
-- 3. La sede: su pais, su region y su huso propio
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "sedes"
  ADD COLUMN "country_id"   INTEGER,
  ADD COLUMN "zona_horaria" VARCHAR(64);

-- `ccaa` pasa a `region`: una comunidad autonoma es una figura espanola y
-- esto tiene que valer para cualquier pais. Se ensancha de 2 a 10 para que
-- quepan codigos ISO 3166-2 de otros paises.
ALTER TABLE "sedes" RENAME COLUMN "ccaa" TO "region";
ALTER TABLE "sedes" ALTER COLUMN "region" TYPE VARCHAR(10);

UPDATE "sedes"
   SET "country_id" = (SELECT "id" FROM "country" WHERE "iso_code" = 'ES')
 WHERE "country_id" IS NULL;

ALTER TABLE "sedes"
  ADD CONSTRAINT "sedes_country_id_fkey"
  FOREIGN KEY ("country_id") REFERENCES "country"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "sedes_country_id_idx" ON "sedes"("country_id");

-- ─────────────────────────────────────────────────────────────
-- 4. Festivos por pais
-- ─────────────────────────────────────────────────────────────

-- El enum se RENOMBRA. Si se recrea casteando, las 37 filas que ya hay
-- con 'AUTONOMICO' revientan la migracion.
ALTER TYPE "AmbitoFestivo" RENAME VALUE 'AUTONOMICO' TO 'REGIONAL';

ALTER TABLE "festivos" RENAME COLUMN "ccaa" TO "region";

-- En Postgres un UNIQUE no restringe filas con NULL, asi que el indice
-- anterior no deduplicaba los nacionales: entraban repetidos. Con cadena
-- vacia si dedupe.
UPDATE "festivos" SET "region"    = '' WHERE "region"    IS NULL;
UPDATE "festivos" SET "municipio" = '' WHERE "municipio" IS NULL;

ALTER TABLE "festivos"
  ALTER COLUMN "region"    SET DEFAULT '',
  ALTER COLUMN "region"    SET NOT NULL,
  ALTER COLUMN "municipio" SET DEFAULT '',
  ALTER COLUMN "municipio" SET NOT NULL;

-- Si quedaron duplicados de antes (el indice viejo no los impedia), se
-- deja el mas antiguo de cada grupo antes de crear el indice bueno.
DELETE FROM "festivos" a
 USING "festivos" b
 WHERE a."id" > b."id"
   AND a."pais" = b."pais" AND a."fecha" = b."fecha"
   AND a."ambito" = b."ambito" AND a."region" = b."region"
   AND a."municipio" = b."municipio";

DROP INDEX IF EXISTS "festivos_fecha_ambito_ccaa_municipio_key";
DROP INDEX IF EXISTS "festivos_fecha_idx";

CREATE UNIQUE INDEX "festivos_pais_fecha_ambito_region_municipio_key"
  ON "festivos"("pais", "fecha", "ambito", "region", "municipio");
CREATE INDEX "festivos_pais_fecha_idx" ON "festivos"("pais", "fecha");
