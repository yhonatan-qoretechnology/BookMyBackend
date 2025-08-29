/*
  Warnings:

  - A unique constraint covering the columns `[phone]` on the table `user_data` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "user_data_phone_key" ON "public"."user_data"("phone");
