-- CreateMaterializedView: seller_order_candidates
CREATE MATERIALIZED VIEW seller_order_candidates AS
WITH base AS (
  SELECT 
    o.seller_code,
    o.gtin,
    o.price AS buy_price,
    pa.price AS sell_price,
    (pa.price - o.price) AS unit_profit,
    o.inventory, -- сколько максимум можем закупить
    (o.price * o.inventory) AS total_cost,
    ((pa.price - o.price) * o.inventory) AS total_profit
  FROM offers o
  JOIN products_allegro pa ON pa.gtin = o.gtin
),
ranked AS (
  SELECT 
    b.*,
    -- сортировка внутри seller
    ROW_NUMBER() OVER (
      PARTITION BY seller_code
      ORDER BY unit_profit DESC
    ) AS rn
  FROM base b
),
accumulated AS (
  SELECT 
    r.*,
    -- накопительная стоимость корзины
    SUM(total_cost) OVER (
      PARTITION BY seller_code
      ORDER BY rn
    ) AS cumulative_cost,
    -- накопительная прибыль
    SUM(total_profit) OVER (
      PARTITION BY seller_code
      ORDER BY rn
    ) AS cumulative_profit
  FROM ranked r
)
SELECT 
  a.*,
  s.min_order_value,
  -- флаг: достигли минимального заказа
  (a.cumulative_cost >= s.min_order_value) AS reached_min_order,
  -- флаг: корзина уже убыточна
  (a.cumulative_profit < 0) AS is_unprofitable
FROM accumulated a
JOIN sellers s ON s.code = a.seller_code;

-- CreateIndex
CREATE INDEX idx_soc_seller ON seller_order_candidates (seller_code);

-- CreateIndex
CREATE INDEX idx_soc_seller_rn ON seller_order_candidates (seller_code, rn);
