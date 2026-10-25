-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — Shopify pe modelul comun: costurile din „Cost per item"
-- Run this in Supabase SQL Editor (aplicată prin MCP pe 25.10.2026)
--
-- commerce_offers.cost_source primește și 'shopify' (costul preluat din
-- Shopify, ca 'woocommerce'): completează golurile și înlocuiește estimările,
-- costul scris de om rămâne (commerce_import_costs).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE commerce_offers DROP CONSTRAINT IF EXISTS commerce_offers_cost_source_check;
ALTER TABLE commerce_offers ADD CONSTRAINT commerce_offers_cost_source_check
  CHECK (cost_source IN ('manual', 'estimate', 'woocommerce', 'shopify'));
