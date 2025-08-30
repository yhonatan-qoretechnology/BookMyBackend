/*
  Warnings:

  - You are about to drop the `Service` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Price" DROP CONSTRAINT "Price_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Service" DROP CONSTRAINT "Service_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceTranslation" DROP CONSTRAINT "ServiceTranslation_serviceId_fkey";

-- DropTable
DROP TABLE "public"."Service";

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
CREATE TABLE "public"."SedeService" (
    "sedeId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,

    CONSTRAINT "SedeService_pkey" PRIMARY KEY ("sedeId","serviceId")
);

-- CreateTable
CREATE TABLE "public"."_ProfesionalToService" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ProfesionalToService_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "servicios_categoryId_idx" ON "public"."servicios"("categoryId");

-- CreateIndex
CREATE INDEX "_ProfesionalToService_B_index" ON "public"."_ProfesionalToService"("B");

-- AddForeignKey
ALTER TABLE "public"."Price" ADD CONSTRAINT "Price_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."servicios" ADD CONSTRAINT "servicios_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SedeService" ADD CONSTRAINT "SedeService_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "public"."sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SedeService" ADD CONSTRAINT "SedeService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceTranslation" ADD CONSTRAINT "ServiceTranslation_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ProfesionalToService" ADD CONSTRAINT "_ProfesionalToService_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."profesionales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ProfesionalToService" ADD CONSTRAINT "_ProfesionalToService_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."servicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
