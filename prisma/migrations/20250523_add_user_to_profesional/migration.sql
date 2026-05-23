-- AddColumn user_id to Profesional
ALTER TABLE "profesionales" ADD COLUMN "user_id" INTEGER UNIQUE;

-- AddForeignKey Profesional.user_id to Users.id
ALTER TABLE "profesionales" ADD CONSTRAINT "profesionales_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create index for performance
CREATE INDEX "profesionales_user_id_idx" ON "profesionales"("user_id");
