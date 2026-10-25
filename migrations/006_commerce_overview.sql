-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — Prezentarea generală: vânzările de pe site într-o singură cerere
-- Run this in Supabase SQL Editor (aplicată prin MCP pe 25.10.2026)
--
-- Perioada curentă și cea dinainte (pentru comparație), venitul pe zile în
-- fusul orar al magazinului și sursele vânzărilor. Numai comenzile din
-- vitrină (channel = 'store'), fără cele anulate sau rambursate.
--
-- Sursa unei comenzi, din atribuirea ei:
--   google_ads      gclid, sau utm_source=google cu un medium plătit
--   meta            utm_source facebook / instagram / meta
--   email           utm_medium email / newsletter
--   other_campaigns orice alt utm_source
--   google_organic  venit din căutarea Google, fără reclamă
--   referral        alt site
--   direct          fără niciun semn
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.commerce_overview(p_store_id uuid, p_days integer, p_tz text DEFAULT 'Europe/Bucharest')
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  -- Zile întregi în fusul magazinului: „30 de zile" = azi și cele 29 dinainte;
  -- perioada de comparație are exact aceeași lungime, chiar înainte.
  WITH b AS (
    SELECT (date_trunc('day', now() AT TIME ZONE p_tz) - make_interval(days => p_days - 1)) AT TIME ZONE p_tz     AS since,
           (date_trunc('day', now() AT TIME ZONE p_tz) - make_interval(days => 2 * p_days - 1)) AT TIME ZONE p_tz AS prev_since
  ),
  o AS (
    SELECT o.placed_at, o.total,
      CASE
        WHEN o.gclid IS NOT NULL
          OR (lower(coalesce(o.utm_source, '')) IN ('google', 'adwords')
              AND lower(coalesce(o.utm_medium, '')) IN ('cpc', 'ppc', 'paid', 'paidsearch', 'paid_search', 'shopping', 'pmax'))
          THEN 'google_ads'
        WHEN lower(coalesce(o.utm_source, '')) IN ('facebook', 'fb', 'instagram', 'ig', 'meta') THEN 'meta'
        WHEN lower(coalesce(o.utm_medium, '')) IN ('email', 'e-mail', 'newsletter') THEN 'email'
        WHEN o.utm_source IS NOT NULL THEN 'other_campaigns'
        WHEN lower(coalesce(o.attribution->>'referrer', '')) LIKE '%google.%' THEN 'google_organic'
        WHEN coalesce(o.attribution->>'referrer', '') <> '' THEN 'referral'
        ELSE 'direct'
      END AS source
    FROM commerce_orders o, b
    WHERE o.store_id = p_store_id
      AND o.channel = 'store'
      AND o.state NOT IN ('cancelled', 'refunded')
      AND o.placed_at >= b.prev_since
  ),
  cur  AS (SELECT o.* FROM o, b WHERE o.placed_at >= b.since),
  prev AS (SELECT o.* FROM o, b WHERE o.placed_at <  b.since)
  SELECT jsonb_build_object(
    'current', (SELECT jsonb_build_object(
        'revenue', coalesce(sum(total), 0),
        'orders', count(*),
        'google_ads_orders', count(*) FILTER (WHERE source = 'google_ads'),
        'google_ads_revenue', coalesce(sum(total) FILTER (WHERE source = 'google_ads'), 0)) FROM cur),
    'previous', (SELECT jsonb_build_object(
        'revenue', coalesce(sum(total), 0),
        'orders', count(*),
        'google_ads_orders', count(*) FILTER (WHERE source = 'google_ads'),
        'google_ads_revenue', coalesce(sum(total) FILTER (WHERE source = 'google_ads'), 0)) FROM prev),
    'daily', (SELECT coalesce(jsonb_agg(jsonb_build_object('day', d, 'revenue', r, 'orders', n) ORDER BY d), '[]'::jsonb)
              FROM (SELECT (placed_at AT TIME ZONE p_tz)::date AS d, sum(total) AS r, count(*) AS n FROM cur GROUP BY 1) x),
    'sources', (SELECT coalesce(jsonb_agg(jsonb_build_object('source', source, 'orders', n, 'revenue', r) ORDER BY r DESC), '[]'::jsonb)
                FROM (SELECT source, count(*) AS n, sum(total) AS r FROM cur GROUP BY 1) s)
  )
$$;

-- Cheia anon ajunge în browser: funcția o cheamă numai serverul (service role)
REVOKE ALL ON FUNCTION public.commerce_overview(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_overview(uuid, integer, text) TO service_role;
