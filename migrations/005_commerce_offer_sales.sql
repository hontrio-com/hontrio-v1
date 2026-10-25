-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — vânzările pe ofertă, pentru pagina Produse
-- Run this in Supabase SQL Editor (aplicată prin MCP pe 25.10.2026)
--
-- Numai vânzările de pe SITE (channel = 'store'): reclamele Google aduc
-- oameni în magazin, nu pe eMAG sau Trendyol, deci doar acolo se poate vedea
-- ce produse vând. Comenzile anulate sau rambursate nu se numără, iar
-- extraopțiunile (ambalaj cadou și altele) nu sunt produse.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.commerce_offer_sales(p_store_id uuid, p_since timestamptz)
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
  GROUP BY l.offer_id
$$;

-- Cheia anon ajunge în browser: funcția o cheamă numai serverul (service role)
REVOKE ALL ON FUNCTION public.commerce_offer_sales(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_offer_sales(uuid, timestamptz) TO service_role;
