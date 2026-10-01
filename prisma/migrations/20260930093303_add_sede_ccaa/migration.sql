-- Código de comunidad autónoma (ISO 3166-2:ES) de la sede, para resolver
-- correctamente los festivos AUTONOMICO. Antes FestivoService asumía 'AN'
-- (Andalucía) para cualquier sede sin importar dónde estuviera.
ALTER TABLE "sedes" ADD COLUMN     "ccaa" VARCHAR(2);
