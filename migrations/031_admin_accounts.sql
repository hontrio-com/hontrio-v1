-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — panoul de administrare: conturile pe larg și conectarea în contul
-- unui client (19.11.2026). Aplicată prin MCP.
--
-- 1. users.last_seen_at: ultima folosire a platformei (la intrarea în cont și
--    apoi cel mult o dată pe oră). Conectarea administratorului nu o schimbă.
-- 2. admin_impersonations: jurnalul conectărilor administratorului în conturile
--    clienților (cine, în ce cont, când a intrat, până când putea rămâne și când
--    a ieșit). Rândul rămâne și după ștergerea unuia dintre conturi.
-- 3. admin_store_summaries: cifrele fiecărui magazin de la o dată încoace,
--    pentru lista conturilor și pagina fiecăruia:
--    - comenzile neanulate: toate canalele, doar site-ul și cele aduse de
--      campaniile Hontrio (utm_campaign „hontrio-…”), cu valoarea lor totală;
--    - Google Ads (contul ales acum): tot contul și doar campaniile Hontrio.
--    Zilele din Google Ads se socotesc în fusul magazinului.
-- Totul se citește numai din server (service role), ca restul.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE TABLE IF NOT EXISTS admin_impersonations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  admin_email text NOT NULL,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  user_email  text NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  ended_at    timestamptz,
  ended_by    text CHECK (ended_by IN ('admin', 'expired', 'session')),
  ip          text,
  user_agent  text
);
CREATE INDEX IF NOT EXISTS idx_admin_impersonations_user  ON admin_impersonations (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_impersonations_admin ON admin_impersonations (admin_id, started_at DESC);
ALTER TABLE admin_impersonations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_impersonations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION admin_store_summaries(p_since timestamptz, p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  store_id uuid, user_id uuid,
  orders bigint, sales numeric, site_orders bigint, site_sales numeric, hontrio_orders bigint, hontrio_sales numeric,
  ads_cost numeric, ads_clicks bigint, ads_impressions bigint, ads_conversions numeric, ads_value numeric,
  hontrio_cost numeric, hontrio_clicks bigint, hontrio_impressions bigint, hontrio_conversions numeric, hontrio_value numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH s AS (
    SELECT st.id, st.user_id, st.google_ads_customer_id, coalesce(nullif(st.timezone, ''), 'Europe/Bucharest') AS tz
    FROM stores st
    WHERE p_user_id IS NULL OR st.user_id = p_user_id
  ),
  o AS (
    SELECT co.store_id,
      count(*) AS orders,
      coalesce(sum(co.total), 0) AS sales,
      count(*) FILTER (WHERE co.channel = 'store') AS site_orders,
      coalesce(sum(co.total) FILTER (WHERE co.channel = 'store'), 0) AS site_sales,
      count(*) FILTER (WHERE lower(coalesce(co.utm_campaign, '')) LIKE 'hontrio-%') AS hontrio_orders,
      coalesce(sum(co.total) FILTER (WHERE lower(coalesce(co.utm_campaign, '')) LIKE 'hontrio-%'), 0) AS hontrio_sales
    FROM commerce_orders co
    JOIN s ON s.id = co.store_id
    WHERE co.placed_at >= p_since AND co.state NOT IN ('cancelled', 'refunded')
    GROUP BY co.store_id
  ),
  d AS (
    SELECT md.store_id, md.cost, md.clicks, md.impressions, md.conversions, md.conversions_value,
      EXISTS (SELECT 1 FROM ad_campaigns c WHERE c.store_id = md.store_id AND c.google_campaign_id = md.google_campaign_id) AS ours
    FROM ad_metrics_daily md
    JOIN s ON s.id = md.store_id
    WHERE md.date >= (p_since AT TIME ZONE s.tz)::date
      AND (s.google_ads_customer_id IS NULL OR md.customer_id = s.google_ads_customer_id)
  ),
  m AS (
    SELECT d.store_id,
      sum(d.cost) AS ads_cost, sum(d.clicks) AS ads_clicks, sum(d.impressions) AS ads_impressions,
      sum(d.conversions) AS ads_conversions, sum(d.conversions_value) AS ads_value,
      sum(d.cost) FILTER (WHERE d.ours) AS hontrio_cost, sum(d.clicks) FILTER (WHERE d.ours) AS hontrio_clicks,
      sum(d.impressions) FILTER (WHERE d.ours) AS hontrio_impressions,
      sum(d.conversions) FILTER (WHERE d.ours) AS hontrio_conversions, sum(d.conversions_value) FILTER (WHERE d.ours) AS hontrio_value
    FROM d
    GROUP BY d.store_id
  )
  SELECT s.id, s.user_id,
    coalesce(o.orders, 0)::bigint, coalesce(o.sales, 0)::numeric,
    coalesce(o.site_orders, 0)::bigint, coalesce(o.site_sales, 0)::numeric,
    coalesce(o.hontrio_orders, 0)::bigint, coalesce(o.hontrio_sales, 0)::numeric,
    coalesce(m.ads_cost, 0)::numeric, coalesce(m.ads_clicks, 0)::bigint, coalesce(m.ads_impressions, 0)::bigint,
    coalesce(m.ads_conversions, 0)::numeric, coalesce(m.ads_value, 0)::numeric,
    coalesce(m.hontrio_cost, 0)::numeric, coalesce(m.hontrio_clicks, 0)::bigint, coalesce(m.hontrio_impressions, 0)::bigint,
    coalesce(m.hontrio_conversions, 0)::numeric, coalesce(m.hontrio_value, 0)::numeric
  FROM s
  LEFT JOIN o ON o.store_id = s.id
  LEFT JOIN m ON m.store_id = s.id
$$;

REVOKE ALL ON FUNCTION admin_store_summaries(timestamptz, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_store_summaries(timestamptz, uuid) TO service_role;
