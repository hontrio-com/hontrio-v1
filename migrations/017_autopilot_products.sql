-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — produsele scoase de pilot și grupele de marjă
-- Run this in Supabase SQL Editor (aplicată prin MCP pe 25.10.2026)
--
-- Doar ADĂUGIRI.
-- ═══════════════════════════════════════════════════════════════════════

-- Produsul a fost scos din campanii de pilot (după cifrele din Google Ads).
-- Alegerea omului (ads_mode = 'include') are întâietate: pilotul nu-l mai scoate.
ALTER TABLE commerce_offers ADD COLUMN IF NOT EXISTS ads_auto_reason text
  CHECK (ads_auto_reason IS NULL OR ads_auto_reason IN ('no_sales', 'unprofitable'));
ALTER TABLE commerce_offers ADD COLUMN IF NOT EXISTS ads_auto_at timestamptz;

-- Campania de marjă mare rulează doar pe lista ei (NULL = tot catalogul, minus excluderi)
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS included_item_ids text[];
