-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — cataloagele mari, pe pagini (24.11.2026). Aplicată prin MCP.
--
-- La eSAFE.ro (42.685 de oferte), planul trimis paginii avea 21 MB, peste
-- limita de 4,5 MB a funcțiilor Vercel. Paginile primesc acum doar cifrele, iar
-- listele se cer pe pagini, din baza de date:
--
-- 1. Fiecare ofertă ține minte ce a hotărât ultima socotire a planului
--    (lib/campaigns/context.ts): motivul (`included` = intră în campania
--    principală), grupa și ID-ul din Merchant Center. Se scriu doar schimbările.
-- 2. plan_offer_page: o pagină din produsele planului (fila, căutarea sau grupa
--    în lucru), cu vânzările din magazin și cifrele Google, în ordinea planului.
-- 3. plan_group_preview: totalurile unei grupe în lucru, cu aceleași reguli ca
--    assignGroups (lib/campaigns/groups.ts).
-- 4. plan_offers_by_items: numele și poza produselor din cifrele Google.
-- 5. catalog_page: pagina Produse, pe pagini, cu vânzările din perioadă.
--
-- Filtrarea și ordinea citesc doar coloanele mici ale ofertelor; restul (poza,
-- numele) se citește numai pentru rândurile paginii. La 42.000 de oferte, o
-- pagină durează sub 0,2 secunde în baza de date.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE commerce_offers
  ADD COLUMN IF NOT EXISTS plan_reason text,
  ADD COLUMN IF NOT EXISTS plan_group uuid,
  ADD COLUMN IF NOT EXISTS plan_item_id text;

CREATE INDEX IF NOT EXISTS commerce_offers_store_plan_reason_idx ON commerce_offers (store_id, plan_reason);

-- 1. Ce a hotărât planul, doar pe ofertele schimbate (serverul trimite deja doar diferențele)
CREATE OR REPLACE FUNCTION set_plan_offers(p_store_id uuid, p_offer_ids text[], p_reasons text[], p_groups uuid[], p_items text[])
RETURNS integer
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  WITH x AS (
    SELECT * FROM unnest(p_offer_ids, p_reasons, p_groups, p_items) AS t(offer_id, reason, grp, item)
  ), u AS (
    UPDATE commerce_offers o
       SET plan_reason = x.reason, plan_group = x.grp, plan_item_id = x.item
      FROM x
     WHERE o.store_id = p_store_id AND o.offer_id = x.offer_id
       AND (o.plan_reason IS DISTINCT FROM x.reason OR o.plan_group IS DISTINCT FROM x.grp OR o.plan_item_id IS DISTINCT FROM x.item)
    RETURNING 1
  )
  SELECT count(*)::integer FROM u
$$;

-- Grupa vrea oferta: nu e scoasă de mână și e aleasă de mână sau trece de toate filtrele
-- (categorie ȘI brand ȘI preț ȘI reducere). Ca `wants` + `matchesFilters` din lib/campaigns/groups.ts.
-- Regulile vin deja desfăcute (o dată pe cerere, în CTE-ul `rule`), categoriile și brandurile cu litere mici:
-- o singură expresie, pe care Postgres o pune direct în interogare (fără apel pe fiecare ofertă).
CREATE OR REPLACE FUNCTION plan_rule_match(
  p_offer_id text, p_category text, p_brand text, p_price numeric, p_compare numeric,
  p_inc text[], p_exc text[], p_cats text[], p_brands text[], p_pmin numeric, p_pmax numeric, p_sale boolean)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NOT (p_offer_id = ANY (p_exc)) AND (p_offer_id = ANY (p_inc) OR (
    (cardinality(p_cats) > 0 OR cardinality(p_brands) > 0 OR p_pmin IS NOT NULL OR p_pmax IS NOT NULL OR p_sale)
    AND (cardinality(p_cats) = 0 OR coalesce(lower(btrim(p_category)) = ANY (p_cats), false))
    AND (cardinality(p_brands) = 0 OR coalesce(lower(btrim(p_brand)) = ANY (p_brands), false))
    AND (p_pmin IS NULL OR p_price >= p_pmin)
    AND (p_pmax IS NULL OR p_price <= p_pmax)
    AND (NOT p_sale OR coalesce(p_compare > p_price, false))))
$$;

-- 2. O pagină din produsele planului.
--    p_filter: included | groups | excluded (fila din Campanii), group (produsele grupei în lucru), all.
--    p_rules + p_group + p_preceding: grupa în lucru; grupele dinaintea ei își păstrează produsele.
--    `group_id` = grupa ofertei (cu grupa în lucru, dacă o vrea și nu e luată de una dinainte);
--    `in_draft` = oferta e în grupa în lucru (și când grupa e nouă, fără ID încă).
CREATE OR REPLACE FUNCTION plan_offer_page(
  p_store_id uuid, p_since90 timestamptz, p_since30 timestamptz, p_day30 date,
  p_filter text, p_q text, p_rules jsonb, p_group uuid, p_preceding uuid[], p_offset integer, p_limit integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH rule AS (
    SELECT coalesce(array(SELECT jsonb_array_elements_text(p_rules->'include')), '{}'::text[]) AS inc,
           coalesce(array(SELECT jsonb_array_elements_text(p_rules->'exclude')), '{}'::text[]) AS exc,
           coalesce(array(SELECT lower(btrim(x)) FROM jsonb_array_elements_text(p_rules->'categories') x), '{}'::text[]) AS cats,
           coalesce(array(SELECT lower(btrim(x)) FROM jsonb_array_elements_text(p_rules->'brands') x), '{}'::text[]) AS brands,
           CASE WHEN jsonb_typeof(p_rules->'price_min') = 'number' THEN (p_rules->>'price_min')::numeric END AS pmin,
           CASE WHEN jsonb_typeof(p_rules->'price_max') = 'number' THEN (p_rules->>'price_max')::numeric END AS pmax,
           coalesce(p_rules->>'on_sale', 'false') = 'true' AS sale
  ), o AS (
    SELECT c.offer_id, c.price, c.plan_reason, c.plan_group,
           (p_rules IS NOT NULL AND plan_rule_match(c.offer_id, c.category, c.brand, c.price, c.compare_at_price,
             rule.inc, rule.exc, rule.cats, rule.brands, rule.pmin, rule.pmax, rule.sale)) AS wanted,
           (c.plan_group IS NOT NULL AND c.plan_group = ANY (coalesce(p_preceding, '{}'::uuid[]))) AS taken
      FROM commerce_offers c CROSS JOIN rule
     WHERE c.store_id = p_store_id AND c.plan_reason IS NOT NULL
       AND (p_q IS NULL OR c.title ILIKE p_q OR c.product_name ILIKE p_q OR c.variant_title ILIKE p_q OR c.category ILIKE p_q OR c.brand ILIKE p_q)
  ), f AS (
    SELECT o.offer_id, o.price, o.plan_reason, (p_rules IS NOT NULL AND o.wanted AND NOT o.taken) AS in_draft,
           CASE WHEN p_rules IS NULL THEN o.plan_group
                WHEN o.wanted AND NOT o.taken THEN p_group
                WHEN o.plan_group = p_group THEN NULL
                ELSE o.plan_group END AS owner
      FROM o
     WHERE CASE p_filter
             WHEN 'included' THEN o.plan_reason = 'included'
             WHEN 'groups' THEN o.plan_reason = 'in_group'
             WHEN 'excluded' THEN o.plan_reason NOT IN ('included', 'in_group')
             WHEN 'group' THEN o.wanted AND NOT o.taken
             ELSE true END
  ), s AS (SELECT * FROM commerce_offer_sales(p_store_id, p_since90)),
  k AS (
    SELECT f.*, coalesce(s.units, 0) AS units, coalesce(s.revenue, 0) AS revenue, coalesce(s.orders, 0) AS orders
      FROM f LEFT JOIN s ON s.offer_id = f.offer_id
  ), p AS (
    SELECT * FROM k ORDER BY revenue DESC, price DESC, offer_id COLLATE "C"
     LIMIT greatest(1, least(p_limit, 100)) OFFSET greatest(0, p_offset)
  ), g AS (SELECT * FROM commerce_offer_google_sales(p_store_id, p_since30)),
  a AS (SELECT lower(btrim(t.item_id)) AS item, t.cost, t.conversions, t.conversions_value FROM ad_product_totals(p_store_id, p_day30) t)
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM k),
    'rows', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'offer_id', c.offer_id, 'title', coalesce(nullif(c.product_name, ''), c.title), 'variant_title', c.variant_title,
               'image_url', c.image_url, 'category', nullif(btrim(c.category), ''), 'brand', nullif(btrim(c.brand), ''),
               'price', c.price, 'compare_at_price', c.compare_at_price, 'ads_mode', c.ads_mode,
               'reason', p.plan_reason, 'group_id', p.owner, 'in_draft', p.in_draft, 'item_id', nullif(btrim(c.plan_item_id), ''),
               'units', p.units, 'revenue', p.revenue, 'orders', p.orders,
               'google_orders', coalesce(g.orders, 0), 'google_revenue', coalesce(g.revenue, 0),
               'ads_cost', a.cost, 'ads_conversions', a.conversions, 'ads_value', a.conversions_value)
             ORDER BY p.revenue DESC, p.price DESC, p.offer_id COLLATE "C")
        FROM p
        JOIN commerce_offers c ON c.store_id = p_store_id AND c.offer_id = p.offer_id
        LEFT JOIN g ON g.offer_id = p.offer_id
        LEFT JOIN a ON a.item = lower(nullif(btrim(c.plan_item_id), ''))
    ), '[]'::jsonb))
$$;

-- 3. Totalurile grupei în lucru (ca buildGroupPlan): membrii, cei care pot rula, cei găsiți în Merchant Center,
--    vânzările din magazin (cele care pot rula), conversiile și cifrele Google (toți membrii).
CREATE OR REPLACE FUNCTION plan_group_preview(
  p_store_id uuid, p_since90 timestamptz, p_since30 timestamptz, p_day30 date, p_rules jsonb, p_preceding uuid[])
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH rule AS (
    SELECT coalesce(array(SELECT jsonb_array_elements_text(p_rules->'include')), '{}'::text[]) AS inc,
           coalesce(array(SELECT jsonb_array_elements_text(p_rules->'exclude')), '{}'::text[]) AS exc,
           coalesce(array(SELECT lower(btrim(x)) FROM jsonb_array_elements_text(p_rules->'categories') x), '{}'::text[]) AS cats,
           coalesce(array(SELECT lower(btrim(x)) FROM jsonb_array_elements_text(p_rules->'brands') x), '{}'::text[]) AS brands,
           CASE WHEN jsonb_typeof(p_rules->'price_min') = 'number' THEN (p_rules->>'price_min')::numeric END AS pmin,
           CASE WHEN jsonb_typeof(p_rules->'price_max') = 'number' THEN (p_rules->>'price_max')::numeric END AS pmax,
           coalesce(p_rules->>'on_sale', 'false') = 'true' AS sale
  ), w AS (
    SELECT c.offer_id, c.price, c.plan_reason, nullif(btrim(c.plan_item_id), '') AS item_id,
           (c.plan_group IS NOT NULL AND c.plan_group = ANY (coalesce(p_preceding, '{}'::uuid[]))) AS taken
      FROM commerce_offers c CROSS JOIN rule
     WHERE c.store_id = p_store_id AND c.plan_reason IS NOT NULL
       AND plan_rule_match(c.offer_id, c.category, c.brand, c.price, c.compare_at_price,
             rule.inc, rule.exc, rule.cats, rule.brands, rule.pmin, rule.pmax, rule.sale)
  ), s AS (SELECT * FROM commerce_offer_sales(p_store_id, p_since90)),
  g AS (SELECT * FROM commerce_offer_google_sales(p_store_id, p_since30)),
  a AS (SELECT lower(btrim(t.item_id)) AS item, t.cost, t.conversions, t.conversions_value FROM ad_product_totals(p_store_id, p_day30) t),
  m AS (
    SELECT w.*, w.plan_reason IN ('included', 'in_group') AS runs,
           coalesce(s.units, 0) AS units, coalesce(s.revenue, 0) AS revenue, coalesce(s.orders, 0) AS orders,
           coalesce(g.orders, 0) AS g_orders, coalesce(g.revenue, 0) AS g_revenue,
           a.cost AS a_cost, a.conversions AS a_conv, a.conversions_value AS a_value
      FROM w
      LEFT JOIN s ON s.offer_id = w.offer_id
      LEFT JOIN g ON g.offer_id = w.offer_id
      LEFT JOIN a ON a.item = lower(w.item_id)
     WHERE NOT w.taken
  )
  SELECT jsonb_build_object(
    'members', count(*),
    'running', count(*) FILTER (WHERE runs),
    'matched', count(*) FILTER (WHERE runs AND item_id IS NOT NULL),
    'items', count(DISTINCT item_id) FILTER (WHERE runs AND item_id IS NOT NULL),
    'elsewhere', (SELECT count(*) FROM w WHERE w.taken),
    'units', coalesce(sum(units) FILTER (WHERE runs), 0),
    'revenue', coalesce(sum(revenue) FILTER (WHERE runs), 0),
    'orders', coalesce(sum(orders) FILTER (WHERE runs), 0),
    'price_sum', coalesce(sum(price) FILTER (WHERE runs), 0),
    'google_orders', coalesce(sum(g_orders), 0),
    'ads_cost', coalesce(sum(a_cost), 0),
    'ads_conversions', coalesce(sum(greatest(a_conv, g_orders)) FILTER (WHERE a_cost IS NOT NULL), 0),
    'ads_value', coalesce(sum(greatest(a_value, g_revenue)) FILTER (WHERE a_cost IS NOT NULL), 0))
  FROM m
$$;

-- 4. Numele și poza produselor din cifrele Google (ID-ul din Merchant Center, fără litere mari)
CREATE OR REPLACE FUNCTION plan_offers_by_items(p_store_id uuid, p_items text[])
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'item', lower(btrim(coalesce(c.plan_item_id, c.merchant_offer_id, c.offer_id))), 'offer_id', c.offer_id,
           'title', coalesce(nullif(c.product_name, ''), c.title), 'variant_title', c.variant_title, 'image_url', c.image_url)), '[]'::jsonb)
    FROM commerce_offers c
   WHERE c.store_id = p_store_id
     AND lower(btrim(coalesce(c.plan_item_id, c.merchant_offer_id, c.offer_id))) = ANY (SELECT lower(btrim(x)) FROM unnest(p_items) x)
$$;

-- 5. Pagina Produse: filtrul rapid, căutarea, ordinea, cu vânzările din perioadă și cifrele filtrelor (pe tot magazinul).
--    Doar primele rânduri se sortează (top-N, fără să sorteze tot catalogul), iar numele se compară pe octeți,
--    cu literele românești aduse la cele fără diacritice: regulile alfabetului ar costa o secundă la 42.000 de oferte.
CREATE OR REPLACE FUNCTION catalog_page(p_store_id uuid, p_since timestamptz, p_quick text, p_q text, p_sort text, p_offset integer, p_limit integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH f AS (
    SELECT o.offer_id, o.title, o.price
      FROM commerce_offers o
     WHERE o.store_id = p_store_id
       AND (p_quick IS DISTINCT FROM 'out' OR NOT o.available)
       AND (p_quick IS DISTINCT FROM 'google_issue' OR o.google_status IN ('disapproved', 'error', 'expirat', 'exclus'))
       AND (p_q IS NULL OR o.title ILIKE p_q OR o.product_name ILIKE p_q OR o.variant_title ILIKE p_q OR o.sku ILIKE p_q
            OR o.gtin ILIKE p_q OR o.brand ILIKE p_q OR o.category ILIKE p_q OR o.offer_id ILIKE p_q)
  ), s AS (SELECT * FROM commerce_offer_sales(p_store_id, p_since)),
  k AS (
    SELECT f.offer_id, f.title, f.price, coalesce(s.units, 0) AS units, coalesce(s.revenue, 0) AS revenue, coalesce(s.orders, 0) AS orders
      FROM f LEFT JOIN s ON s.offer_id = f.offer_id
  ), p AS (
    SELECT k.*,
           CASE WHEN p_sort = 'price' THEN k.price END AS k1,
           CASE WHEN p_sort = 'revenue' THEN k.revenue END AS k2,
           CASE WHEN coalesce(p_sort, 'sales') = 'sales' THEN k.units END AS k3,
           CASE WHEN coalesce(p_sort, 'sales') = 'sales' THEN k.revenue END AS k4,
           translate(lower(coalesce(k.title, '')), 'ăâîșşțţ', 'aaisstt') COLLATE "C" AS k5
      FROM k
     ORDER BY k1 DESC NULLS LAST, k2 DESC NULLS LAST, k3 DESC NULLS LAST, k4 DESC NULLS LAST, k5, k.offer_id COLLATE "C"
     LIMIT greatest(1, least(p_limit, 100)) OFFSET greatest(0, p_offset)
  )
  SELECT jsonb_build_object(
    'counts', (SELECT jsonb_build_object(
                 'all', count(*),
                 'out', count(*) FILTER (WHERE NOT o.available),
                 'google_issue', count(*) FILTER (WHERE o.google_status IN ('disapproved', 'error', 'expirat', 'exclus')))
                 FROM commerce_offers o WHERE o.store_id = p_store_id),
    'total', (SELECT count(*) FROM k),
    'rows', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'offer_id', o.offer_id, 'external_product_id', o.external_product_id, 'item_group_id', o.item_group_id,
               'title', o.title, 'product_name', o.product_name, 'variant_title', o.variant_title, 'category', o.category,
               'url', o.url, 'image_url', o.image_url, 'price', o.price, 'compare_at_price', o.compare_at_price, 'currency', o.currency,
               'available', o.available, 'stock', o.stock, 'sku', o.sku, 'gtin', o.gtin, 'brand', o.brand,
               'google_status', o.google_status, 'synced_at', o.synced_at,
               'sales', jsonb_build_object('units', p.units, 'revenue', p.revenue, 'orders', p.orders))
             ORDER BY p.k1 DESC NULLS LAST, p.k2 DESC NULLS LAST, p.k3 DESC NULLS LAST, p.k4 DESC NULLS LAST, p.k5, p.offer_id COLLATE "C")
        FROM p JOIN commerce_offers o ON o.store_id = p_store_id AND o.offer_id = p.offer_id
    ), '[]'::jsonb))
$$;

-- Cheia anon ajunge în browser: funcțiile le cheamă numai serverul (service role)
REVOKE ALL ON FUNCTION set_plan_offers(uuid, text[], text[], uuid[], text[]) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION plan_rule_match(text, text, text, numeric, numeric, text[], text[], text[], text[], numeric, numeric, boolean) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION plan_offer_page(uuid, timestamptz, timestamptz, date, text, text, jsonb, uuid, uuid[], integer, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION plan_group_preview(uuid, timestamptz, timestamptz, date, jsonb, uuid[]) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION plan_offers_by_items(uuid, text[]) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION catalog_page(uuid, timestamptz, text, text, text, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION set_plan_offers(uuid, text[], text[], uuid[], text[]) TO service_role;
GRANT EXECUTE ON FUNCTION plan_rule_match(text, text, text, numeric, numeric, text[], text[], text[], text[], numeric, numeric, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION plan_offer_page(uuid, timestamptz, timestamptz, date, text, text, jsonb, uuid, uuid[], integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION plan_group_preview(uuid, timestamptz, timestamptz, date, jsonb, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION plan_offers_by_items(uuid, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION catalog_page(uuid, timestamptz, text, text, text, integer, integer) TO service_role;

-- Prima variantă a regulilor (plan_group_wants, jsonb citit pe fiecare ofertă: 1,4 s la 42.000) a rămas în
-- baza de date, nefolosită: ștergerea cere confirmarea omului în MCP. De rulat când e de față:
-- DROP FUNCTION IF EXISTS plan_group_wants(text, text, text, numeric, numeric, jsonb);
