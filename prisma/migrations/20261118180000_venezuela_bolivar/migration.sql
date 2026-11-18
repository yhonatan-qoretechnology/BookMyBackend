-- Venezuela: la moneda oficial es el bolívar (VES), no el dólar.
-- Importes en bolívares: el rango de precio sube acorde.
UPDATE "country" SET
  "moneda" = 'VES', "decimales_moneda" = 2, "locale" = 'es-VE',
  "precio_minimo" = 10, "precio_maximo" = 50000000
WHERE "iso_code" = 'VE';
