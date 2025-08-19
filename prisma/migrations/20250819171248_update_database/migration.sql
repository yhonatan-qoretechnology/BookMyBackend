/*
  Warnings:

  - You are about to drop the column `nagenerome` on the `user_data` table. All the data in the column will be lost.
  - Added the required column `gender` to the `user_data` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."user_data" DROP COLUMN "nagenerome",
ADD COLUMN     "birthdate" TIMESTAMP(3),
ADD COLUMN     "gender" VARCHAR(50) NOT NULL;
