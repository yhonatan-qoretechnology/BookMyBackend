-- CreateTable
CREATE TABLE "public"."_SedeServicios" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_SedeServicios_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_SedeServicios_B_index" ON "public"."_SedeServicios"("B");

-- AddForeignKey
ALTER TABLE "public"."_SedeServicios" ADD CONSTRAINT "_SedeServicios_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_SedeServicios" ADD CONSTRAINT "_SedeServicios_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."servicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
