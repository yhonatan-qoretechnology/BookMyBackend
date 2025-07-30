-- CreateEnum
CREATE TYPE "public"."ClientType" AS ENUM ('people', 'business');

-- CreateEnum
CREATE TYPE "public"."ClientState" AS ENUM ('enabled', 'disabled', 'blocked');

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
    "family_name" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" TEXT NOT NULL,
    "postal_code" VARCHAR(10) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "country_id" INTEGER NOT NULL,

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

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_email_key" ON "public"."user_auth"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_user_id_key" ON "public"."user_auth"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_data_email_key" ON "public"."user_data"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_data_user_id_key" ON "public"."user_data"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "country_iso_code_key" ON "public"."country"("iso_code");

-- CreateIndex
CREATE UNIQUE INDEX "document_type_name_key" ON "public"."document_type"("name");

-- AddForeignKey
ALTER TABLE "public"."user_auth" ADD CONSTRAINT "user_auth_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_data" ADD CONSTRAINT "user_data_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_data" ADD CONSTRAINT "user_data_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_type_by_country" ADD CONSTRAINT "document_type_by_country_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_type_by_country" ADD CONSTRAINT "document_type_by_country_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
