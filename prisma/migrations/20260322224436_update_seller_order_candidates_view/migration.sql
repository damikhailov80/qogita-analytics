-- DropMaterializedView: seller_order_candidates
DROP MATERIALIZED VIEW IF EXISTS seller_order_candidates;

-- CreateMaterializedView: seller_order_candidates (updated with profit_ratio)
CREATE MATERIALIZED VIEW seller_order_candidates AS
WITH base AS (
  SELECT
    o.seller_code,
    o.gtin,
    o.price AS buy_price,
    pa.price AS sell_price,
    (pa.price - o.price) AS unit_profit,
    -- 🔥 новая метрика
    CASE 
      WHEN o.price > 0 THEN (pa.price - o.price) / o.price 
      ELSE 0 
    END AS profit_ratio,
    o.inventory,
    (o.price * o.inventory) AS total_cost,
    ((pa.price - o.price) * o.inventory) AS total_profit
  FROM offers o
  JOIN products_allegro pa ON pa.gtin = o.gtin
),
ranked AS (
  SELECT
    b.*,
    ROW_NUMBER() OVER (
      PARTITION BY seller_code
      ORDER BY profit_ratio DESC,   -- 🔥 главный критерий
               unit_profit DESC     -- fallback
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
  a.*,
  s.min_order_value,
  (a.cumulative_cost >= s.min_order_value) AS reached_min_order,
  (a.cumulative_profit < 0) AS is_unprofitable
FROM accumulated a
JOIN sellers s ON s.code = a.seller_code;

-- CreateIndex
CREATE INDEX idx_soc_seller ON seller_order_candidates (seller_code);

-- CreateIndex
CREATE INDEX idx_soc_seller_rn ON seller_order_candidates (seller_code, rn);
