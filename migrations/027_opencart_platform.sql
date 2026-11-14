-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — `opencart` devine platformă permisă (14.11.2026)
-- Aplicată prin MCP.
--
-- Conectorii Gomag, MerchantPro și OpenCart scriu în modelul comun.
-- `gomag` și `merchantpro` erau deja permise (migrația 004); OpenCart se
-- leagă prin extensia Hontrio (docs/integrari/OPENCART.md).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_platform_check;
ALTER TABLE stores ADD CONSTRAINT stores_platform_check
  CHECK (platform IN ('woocommerce', 'shopify', 'gomag', 'merchantpro', 'opencart', 'emag', 'edinio'));
