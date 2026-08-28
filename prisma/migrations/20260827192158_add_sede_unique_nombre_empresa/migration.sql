-- Evita sedes duplicadas (mismo nombre + misma empresa). Antes no había
-- ningún constraint real: SedeService.create() atrapaba un P2002 que nunca
-- se disparaba, así que un doble llamado a /seed/seedSedes (o cualquier
-- create/update repetido) insertaba filas repetidas sin aviso.
CREATE UNIQUE INDEX "sedes_nombre_empresaId_key" ON "sedes"("nombre", "empresaId");
