-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — vânzările de pe site pentru pagina Rapoarte
-- Run this in Supabase SQL Editor (aplicată prin MCP pe 25.10.2026)
--
-- Pe zi și pe sursă, cu aceeași regulă de atribuire ca commerce_overview,
-- plus comenzile aduse de campaniile Hontrio (utm_campaign „hontrio-<id>",
-- pus de Hontrio în sufixul URL-ului final).
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.commerce_sales_report(p_store_id uuid, p_days integer, p_tz text DEFAULT 'Europe/Bucharest')
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH b AS (
    SELECT (date_trunc('day', now() AT TIME ZONE p_tz) - make_interval(days => p_days - 1)) AT TIME ZONE p_tz AS since
  ),
  o AS (
    SELECT o.placed_at, o.total,
      lower(coalesce(o.utm_campaign, '')) LIKE 'hontrio-%' AS hontrio,
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
      AND o.placed_at >= b.since
  )
  SELECT jsonb_build_object(
    'daily', (SELECT coalesce(jsonb_agg(jsonb_build_object('day', d, 'revenue', r, 'google_ads', g, 'hontrio', h, 'orders', n) ORDER BY d), '[]'::jsonb)
              FROM (SELECT (placed_at AT TIME ZONE p_tz)::date AS d,
                           sum(total) AS r,
                           coalesce(sum(total) FILTER (WHERE source = 'google_ads'), 0) AS g,
                           coalesce(sum(total) FILTER (WHERE hontrio), 0) AS h,
                           count(*) AS n
                    FROM o GROUP BY 1) x),
    'sources', (SELECT coalesce(jsonb_agg(jsonb_build_object('source', source, 'orders', n, 'revenue', r) ORDER BY r DESC), '[]'::jsonb)
                FROM (SELECT source, count(*) AS n, sum(total) AS r FROM o GROUP BY 1) s),
    'total', (SELECT jsonb_build_object('orders', count(*), 'revenue', coalesce(sum(total), 0)) FROM o),
    'hontrio', (SELECT jsonb_build_object('orders', count(*), 'revenue', coalesce(sum(total), 0)) FROM o WHERE hontrio)
  )
$$;

-- Cheia anon ajunge în browser: funcția o cheamă numai serverul (service role)
REVOKE ALL ON FUNCTION public.commerce_sales_report(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_sales_report(uuid, integer, text) TO service_role;
