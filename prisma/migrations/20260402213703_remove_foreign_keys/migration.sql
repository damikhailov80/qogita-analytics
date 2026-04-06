-- Drop foreign key constraints from products_allegro and products_allegro_changes
-- This allows independent deletion of data without cascading

-- Drop foreign key from products_allegro
ALTER TABLE "products_allegro" DROP CONSTRAINT IF EXISTS "products_allegro_gtin_fkey";

-- Drop foreign key from products_allegro_changes
ALTER TABLE "products_allegro_changes" DROP CONSTRAINT IF EXISTS "products_allegro_changes_gtin_fkey";

-- Drop foreign key from offers
ALTER TABLE "offers" DROP CONSTRAINT IF EXISTS "offers_gtin_fkey";
