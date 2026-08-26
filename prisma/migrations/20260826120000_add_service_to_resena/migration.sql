-- Reseñas por servicio.
--
-- Hasta ahora una reseña solo guardaba la sede, así que no se podía saber qué
-- servicio había valorado el usuario ni impedir que reseñara el mismo dos
-- veces. La columna es NULL-able a propósito: las reseñas de tipo SEDE no
-- llevan servicio y las filas que ya existen no lo tienen.
ALTER TABLE "resenas" ADD COLUMN "serviceId" INTEGER;

CREATE INDEX "resenas_serviceId_idx" ON "resenas"("serviceId");

-- La app consulta "¿ya reseñó este usuario este servicio en esta sede?" cada
-- vez que se abre Mis reservas; sin este índice sería un recorrido completo.
CREATE INDEX "resenas_usuarioId_sedeId_serviceId_idx" ON "resenas"("usuarioId", "sedeId", "serviceId");

ALTER TABLE "resenas"
  ADD CONSTRAINT "resenas_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "servicios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
