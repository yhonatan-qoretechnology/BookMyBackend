-- Auditoría de login (IP, país/región/ciudad, dispositivo) para la
-- pantalla de "Seguimiento y Control" en SUPER_ADMIN. Solo lectura, nunca
-- condiciona el login en sí — ver AccesoUsuarioService.registrar().
CREATE TABLE "accesos_usuario" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "email" TEXT NOT NULL,
    "exito" BOOLEAN NOT NULL DEFAULT false,
    "motivo_fallo" TEXT,
    "ip_address" TEXT NOT NULL,
    "pais" TEXT,
    "region" TEXT,
    "ciudad" TEXT,
    "user_agent" TEXT,
    "dispositivo" TEXT,
    "navegador" TEXT,
    "sistema_operativo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accesos_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accesos_usuario_user_id_idx" ON "accesos_usuario"("user_id");

-- CreateIndex
CREATE INDEX "accesos_usuario_email_idx" ON "accesos_usuario"("email");

-- CreateIndex
CREATE INDEX "accesos_usuario_created_at_idx" ON "accesos_usuario"("created_at");

-- AddForeignKey
ALTER TABLE "accesos_usuario" ADD CONSTRAINT "accesos_usuario_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
