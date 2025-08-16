/*
  Warnings:

  - You are about to drop the `Service` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `service_translation` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[categoryId,language]` on the table `category_translation` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Service" DROP CONSTRAINT "Service_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."service_translation" DROP CONSTRAINT "service_translation_serviceId_fkey";

-- DropTable
DROP TABLE "public"."Service";

-- DropTable
DROP TABLE "public"."service_translation";

-- CreateIndex
CREATE INDEX "category_translation_language_idx" ON "public"."category_translation"("language");

-- CreateIndex
CREATE UNIQUE INDEX "category_translation_categoryId_language_key" ON "public"."category_translation"("categoryId", "language");
