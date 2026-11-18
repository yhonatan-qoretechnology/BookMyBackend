-- Campañas: hasta 2 imágenes adjuntas (máx. 100 KB cada una).
ALTER TABLE "campanas_clientes" ADD COLUMN "imagenes" JSONB;

-- Empresas: colores del panel elegidos por el negocio.
ALTER TABLE "empresas" ADD COLUMN "tema_panel" JSONB;
