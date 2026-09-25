-- ============================================================
-- Retoques de la cuenta demo de Bookmy Free que no se pueden hacer por API.
--
-- Se pasa DESPUES de scripts/seed-demo-free.mjs:
--   psql "$DATABASE_URL" -v empresa=<id de la empresa demo> -f scripts/seed-demo-free.sql
--
-- 1. Fecha con la que nacieron cita, pago y resena: por API todo queda
--    creado hoy, y el KPI "ingresos del mes" del dashboard (que mira
--    payments.createdAt) se comeria el historico entero en el mes en curso.
-- 2. Vistas del catalogo repartidas por los ultimos 90 dias y entre los
--    clientes demo: el endpoint deduplica por usuario y ficha cada 30
--    minutos (a proposito), asi que un historico solo se puede sembrar aqui.
-- ============================================================

\if :{?empresa} \else \set empresa 0 \endif

BEGIN;

UPDATE "Appointment" a
   SET "createdAt" = a."horaInicio" - interval '3 days',
       "updatedAt" = a."horaInicio" - interval '3 days'
  FROM sedes s
 WHERE s.id = a."sedeId" AND s."empresaId" = :empresa;

UPDATE payments p
   SET "createdAt" = a."createdAt", "updatedAt" = a."createdAt"
  FROM "Appointment" a
  JOIN sedes s ON s.id = a."sedeId"
 WHERE p."appointmentId" = a.id AND s."empresaId" = :empresa;

UPDATE resenas r
   SET "createdAt" = sub.fin + interval '1 day',
       "updatedAt" = sub.fin + interval '1 day'
  FROM (
    SELECT r2.id, max(a."horaFin") AS fin
      FROM resenas r2
      JOIN "Appointment" a ON a."userId" = r2."usuarioId"
                          AND a."sedeId" = r2."sedeId"
                          AND a."serviceId" = r2."serviceId"
                          AND a.estado = 'COMPLETED'
      JOIN sedes s ON s.id = r2."sedeId"
     WHERE s."empresaId" = :empresa
     GROUP BY r2.id
  ) sub
 WHERE r.id = sub.id;

WITH clientes AS (
  SELECT u.id, row_number() OVER (ORDER BY u.id) AS rn, count(*) OVER () AS n
    FROM users u
    JOIN "Appointment" a ON a."userId" = u.id
    JOIN sedes s ON s.id = a."sedeId"
   WHERE s."empresaId" = :empresa
   GROUP BY u.id
), sedes_demo AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn, count(*) OVER () AS n
    FROM sedes WHERE "empresaId" = :empresa
), profes AS (
  SELECT p.id, row_number() OVER (ORDER BY p.id) AS rn, count(*) OVER () AS n
    FROM profesionales p JOIN sedes s ON s.id = p."sedeId" WHERE s."empresaId" = :empresa
), servicios_demo AS (
  SELECT DISTINCT sv.id, row_number() OVER (ORDER BY sv.id) AS rn, count(*) OVER () AS n
    FROM servicios sv
    JOIN "_SedeServicios" ss ON ss."B" = sv.id
    JOIN sedes s ON s.id = ss."A"
   WHERE s."empresaId" = :empresa
), serie AS (SELECT generate_series(1, 320) AS i)
INSERT INTO entity_views (entity_type, entity_id, user_id, empresa_id, sede_id, city, created_at)
SELECT
  CASE WHEN i % 10 < 5 THEN 'SERVICIO' WHEN i % 10 < 7 THEN 'SEDE'
       WHEN i % 10 < 9 THEN 'PROFESIONAL' ELSE 'EMPRESA' END::"ViewEntityType",
  CASE WHEN i % 10 < 5 THEN (SELECT id FROM servicios_demo WHERE rn = (i % n) + 1)
       WHEN i % 10 < 7 THEN (SELECT id FROM sedes_demo WHERE rn = (i % n) + 1)
       WHEN i % 10 < 9 THEN (SELECT id FROM profes WHERE rn = (i % n) + 1)
       ELSE :empresa END,
  (SELECT id FROM clientes WHERE rn = (i % n) + 1),
  :empresa,
  (SELECT id FROM sedes_demo WHERE rn = (i % n) + 1),
  (ARRAY['Malaga','Benalmadena','Torremolinos','Fuengirola','Marbella'])[(i % 5) + 1],
  now() - ((i * 7) % 90 || ' days')::interval - ((i * 13) % 24 || ' hours')::interval
  FROM serie;

COMMIT;
