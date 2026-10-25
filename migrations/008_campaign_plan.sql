-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — planul de campanie
-- Run this in Supabase SQL Editor (aplicată prin MCP pe 25.10.2026)
--
-- Doar ADĂUGIRI:
-- 1. commerce_order_economics: cifrele comenzilor de pe site din care se
--    socotește rentabilitatea reclamelor. Google Ads primește TOTALUL
--    comenzii (cu TVA, transport și taxe, după reduceri), iar comerciantului
--    îi rămâne marja produselor fără TVA, minus reducerile.
-- 2. ad_campaigns: campaniile Hontrio. Până la lansare, campania magazinului
--    e o ciornă: planul, cu obiectivul și bugetul alese de om.
-- 3. commerce_offers.ads_mode: ce a hotărât omul pentru o ofertă în reclame.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Comenzile de pe site dintr-o perioadă, fără cele anulate sau rambursate
CREATE OR REPLACE FUNCTION public.commerce_order_economics(p_store_id uuid, p_since timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH o AS (
    SELECT o.id, o.total, o.tax, o.discount, o.shipping, o.fees,
      -- Aceeași regulă de atribuire ca în commerce_overview
      (o.gclid IS NOT NULL
        OR (lower(coalesce(o.utm_source, '')) IN ('google', 'adwords')
            AND lower(coalesce(o.utm_medium, '')) IN ('cpc', 'ppc', 'paid', 'paidsearch', 'paid_search', 'shopping', 'pmax'))) AS google_ads
    FROM commerce_orders o
    WHERE o.store_id = p_store_id
      AND o.channel = 'store'
      AND o.state NOT IN ('cancelled', 'refunded')
      AND o.placed_at >= p_since
  ),
  -- Valoarea produselor: toate liniile, fără extra (personalizări, ambalaje)
  l AS (
    SELECT coalesce(sum(l.quantity * l.unit_price), 0) AS items
    FROM commerce_order_lines l
    JOIN o ON o.id = l.order_id
    WHERE l.store_id = p_store_id
      AND NOT l.is_extra
  )
  SELECT jsonb_build_object(
    'orders', count(*),
    'total', coalesce(sum(o.total), 0),
    'items', (SELECT items FROM l),
    'discount', coalesce(sum(o.discount), 0),
    'shipping', coalesce(sum(o.shipping), 0),
    'fees', coalesce(sum(o.fees), 0),
    'tax', coalesce(sum(o.tax), 0),
    'google_ads_orders', count(*) FILTER (WHERE o.google_ads),
    'google_ads_total', coalesce(sum(o.total) FILTER (WHERE o.google_ads), 0)
  )
  FROM o
$$;

-- Cheia anon ajunge în browser: funcția o cheamă numai serverul (service role)
REVOKE ALL ON FUNCTION public.commerce_order_economics(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_order_economics(uuid, timestamptz) TO service_role;

-- 2. Campaniile Hontrio
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id            uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  platform            text NOT NULL DEFAULT 'google_ads' CHECK (platform IN ('google_ads')),
  type                text NOT NULL DEFAULT 'performance_max' CHECK (type IN ('performance_max')),
  status              text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'removed')),
  -- Din profitul unei vânzări, cât rămâne comerciantului după reclamă
  goal                text NOT NULL DEFAULT 'balanced' CHECK (goal IN ('growth', 'balanced', 'profit')),
  -- NULL = bugetul propus de Hontrio
  daily_budget        numeric(12,2) CHECK (daily_budget IS NULL OR daily_budget > 0),
  currency            text,
  -- Se completează la lansare
  customer_id         text,
  google_campaign_id  text,
  launched_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Un singur plan (ciornă) pe magazin
CREATE UNIQUE INDEX IF NOT EXISTS uq_ad_campaigns_draft ON ad_campaigns (store_id) WHERE status = 'draft';
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_user ON ad_campaigns (user_id);

-- Le citește și le scrie numai serverul (service role), ca pe commerce_*
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;

-- 3. Ce a hotărât omul pentru o ofertă: 'auto' = hotărăște Hontrio,
-- 'include' = intră deși marja e mică, 'exclude' = nu intră deloc.
-- Sincronizarea nu scrie coloana (upsert-ul atinge doar coloanele trimise).
ALTER TABLE commerce_offers ADD COLUMN IF NOT EXISTS ads_mode text NOT NULL DEFAULT 'auto'
  CHECK (ads_mode IN ('auto', 'include', 'exclude'));
