-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — sincronizarea completă se poate relua
-- Run this in Supabase SQL Editor (aplicată prin MCP pe 25.10.2026)
--
-- Un magazin WooCommerce mare nu încape într-o singură rulare a cronului
-- (5 minute): trecerea completă își scrie aici unde a rămas, iar rularea
-- următoare continuă de acolo. NULL = nicio trecere completă în curs.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE stores ADD COLUMN IF NOT EXISTS sync_cursor jsonb;
