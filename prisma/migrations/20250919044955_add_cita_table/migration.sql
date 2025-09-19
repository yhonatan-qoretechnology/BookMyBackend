-- CreateEnum
CREATE TYPE "public"."ClientType" AS ENUM ('people', 'business');

-- CreateEnum
CREATE TYPE "public"."ClientState" AS ENUM ('enabled', 'disabled', 'blocked');

-- CreateEnum
CREATE TYPE "public"."ResenaState" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "public"."ResenaType" AS ENUM ('SEDE', 'SERVICIO');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "client_type" "public"."ClientType" NOT NULL DEFAULT 'people',
    "state" "public"."ClientState" NOT NULL DEFAULT 'disabled',
    "accept_terms" BOOLEAN NOT NULL DEFAULT false,
    "accept_polits" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_auth" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "user_auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_data" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "country_id" INTEGER NOT NULL,
    "idioma" VARCHAR(50) NOT NULL,
    "gender" VARCHAR(50) NOT NULL,
    "birthdate" TIMESTAMP(3),

    CONSTRAINT "user_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."country" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "iso_code" CHAR(2) NOT NULL,
    "flag_url" TEXT,
    "dialing_code" VARCHAR(10) NOT NULL,

    CONSTRAINT "country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_type" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "acronym" TEXT NOT NULL,
    "type" "public"."ClientType" NOT NULL DEFAULT 'people',

    CONSTRAINT "document_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_type_by_country" (
    "country_id" INTEGER NOT NULL,
    "document_type_id" INTEGER NOT NULL,

    CONSTRAINT "document_type_by_country_pkey" PRIMARY KEY ("country_id","document_type_id")
);

-- CreateTable
CREATE TABLE "public"."Otp" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Category" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."category_translation" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "category_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Price" (
    "id" SERIAL NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',

    CONSTRAINT "Price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_category" (
    "user_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_category_pkey" PRIMARY KEY ("user_id","category_id")
);

-- CreateTable
CREATE TABLE "public"."user_locations" (
    "id" SERIAL NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "user_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."empresas" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "nit" TEXT,
    "logo_url" TEXT,
    "descripcion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sedes" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "telefono" TEXT,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "provincia" TEXT,
    "horario" JSONB,
    "diasCerrado" JSONB,
    "imagenes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "empresaId" INTEGER NOT NULL,

    CONSTRAINT "sedes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."profesionales" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "biografia" TEXT,
    "imagen" TEXT,
    "phone" VARCHAR(20) NOT NULL,
    "state" "public"."ClientState" NOT NULL DEFAULT 'enabled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sedeId" INTEGER NOT NULL,

    CONSTRAINT "profesionales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."resenas" (
    "id" SERIAL NOT NULL,
    "calificacion" DOUBLE PRECISION NOT NULL,
    "comentario" TEXT,
    "aprobado" BOOLEAN NOT NULL DEFAULT false,
    "estado" "public"."ResenaState" NOT NULL,
    "tipo" "public"."ResenaType" NOT NULL,
    "sedeId" INTEGER,
    "serviceId" INTEGER,
    "usuarioId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resenas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."galerias" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sedeId" INTEGER NOT NULL,

    CONSTRAINT "galerias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."servicios" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "imagenes" TEXT[],

    CONSTRAINT "servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceTranslation" (
    "id" SERIAL NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "ServiceTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."service_sede_profesional" (
    "id" SERIAL NOT NULL,
    "sedeId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "profesionalId" INTEGER,

    CONSTRAINT "service_sede_profesional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Appointment" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sedeId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "profesionalId" INTEGER NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_ProfesionalToService" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ProfesionalToService_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_email_key" ON "public"."user_auth"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_user_id_key" ON "public"."user_auth"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_data_phone_key" ON "public"."user_data"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "user_data_email_key" ON "public"."user_data"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_data_user_id_key" ON "public"."user_data"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "country_iso_code_key" ON "public"."country"("iso_code");

-- CreateIndex
CREATE UNIQUE INDEX "document_type_name_key" ON "public"."document_type"("name");

-- CreateIndex
CREATE INDEX "category_translation_language_idx" ON "public"."category_translation"("language");

-- CreateIndex
CREATE UNIQUE INDEX "category_translation_categoryId_language_key" ON "public"."category_translation"("categoryId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "user_locations_user_id_key" ON "public"."user_locations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_nombre_key" ON "public"."empresas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "profesionales_phone_key" ON "public"."profesionales"("phone");

-- CreateIndex
CREATE INDEX "resenas_sedeId_idx" ON "public"."resenas"("sedeId");

-- CreateIndex
CREATE INDEX "resenas_serviceId_idx" ON "public"."resenas"("serviceId");

-- CreateIndex
CREATE INDEX "servicios_categoryId_idx" ON "public"."servicios"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "service_sede_profesional_sedeId_serviceId_profesionalId_key" ON "public"."service_sede_profesional"("sedeId", "serviceId", "profesionalId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_profesionalId_fecha_hora_key" ON "public"."Appointment"("profesionalId", "fecha", "hora");

-- CreateIndex
CREATE INDEX "_ProfesionalToService_B_index" ON "public"."_ProfesionalToService"("B");

-- AddForeignKey
ALTER TABLE "public"."user_auth" ADD CONSTRAINT "user_auth_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_data" ADD CONSTRAINT "user_data_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_data" ADD CONSTRAINT "user_data_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_type_by_country" ADD CONSTRAINT "document_type_by_country_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_type_by_country" ADD CONSTRAINT "document_type_by_country_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."category_translation" ADD CONSTRAINT "category_translation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Price" ADD CONSTRAINT "Price_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_category" ADD CONSTRAINT "user_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_category" ADD CONSTRAINT "user_category_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_locations" ADD CONSTRAINT "user_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sedes" ADD CONSTRAINT "sedes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."profesionales" ADD CONSTRAINT "profesionales_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "public"."sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resenas" ADD CONSTRAINT "resenas_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "public"."sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resenas" ADD CONSTRAINT "resenas_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."servicios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resenas" ADD CONSTRAINT "resenas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."galerias" ADD CONSTRAINT "galerias_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "public"."sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."servicios" ADD CONSTRAINT "servicios_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceTranslation" ADD CONSTRAINT "ServiceTranslation_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."service_sede_profesional" ADD CONSTRAINT "service_sede_profesional_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "public"."sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."service_sede_profesional" ADD CONSTRAINT "service_sede_profesional_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."service_sede_profesional" ADD CONSTRAINT "service_sede_profesional_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "public"."profesionales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "public"."sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "public"."profesionales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ProfesionalToService" ADD CONSTRAINT "_ProfesionalToService_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."profesionales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ProfesionalToService" ADD CONSTRAINT "_ProfesionalToService_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."servicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
