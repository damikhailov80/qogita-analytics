-- Drop all existing tables and views
DROP MATERIALIZED VIEW IF EXISTS order_candidates CASCADE;
DROP TABLE IF EXISTS "products_allegro_changes" CASCADE;
DROP TABLE IF EXISTS "offers" CASCADE;
DROP TABLE IF EXISTS "products_allegro" CASCADE;
DROP TABLE IF EXISTS "products" CASCADE;
DROP TABLE IF EXISTS "sellers" CASCADE;
DROP TABLE IF EXISTS "worker_logs" CASCADE;
DROP TABLE IF EXISTS "worker_states" CASCADE;

-- CreateTable: products
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "gtin" VARCHAR(14) NOT NULL,
    "name" TEXT NOT NULL,
    "category" VARCHAR(255),
    "brand" VARCHAR(255),
    "lowest_price" DECIMAL(10,2),
    "unit" VARCHAR(50),
    "lowest_priced_offer_inventory" INTEGER,
    "is_pre_order" BOOLEAN NOT NULL DEFAULT false,
    "estimated_delivery_time_weeks" INTEGER,
    "number_of_offers" INTEGER,
    "total_inventory_all_offers" INTEGER,
    "product_url" TEXT,
    "image_url" TEXT,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable: products_allegro
CREATE TABLE "products_allegro" (
    "id" SERIAL NOT NULL,
    "gtin" VARCHAR(14) NOT NULL,
    "sales_quantity" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "products_allegro_pkey" PRIMARY KEY ("id")
);

-- CreateTable: products_allegro_changes
CREATE TABLE "products_allegro_changes" (
    "id" SERIAL NOT NULL,
    "gtin" VARCHAR(14) NOT NULL,
    "manual_price" DECIMAL(10,2),
    "is_disabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "products_allegro_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: sellers
CREATE TABLE "sellers" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "min_order_value" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: offers
CREATE TABLE "offers" (
    "id" SERIAL NOT NULL,
    "gtin" VARCHAR(14) NOT NULL,
    "seller_code" VARCHAR(50) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "price_currency" VARCHAR(3) NOT NULL,
    "inventory" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: worker_logs
CREATE TABLE "worker_logs" (
    "id" SERIAL NOT NULL,
    "worker_type" VARCHAR(50) NOT NULL,
    "job_id" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "logs" TEXT[],
    "result" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: worker_states
CREATE TABLE "worker_states" (
    "id" SERIAL NOT NULL,
    "worker_type" VARCHAR(50) NOT NULL,
    "job_id" VARCHAR(100) NOT NULL,
    "state" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_gtin_key" ON "products"("gtin");
CREATE UNIQUE INDEX "products_allegro_gtin_key" ON "products_allegro"("gtin");
CREATE UNIQUE INDEX "products_allegro_changes_gtin_key" ON "products_allegro_changes"("gtin");
CREATE UNIQUE INDEX "sellers_code_key" ON "sellers"("code");
CREATE UNIQUE INDEX "offers_gtin_seller_code_key" ON "offers"("gtin", "seller_code");
CREATE UNIQUE INDEX "worker_states_job_id_key" ON "worker_states"("job_id");

CREATE INDEX "offers_gtin_idx" ON "offers"("gtin");
CREATE INDEX "offers_seller_code_idx" ON "offers"("seller_code");
CREATE INDEX "worker_logs_worker_type_created_at_idx" ON "worker_logs"("worker_type", "created_at");
CREATE INDEX "worker_states_worker_type_updated_at_idx" ON "worker_states"("worker_type", "updated_at");

-- AddForeignKey
ALTER TABLE "products_allegro" ADD CONSTRAINT "products_allegro_gtin_fkey" FOREIGN KEY ("gtin") REFERENCES "products"("gtin") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products_allegro_changes" ADD CONSTRAINT "products_allegro_changes_product_fkey" FOREIGN KEY ("gtin") REFERENCES "products"("gtin") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products_allegro_changes" ADD CONSTRAINT "products_allegro_changes_allegro_fkey" FOREIGN KEY ("gtin") REFERENCES "products_allegro"("gtin") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offers" ADD CONSTRAINT "offers_gtin_fkey" FOREIGN KEY ("gtin") REFERENCES "products"("gtin") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offers" ADD CONSTRAINT "offers_seller_code_fkey" FOREIGN KEY ("seller_code") REFERENCES "sellers"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateMaterializedView: order_candidates
CREATE MATERIALIZED VIEW order_candidates AS
WITH base AS (
  SELECT 
    o.seller_code,
    o.gtin,
    p.brand,
    o.price AS buy_price,
    -- Use manual_price from changes if available, otherwise use original price
    COALESCE(pac.manual_price, pa.price) AS sell_price,
    (COALESCE(pac.manual_price, pa.price) - o.price) AS unit_profit,
    CASE 
      WHEN o.price > 0 THEN ((COALESCE(pac.manual_price, pa.price) - o.price) / o.price) * 100
      ELSE 0
    END AS profit_ratio,
    o.inventory,
    s.min_order_value,
    -- Calculate total_cost limited by constant 300
    CASE 
      WHEN (o.price * o.inventory) > 300 
      THEN 300
      ELSE (o.price * o.inventory)
    END AS total_cost,
    -- Calculate total_profit based on limited total_cost
    CASE 
      WHEN (o.price * o.inventory) > 300 
      THEN (COALESCE(pac.manual_price, pa.price) - o.price) * (300 / o.price)
      ELSE (COALESCE(pac.manual_price, pa.price) - o.price) * o.inventory
    END AS total_profit
  FROM offers o
  JOIN products p ON p.gtin = o.gtin
  JOIN products_allegro pa ON pa.gtin = o.gtin
  LEFT JOIN products_allegro_changes pac ON pac.gtin = o.gtin
  JOIN sellers s ON s.code = o.seller_code
  -- Exclude disabled products
  WHERE COALESCE(pac.is_disabled, false) = false
),
ranked AS (
  SELECT 
    b.*,
    ROW_NUMBER() OVER (
      PARTITION BY seller_code
      ORDER BY unit_profit DESC
    ) AS rn
  FROM base b
),
accumulated AS (
  SELECT 
    r.*,
    SUM(total_cost) OVER (
      PARTITION BY seller_code
      ORDER BY rn
    ) AS cumulative_cost,
    SUM(total_profit) OVER (
      PARTITION BY seller_code
      ORDER BY rn
    ) AS cumulative_profit
  FROM ranked r
)
SELECT 
  a.seller_code,
  a.gtin,
  a.brand,
  a.buy_price,
  a.sell_price,
  a.unit_profit,
  a.profit_ratio,
  a.inventory,
  a.total_cost,
  a.total_profit,
  a.rn,
  a.cumulative_cost,
  a.cumulative_profit,
  a.min_order_value
FROM accumulated a;

-- CreateIndex for materialized view
CREATE INDEX idx_oc_seller ON order_candidates (seller_code);
CREATE INDEX idx_oc_seller_rn ON order_candidates (seller_code, rn);
