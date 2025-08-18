-- CreateTable
CREATE TABLE "public"."user_category" (
    "user_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_category_pkey" PRIMARY KEY ("user_id","category_id")
);

-- AddForeignKey
ALTER TABLE "public"."user_category" ADD CONSTRAINT "user_category_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_category" ADD CONSTRAINT "user_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
