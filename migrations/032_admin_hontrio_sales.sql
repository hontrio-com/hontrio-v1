-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — panoul de administrare fără datele Google ale clienților
-- (19.11.2026). Aplicată prin MCP.
--
-- Politica de confidențialitate promite că echipa Hontrio nu citește datele
-- Google ale unui client fără cererea lui și nu amestecă datele clienților.
-- Panoul arată deci doar contul, magazinele, comenzile aduse de campaniile
-- Hontrio (baza taxei, art. 9) și facturarea, iar „Conectare” nu mai există:
-- admin_hontrio_sales: comenzile neanulate cu utm_campaign „hontrio-…” ale
-- fiecărui magazin, de la o dată încoace (numărul și valoarea, cu TVA).
-- Ce nu se mai folosește din migrarea 031 se șterge în 033.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION admin_hontrio_sales(p_since timestamptz, p_user_id uuid DEFAULT NULL)
RETURNS TABLE (store_id uuid, user_id uuid, orders bigint, sales numeric)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT st.id, st.user_id, count(co.id)::bigint, coalesce(sum(co.total), 0)::numeric
  FROM stores st
  LEFT JOIN commerce_orders co
    ON co.store_id = st.id
   AND co.placed_at >= p_since
   AND co.state NOT IN ('cancelled', 'refunded')
   AND lower(coalesce(co.utm_campaign, '')) LIKE 'hontrio-%'
  WHERE p_user_id IS NULL OR st.user_id = p_user_id
  GROUP BY st.id, st.user_id
$$;

REVOKE ALL ON FUNCTION admin_hontrio_sales(timestamptz, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_hontrio_sales(timestamptz, uuid) TO service_role;
