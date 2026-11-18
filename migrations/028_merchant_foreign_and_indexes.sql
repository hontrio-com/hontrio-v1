-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — produsele străine din Merchant Center și indexurile cerute de
-- sfaturile Supabase (18.11.2026). Aplicată prin MCP.
--
-- 1. merchant_insights primește tipul `foreign_items`: produsele din contul
--    Merchant Center care nu sunt ale magazinului, dar ar intra în campanie
--    (le scrie sincronizarea Merchant, le exclude planul).
-- 2. password_reset_tokens avea două indexuri identice pe token_hash; rămâne
--    cel din migrația 025.
-- 3. Cheile străine fără index primesc unul (ștergerile în cascadă și
--    filtrele pe utilizator nu mai citesc tot tabelul).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE merchant_insights DROP CONSTRAINT IF EXISTS merchant_insights_kind_check;
ALTER TABLE merchant_insights ADD CONSTRAINT merchant_insights_kind_check
  CHECK (kind IN ('price_competitiveness', 'price_insights', 'best_sellers', 'foreign_items'));

DROP INDEX IF EXISTS idx_reset_tokens_hash;

CREATE INDEX IF NOT EXISTS idx_ad_actions_ad_campaign       ON ad_actions (ad_campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_actions_user              ON ad_actions (user_id);
CREATE INDEX IF NOT EXISTS idx_ad_product_groups_user       ON ad_product_groups (user_id);
CREATE INDEX IF NOT EXISTS idx_commerce_offers_user         ON commerce_offers (user_id);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_user         ON commerce_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_google_audits_user           ON google_audits (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_notification ON notification_reads (notification_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_by     ON notifications (created_by);
CREATE INDEX IF NOT EXISTS idx_ticket_replies_user          ON ticket_replies (user_id);
CREATE INDEX IF NOT EXISTS idx_users_active_store           ON users (active_store_id);
