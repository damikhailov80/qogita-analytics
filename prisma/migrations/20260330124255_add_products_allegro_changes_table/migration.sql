-- CreateTable
CREATE TABLE "products_allegro_changes" (
    "id" SERIAL NOT NULL,
    "gtin" VARCHAR(14) NOT NULL,
    "manual_price" DECIMAL(10,2),
    "is_disabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "products_allegro_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_allegro_changes_gtin_key" ON "products_allegro_changes"("gtin");

-- AddForeignKey
ALTER TABLE "products_allegro_changes" ADD CONSTRAINT "products_allegro_changes_product_fkey" FOREIGN KEY ("gtin") REFERENCES "products"("gtin") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products_allegro_changes" ADD CONSTRAINT "products_allegro_changes_allegro_fkey" FOREIGN KEY ("gtin") REFERENCES "products_allegro"("gtin") ON DELETE RESTRICT ON UPDATE CASCADE;
