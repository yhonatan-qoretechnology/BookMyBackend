-- Login con huella / Face ID desde la app movil: un token largo por
-- telefono (solo su hash) que se cambia por un JWT. Ver BiometricService.
CREATE TABLE "biometric_devices" (
    "id" SERIAL NOT NULL,
    "user_auth_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "credential_stamp" TEXT NOT NULL,
    "device_name" VARCHAR(120),
    "platform" VARCHAR(20),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biometric_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "biometric_devices_token_hash_key" ON "biometric_devices"("token_hash");

-- CreateIndex
CREATE INDEX "biometric_devices_user_auth_id_idx" ON "biometric_devices"("user_auth_id");

-- AddForeignKey
ALTER TABLE "biometric_devices" ADD CONSTRAINT "biometric_devices_user_auth_id_fkey" FOREIGN KEY ("user_auth_id") REFERENCES "user_auth"("id") ON DELETE CASCADE ON UPDATE CASCADE;
