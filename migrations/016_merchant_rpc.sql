-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — scrierile în masă din sincronizarea cu Merchant Center
-- Run this in Supabase SQL Editor (aplicată prin MCP pe 25.10.2026)
--
-- Un upsert parțial pe commerce_offers nu merge (INSERT ... ON CONFLICT verifică
-- NOT NULL-ul coloanelor lipsă înainte de conflict), iar o actualizare pe ofertă
-- înseamnă o mie de cereri la un catalog mare. Funcțiile primesc toate rândurile
-- deodată, ca JSON.
-- ═══════════════════════════════════════════════════════════════════════

-- Ce știe Merchant Center despre fiecare ofertă: ID-ul de acolo, problemele și,
-- unde magazinul nu ne spune starea (WooCommerce, Shopify), starea la Shopping
CREATE OR REPLACE FUNCTION public.commerce_set_merchant_data(p_store_id uuid, p_rows jsonb, p_set_status boolean)
RETURNS integer
LANGUAGE sql
SET search_path = public
AS $$
  WITH r AS (
    SELECT x.offer_id, x.merchant_offer_id, x.merchant_issues, x.google_status
    FROM jsonb_to_recordset(p_rows) AS x(offer_id text, merchant_offer_id text, merchant_issues jsonb, google_status text)
  ), u AS (
    UPDATE commerce_offers o SET
      merchant_offer_id = r.merchant_offer_id,
      merchant_issues   = r.merchant_issues,
      google_status     = CASE WHEN p_set_status THEN r.google_status ELSE o.google_status END
    FROM r
    WHERE o.store_id = p_store_id AND o.offer_id = r.offer_id
    RETURNING 1
  )
  SELECT count(*)::int FROM u
$$;

-- Ce a trimis Hontrio în sursa suplimentară (costul fără TVA, eticheta)
CREATE OR REPLACE FUNCTION public.commerce_mark_merchant_pushed(p_store_id uuid, p_rows jsonb)
RETURNS integer
LANGUAGE sql
SET search_path = public
AS $$
  WITH r AS (
    SELECT x.offer_id, x.cogs, x.label
    FROM jsonb_to_recordset(p_rows) AS x(offer_id text, cogs numeric, label text)
  ), u AS (
    UPDATE commerce_offers o SET merchant_cogs_pushed = r.cogs, merchant_label_pushed = r.label
    FROM r
    WHERE o.store_id = p_store_id AND o.offer_id = r.offer_id
    RETURNING 1
  )
  SELECT count(*)::int FROM u
$$;

-- Cheia anon ajunge în browser: funcțiile le cheamă numai serverul (service role)
REVOKE ALL ON FUNCTION public.commerce_set_merchant_data(uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_set_merchant_data(uuid, jsonb, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.commerce_mark_merchant_pushed(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_mark_merchant_pushed(uuid, jsonb) TO service_role;
