-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_ADMIN', 'CLIENT');

-- AlterTable
ALTER TABLE "public"."users"
  ADD COLUMN "role" "public"."Role" NOT NULL DEFAULT 'CLIENT';
