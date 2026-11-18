-- Revisión de países: nombres de municipio en español (el panel está en
-- español) y Argentina sin decimales (los precios se escriben en pesos enteros).
UPDATE "country" SET "etiqueta_municipio" = 'Municipio' WHERE "iso_code" IN ('BR', 'PT', 'IT');
UPDATE "country" SET "decimales_moneda" = 0 WHERE "iso_code" = 'AR';
