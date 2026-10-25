-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — prețurile de cost, mai ușor
-- Run this in Supabase SQL Editor (aplicată prin MCP pe 25.10.2026)
--
-- 1. commerce_offers.cost_source: de unde vine costul.
--    'manual'      = scris de om (nu-l suprascrie nimic automat)
--    'estimate'    = completat în masă, ca procent din preț
--    'woocommerce' = preluat din „Cost of Goods" al magazinului
-- 2. commerce_estimate_costs: costul ca procent din preț, pe tot catalogul,
--    pe o categorie sau pe o marcă; cu p_dry_run doar numără. Ofertele fără
--    preț (prețul se stabilește la comandă) rămân fără cost.
-- 3. commerce_import_costs: costurile venite din platformă. Completează
--    golurile și înlocuiesc estimările; costul scris de om rămâne.
-- ═══════════════════════════════════════════════════════════════════════

-- 1.
ALTER TABLE commerce_offers ADD COLUMN IF NOT EXISTS cost_source text
  CHECK (cost_source IN ('manual', 'estimate', 'woocommerce'));
-- Costurile de până acum le-a scris omul
UPDATE commerce_offers SET cost_source = 'manual' WHERE cost_price IS NOT NULL AND cost_source IS NULL;

-- 2.
CREATE OR REPLACE FUNCTION public.commerce_estimate_costs(
  p_store_id uuid, p_percent numeric, p_category text, p_brand text, p_only_missing boolean, p_dry_run boolean
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  IF p_percent IS NULL OR p_percent <= 0 OR p_percent >= 100 THEN
    RAISE EXCEPTION 'procent invalid';
  END IF;
  IF p_dry_run THEN
    SELECT count(*) INTO n FROM commerce_offers
    WHERE store_id = p_store_id
      AND price > 0
      AND (p_category IS NULL OR category = p_category)
      AND (p_brand IS NULL OR brand = p_brand)
      AND (NOT p_only_missing OR cost_price IS NULL);
    RETURN n;
  END IF;
  UPDATE commerce_offers
  SET cost_price = round(price * p_percent / 100, 2), cost_source = 'estimate'
  WHERE store_id = p_store_id
    AND price > 0
    AND (p_category IS NULL OR category = p_category)
    AND (p_brand IS NULL OR brand = p_brand)
    AND (NOT p_only_missing OR cost_price IS NULL);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;

-- 3. p_costs = [{ "offer_id": "...", "cost": 12.5 }, ...]
CREATE OR REPLACE FUNCTION public.commerce_import_costs(p_store_id uuid, p_costs jsonb, p_source text)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  UPDATE commerce_offers o
  SET cost_price = round(c.cost, 2), cost_source = p_source
  FROM jsonb_to_recordset(p_costs) AS c(offer_id text, cost numeric)
  WHERE o.store_id = p_store_id
    AND o.offer_id = c.offer_id
    AND c.cost > 0
    -- Costul scris de om nu se atinge
    AND (o.cost_price IS NULL OR o.cost_source IN ('estimate', p_source))
    AND o.cost_price IS DISTINCT FROM round(c.cost, 2);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;

-- Cheia anon ajunge în browser: funcțiile le cheamă numai serverul (service role)
REVOKE ALL ON FUNCTION public.commerce_estimate_costs(uuid, numeric, text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_estimate_costs(uuid, numeric, text, text, boolean, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.commerce_import_costs(uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_import_costs(uuid, jsonb, text) TO service_role;
