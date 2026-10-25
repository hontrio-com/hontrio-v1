-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — constrângerile din `stores`, aliniate cu ce scrie codul
-- Run this in Supabase SQL Editor (aplicată prin MCP pe 25.10.2026)
--
-- 1. `edinio` devine platformă permisă (conectorul Edinio, migrația 003).
--
-- 2. `sync_status`: codul de sincronizare WooCommerce/Shopify scrie de mult
--    'syncing' și 'saving' (progresul din onboarding), dar constrângerea le
--    respingea. supabase-js nu aruncă la o constrângere încălcată, deci
--    actualizarea cădea în tăcere și progresul nu s-a văzut niciodată.
--    Sincronizarea Edinio se bazează pe 'syncing' ca să nu ruleze de două
--    ori deodată pe același magazin, deci aici devine obligatoriu.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_platform_check;
ALTER TABLE stores ADD CONSTRAINT stores_platform_check
  CHECK (platform IN ('woocommerce', 'shopify', 'gomag', 'merchantpro', 'emag', 'edinio'));

ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_sync_status_check;
ALTER TABLE stores ADD CONSTRAINT stores_sync_status_check
  CHECK (sync_status IN ('pending', 'active', 'paused', 'error', 'syncing', 'saving'));
