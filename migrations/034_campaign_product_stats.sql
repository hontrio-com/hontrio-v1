-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — fișa unei campanii, cu mai multe cifre (19.11.2026). Aplicată
-- prin MCP.
--
-- campaign_product_stats: produsele campaniilor date (Google Ads, pe produs),
-- adunate pe perioada aleasă, în baza de date: câte produse au avut afișări și
-- primele după clicuri (apoi după cost). Fără funcția asta, fișa ar citi
-- rândurile zilnice ale fiecărui produs (mii, pe 90 de zile).
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION campaign_product_stats(p_store_id uuid, p_campaign_ids text[], p_from date, p_to date, p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH p AS (
    SELECT item_id,
      sum(cost) AS cost, sum(clicks) AS clicks, sum(impressions) AS impressions,
      sum(conversions) AS conversions, sum(conversions_value) AS value
    FROM ad_product_metrics_daily
    WHERE store_id = p_store_id AND google_campaign_id = ANY (p_campaign_ids) AND date BETWEEN p_from AND p_to
    GROUP BY item_id
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM p WHERE impressions > 0),
    'top', coalesce((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.clicks DESC, t.cost DESC, t.item_id)
      FROM (SELECT * FROM p WHERE impressions > 0 ORDER BY clicks DESC, cost DESC, item_id LIMIT greatest(1, least(p_limit, 50))) t
    ), '[]'::jsonb)
  )
$$;

REVOKE ALL ON FUNCTION campaign_product_stats(uuid, text[], date, date, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION campaign_product_stats(uuid, text[], date, date, integer) TO service_role;
