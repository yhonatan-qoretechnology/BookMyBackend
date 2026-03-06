-- Script para corregir URLs de imágenes en la base de datos
-- Elimina el dominio antiguo y deja solo la ruta relativa

UPDATE users
SET "fotoPerfil" = REPLACE("fotoPerfil", 'https://web-3o8dd5nhjvbs.up-de-fra1-k8s-1.apps.run-on-seenode.com/', '')
WHERE "fotoPerfil" LIKE 'https://web-3o8dd5nhjvbs.up-de-fra1-k8s-1.apps.run-on-seenode.com/%';

-- Verificar el resultado
SELECT id, email, "fotoPerfil" FROM users WHERE "fotoPerfil" IS NOT NULL AND "fotoPerfil" != '';
