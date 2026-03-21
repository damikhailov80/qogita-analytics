-- CreateTable
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

-- CreateTable
CREATE TABLE "products_allegro" (
    "id" SERIAL NOT NULL,
    "gtin" VARCHAR(14) NOT NULL,
    "sales_quantity" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "products_allegro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "sellers" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "min_order_value" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "products_allegro_gtin_key" ON "products_allegro"("gtin");

-- CreateIndex
CREATE INDEX "worker_logs_worker_type_created_at_idx" ON "worker_logs"("worker_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_code_key" ON "sellers"("code");

-- CreateIndex
CREATE INDEX "offers_gtin_idx" ON "offers"("gtin");

-- CreateIndex
CREATE INDEX "offers_seller_code_idx" ON "offers"("seller_code");

-- CreateIndex
CREATE UNIQUE INDEX "offers_gtin_seller_code_key" ON "offers"("gtin", "seller_code");

-- CreateIndex
CREATE UNIQUE INDEX "worker_states_job_id_key" ON "worker_states"("job_id");

-- CreateIndex
CREATE INDEX "worker_states_worker_type_updated_at_idx" ON "worker_states"("worker_type", "updated_at");

-- AddForeignKey
ALTER TABLE "products_allegro" ADD CONSTRAINT "products_allegro_gtin_fkey" FOREIGN KEY ("gtin") REFERENCES "products"("gtin") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_gtin_fkey" FOREIGN KEY ("gtin") REFERENCES "products"("gtin") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_seller_code_fkey" FOREIGN KEY ("seller_code") REFERENCES "sellers"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
