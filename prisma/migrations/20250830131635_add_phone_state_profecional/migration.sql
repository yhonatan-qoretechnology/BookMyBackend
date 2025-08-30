/*
  Warnings:

  - You are about to drop the column `especialidad` on the `profesionales` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[phone]` on the table `profesionales` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `phone` to the `profesionales` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."profesionales" DROP COLUMN "especialidad",
ADD COLUMN     "phone" VARCHAR(20) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "profesionales_phone_key" ON "public"."profesionales"("phone");
