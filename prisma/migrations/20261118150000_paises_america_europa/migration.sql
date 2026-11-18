-- Países: el registro deja elegir cualquiera de estos y el negocio hereda
-- su moneda, decimales, zona horaria, documento fiscal e impuesto.
-- Sus festivos nacionales se sincronizan desde Nager.Date (ver FestivoService).
INSERT INTO "country" (
  "name", "iso_code", "dialing_code",
  "moneda", "decimales_moneda", "locale", "precio_minimo", "precio_maximo",
  "zona_horaria",
  "etiqueta_fiscal", "etiqueta_region", "etiqueta_municipio", "etiqueta_impuesto",
  "tiene_regiones", "impuesto_por_defecto", "activo"
) VALUES
  ('México', 'MX', '+52', 'MXN', 2, 'es-MX', 10, 100000, 'America/Mexico_City', 'RFC', 'Estado', 'Municipio', 'IVA', false, 16, true),
  ('Argentina', 'AR', '+54', 'ARS', 2, 'es-AR', 100, 50000000, 'America/Argentina/Buenos_Aires', 'CUIT', 'Provincia', 'Localidad', 'IVA', false, 21, true),
  ('Chile', 'CL', '+56', 'CLP', 0, 'es-CL', 500, 50000000, 'America/Santiago', 'RUT', 'Región', 'Comuna', 'IVA', false, 19, true),
  ('Perú', 'PE', '+51', 'PEN', 2, 'es-PE', 1, 50000, 'America/Lima', 'RUC', 'Departamento', 'Distrito', 'IGV', false, 18, true),
  ('Ecuador', 'EC', '+593', 'USD', 2, 'es-EC', 0.5, 5000, 'America/Guayaquil', 'RUC', 'Provincia', 'Cantón', 'IVA', false, 15, true),
  ('Venezuela', 'VE', '+58', 'USD', 2, 'es-VE', 0.5, 5000, 'America/Caracas', 'RIF', 'Estado', 'Municipio', 'IVA', false, 16, true),
  ('Bolivia', 'BO', '+591', 'BOB', 2, 'es-BO', 1, 50000, 'America/La_Paz', 'NIT', 'Departamento', 'Municipio', 'IVA', false, 13, true),
  ('Paraguay', 'PY', '+595', 'PYG', 0, 'es-PY', 1000, 50000000, 'America/Asuncion', 'RUC', 'Departamento', 'Ciudad', 'IVA', false, 10, true),
  ('Uruguay', 'UY', '+598', 'UYU', 2, 'es-UY', 10, 500000, 'America/Montevideo', 'RUT', 'Departamento', 'Localidad', 'IVA', false, 22, true),
  ('Costa Rica', 'CR', '+506', 'CRC', 0, 'es-CR', 100, 5000000, 'America/Costa_Rica', 'Cédula jurídica', 'Provincia', 'Cantón', 'IVA', false, 13, true),
  ('Panamá', 'PA', '+507', 'USD', 2, 'es-PA', 0.5, 5000, 'America/Panama', 'RUC', 'Provincia', 'Distrito', 'ITBMS', false, 7, true),
  ('Guatemala', 'GT', '+502', 'GTQ', 2, 'es-GT', 1, 50000, 'America/Guatemala', 'NIT', 'Departamento', 'Municipio', 'IVA', false, 12, true),
  ('Honduras', 'HN', '+504', 'HNL', 2, 'es-HN', 10, 200000, 'America/Tegucigalpa', 'RTN', 'Departamento', 'Municipio', 'ISV', false, 15, true),
  ('El Salvador', 'SV', '+503', 'USD', 2, 'es-SV', 0.5, 5000, 'America/El_Salvador', 'NIT', 'Departamento', 'Municipio', 'IVA', false, 13, true),
  ('Nicaragua', 'NI', '+505', 'NIO', 2, 'es-NI', 10, 200000, 'America/Managua', 'RUC', 'Departamento', 'Municipio', 'IVA', false, 15, true),
  ('República Dominicana', 'DO', '+1', 'DOP', 2, 'es-DO', 10, 300000, 'America/Santo_Domingo', 'RNC', 'Provincia', 'Municipio', 'ITBIS', false, 18, true),
  ('Puerto Rico', 'PR', '+1', 'USD', 2, 'es-PR', 0.5, 5000, 'America/Puerto_Rico', 'EIN', 'Región', 'Municipio', 'IVU', false, 11.5, true),
  ('Estados Unidos', 'US', '+1', 'USD', 2, 'en-US', 0.5, 5000, 'America/New_York', 'EIN', 'Estado', 'Ciudad', 'Sales tax', false, 0, true),
  ('Canadá', 'CA', '+1', 'CAD', 2, 'en-CA', 0.5, 5000, 'America/Toronto', 'BN', 'Provincia', 'Ciudad', 'GST', false, 5, true),
  ('Brasil', 'BR', '+55', 'BRL', 2, 'pt-BR', 1, 50000, 'America/Sao_Paulo', 'CNPJ', 'Estado', 'Município', 'ISS', false, 5, true),
  ('Portugal', 'PT', '+351', 'EUR', 2, 'pt-PT', 0.5, 1000, 'Europe/Lisbon', 'NIF', 'Distrito', 'Concelho', 'IVA', false, 23, true),
  ('Francia', 'FR', '+33', 'EUR', 2, 'fr-FR', 0.5, 1000, 'Europe/Paris', 'SIRET', 'Región', 'Comuna', 'TVA', false, 20, true),
  ('Italia', 'IT', '+39', 'EUR', 2, 'it-IT', 0.5, 1000, 'Europe/Rome', 'Partita IVA', 'Región', 'Comune', 'IVA', false, 22, true),
  ('Alemania', 'DE', '+49', 'EUR', 2, 'de-DE', 0.5, 1000, 'Europe/Berlin', 'USt-IdNr.', 'Estado federado', 'Municipio', 'MwSt', false, 19, true),
  ('Reino Unido', 'GB', '+44', 'GBP', 2, 'en-GB', 0.5, 1000, 'Europe/London', 'VAT number', 'Condado', 'Ciudad', 'VAT', false, 20, true)
ON CONFLICT ("iso_code") DO NOTHING;
