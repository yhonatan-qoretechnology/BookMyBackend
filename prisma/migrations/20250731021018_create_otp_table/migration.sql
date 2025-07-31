/*
  Warnings:

  - You are about to drop the column `family_name` on the `user_data` table. All the data in the column will be lost.
  - You are about to drop the column `postal_code` on the `user_data` table. All the data in the column will be lost.
  - Added the required column `idioma` to the `user_data` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nagenerome` to the `user_data` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."user_data" DROP COLUMN "family_name",
DROP COLUMN "postal_code",
ADD COLUMN     "idioma" VARCHAR(50) NOT NULL,
ADD COLUMN     "nagenerome" VARCHAR(50) NOT NULL;

-- CreateTable
CREATE TABLE "public"."Otp" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);
