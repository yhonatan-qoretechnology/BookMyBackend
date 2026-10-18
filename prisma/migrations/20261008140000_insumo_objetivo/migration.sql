-- Cuanto quiere tener el negocio de cada insumo en una sede.
--
-- Sin un objetivo, las existencias nacian con max = 0: la barra de nivel
-- marcaba TODO como critico y el boton de reponer salia siempre apagado,
-- porque se desactiva cuando stock >= max. El modulo nacia inutilizable.
--
-- 10 como valor de partida: un numero redondo y pequeno que el negocio
-- cambia al dar de alta el insumo. Mejor eso que cero, que no significa
-- "no quiero ninguno" sino "nadie lo ha configurado".
ALTER TABLE "insumos"
  ADD COLUMN "max_por_defecto" DOUBLE PRECISION NOT NULL DEFAULT 10;
