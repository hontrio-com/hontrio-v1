-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — contul Google Ads, pe magazin
-- Run this in Supabase SQL Editor (aplicată prin MCP pe 25.10.2026)
--
-- Conexiunea Google (login-ul) rămâne a omului: un login vede mai multe
-- conturi Google Ads. Contul pe care rulează campaniile unui magazin se alege
-- acum pe magazin: stores.google_ads_customer_id, unul dintre conturile omului
-- (google_ads_accounts, după user_id + customer_id).
-- google_ads_accounts.is_selected nu mai e folosit.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE stores ADD COLUMN IF NOT EXISTS google_ads_customer_id text
  CHECK (google_ads_customer_id ~ '^[0-9]{10}$');

-- Contul ales până acum îl primește magazinul activ al omului
UPDATE stores s SET google_ads_customer_id = a.customer_id
FROM google_ads_accounts a, users u
WHERE a.is_selected AND a.user_id = s.user_id AND u.id = s.user_id
  AND u.active_store_id = s.id AND s.google_ads_customer_id IS NULL;
