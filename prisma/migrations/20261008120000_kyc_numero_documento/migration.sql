-- El formulario de verificacion pedia el TIPO de documento del
-- responsable (DNI, NIE, Pasaporte...) pero no habia donde escribir su
-- numero, asi que la verificacion llegaba sin el dato que de verdad
-- identifica a la persona.
--
-- Nullable a proposito: las verificaciones ya enviadas no lo tienen y no
-- hay de donde sacarlo.
ALTER TABLE "empresa_kyc" ADD COLUMN "documento_numero" VARCHAR(40);
