-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — campaniile pe grupe de produse, făcute de om
-- Run this in Supabase SQL Editor (aplicată prin MCP pe 28.10.2026)
--
-- Omul își face campanii pe o categorie, un brand, un interval de preț,
-- produsele cu reducere sau produse alese de el. Fiecare grupă are campania
-- ei în Google Ads. Un produs stă într-o singură grupă, iar ce nu e în nicio
-- grupă rămâne în campania principală. Vezi docs/campanii/SPECIFICATIE.md §13.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Grupele
CREATE TABLE IF NOT EXISTS ad_product_groups (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id       uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  -- { categories, brands, price_min, price_max, on_sale, include, exclude }
  rules          jsonb NOT NULL DEFAULT '{}'::jsonb,
  goal           text NOT NULL DEFAULT 'balanced' CHECK (goal IN ('growth', 'balanced', 'profit')),
  -- null = bugetul propus de Hontrio
  daily_budget   numeric(12,2) CHECK (daily_budget IS NULL OR daily_budget > 0),
  campaign_type  text NOT NULL DEFAULT 'auto' CHECK (campaign_type IN ('auto', 'shopping', 'performance_max')),
  -- Perioada, în fusul orar al contului Google Ads (campania se oprește singură la final)
  starts_on      date,
  ends_on        date,
  position       integer NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'ended')),
  -- Grupele lansate mai devreme își păstrează produsele când se suprapun cu altele
  launched_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_product_groups_period CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS idx_ad_product_groups_store ON ad_product_groups (store_id, status, position);
ALTER TABLE ad_product_groups ENABLE ROW LEVEL SECURITY;

-- 2. Campania Google a grupei (după trecerea la Performance Max, și cea nouă)
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS product_group_id uuid REFERENCES ad_product_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_group ON ad_campaigns (product_group_id) WHERE product_group_id IS NOT NULL;

-- 3. Vânzările aduse de Google Ads, pe ofertă (gclid sau UTM, ca la commerce_order_economics):
--    câte conversii are o grupă înainte să aibă campania ei
CREATE OR REPLACE FUNCTION public.commerce_offer_google_sales(p_store_id uuid, p_since timestamptz)
RETURNS TABLE (offer_id text, units numeric, revenue numeric, orders bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT l.offer_id,
         sum(l.quantity)                 AS units,
         sum(l.quantity * l.unit_price)  AS revenue,
         count(DISTINCT l.order_id)      AS orders
  FROM commerce_order_lines l
  JOIN commerce_orders o ON o.id = l.order_id
  WHERE l.store_id = p_store_id
    AND o.store_id = p_store_id
    AND l.offer_id IS NOT NULL
    AND NOT l.is_extra
    AND o.channel = 'store'
    AND o.state NOT IN ('cancelled', 'refunded')
    AND o.placed_at >= p_since
    AND (o.gclid IS NOT NULL
      OR (lower(coalesce(o.utm_source, '')) IN ('google', 'adwords')
          AND lower(coalesce(o.utm_medium, '')) IN ('cpc', 'ppc', 'paid', 'paidsearch', 'paid_search', 'shopping', 'pmax')))
  GROUP BY l.offer_id
$$;

REVOKE ALL ON FUNCTION public.commerce_offer_google_sales(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_offer_google_sales(uuid, timestamptz) TO service_role;

-- 4. Cifrele Google pe produs, din toate campaniile Shopping și Performance Max ale contului,
--    adunate pe o perioadă (shopping_performance_view, din cronul pilotului)
CREATE OR REPLACE FUNCTION public.ad_product_totals(p_store_id uuid, p_since date)
RETURNS TABLE (item_id text, cost numeric, clicks bigint, conversions numeric, conversions_value numeric)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT m.item_id,
         sum(m.cost)               AS cost,
         sum(m.clicks)::bigint     AS clicks,
         sum(m.conversions)        AS conversions,
         sum(m.conversions_value)  AS conversions_value
  FROM ad_product_metrics_daily m
  WHERE m.store_id = p_store_id
    AND m.date >= p_since
  GROUP BY m.item_id
$$;

REVOKE ALL ON FUNCTION public.ad_product_totals(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ad_product_totals(uuid, date) TO service_role;
