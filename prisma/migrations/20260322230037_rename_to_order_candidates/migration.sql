-- DropIndex
DROP INDEX IF EXISTS idx_soc_seller;
DROP INDEX IF EXISTS idx_soc_seller_rn;

-- RenameMaterializedView
ALTER MATERIALIZED VIEW seller_order_candidates RENAME TO order_candidates;

-- CreateIndex
CREATE INDEX idx_oc_seller ON order_candidates (seller_code);
CREATE INDEX idx_oc_seller_rn ON order_candidates (seller_code, rn);
