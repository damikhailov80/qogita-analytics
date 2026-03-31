-- DropForeignKey
ALTER TABLE "products_allegro_changes" DROP CONSTRAINT "products_allegro_changes_allegro_fkey";

-- RenameForeignKey
ALTER TABLE "products_allegro_changes" RENAME CONSTRAINT "products_allegro_changes_product_fkey" TO "products_allegro_changes_gtin_fkey";
