-- AlterTable
ALTER TABLE "public"."profesionales" ADD COLUMN     "state" "public"."ClientState" NOT NULL DEFAULT 'enabled';
