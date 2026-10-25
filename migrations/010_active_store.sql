-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — mai multe magazine pe același cont
-- Run this in Supabase SQL Editor (aplicată prin MCP pe 25.10.2026)
--
-- Un cont poate lega acum mai multe magazine (Edinio, WooCommerce,
-- Shopify). Paginile lucrează pe magazinul ales de om; fără alegere, pe
-- cel mai nou. Când magazinul activ se deconectează, alegerea se golește.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS active_store_id uuid REFERENCES stores(id) ON DELETE SET NULL;

-- Conturile cu un singur magazin îl au deja ales: un al doilea magazin nu le
-- schimbă paginile pe nesimțite
UPDATE users u
SET active_store_id = s.id
FROM stores s
WHERE s.user_id = u.id
  AND u.active_store_id IS NULL
  AND (SELECT count(*) FROM stores s2 WHERE s2.user_id = u.id) = 1;
