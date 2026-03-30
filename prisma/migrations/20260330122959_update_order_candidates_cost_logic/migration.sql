-- Drop existing materialized view
DROP MATERIALIZED VIEW IF EXISTS order_candidates CASCADE;

-- Recreate materialized view with updated cost logic
CREATE MATERIALIZED VIEW order_candidates AS
WITH base AS (
  SELECT 
    o.seller_code,
    o.gtin,
    o.price AS buy_price,
    pa.price AS sell_price,
    (pa.price - o.price) AS unit_profit,
    CASE 
      WHEN o.price > 0 THEN ((pa.price - o.price) / o.price) * 100
      ELSE 0
    END AS profit_ratio,
    o.inventory,
    s.min_order_value,
    -- Calculate total_cost limited by constant 1000
    CASE 
      WHEN (o.price * o.inventory) > 1000 
      THEN 1000
      ELSE (o.price * o.inventory)
    END AS total_cost,
    -- Calculate total_profit based on limited total_cost
    CASE 
      WHEN (o.price * o.inventory) > 1000 
      THEN (pa.price - o.price) * (1000 / o.price)
      ELSE (pa.price - o.price) * o.inventory
    END AS total_profit
  FROM offers o
  JOIN products_allegro pa ON pa.gtin = o.gtin
  JOIN sellers s ON s.code = o.seller_code
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
  a.min_order_value,
  (a.cumulative_cost >= a.min_order_value) AS reached_min_order,
  (a.cumulative_profit < 0) AS is_unprofitable
FROM accumulated a;

-- Recreate indexes
CREATE INDEX idx_oc_seller ON order_candidates (seller_code);
CREATE INDEX idx_oc_seller_rn ON order_candidates (seller_code, rn);
