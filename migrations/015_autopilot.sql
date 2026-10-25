-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — pilotul automat: lansarea campaniilor, metricile, bucla de
-- optimizare și Merchant Center (vezi docs/campanii/SPECIFICATIE.md)
-- Run this in Supabase SQL Editor (aplicată prin MCP pe 25.10.2026)
--
-- Doar ADĂUGIRI și lărgiri de CHECK: nimic nu se șterge.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. stores: contul Merchant Center al magazinului și ce trimite Hontrio acolo
ALTER TABLE stores ADD COLUMN IF NOT EXISTS merchant_center_id        text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS merchant_feed_label       text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS merchant_content_language text;
-- Sursa suplimentară „Hontrio" (accounts/{id}/dataSources/{id}): costurile și etichetele
ALTER TABLE stores ADD COLUMN IF NOT EXISTS merchant_data_source      text;
-- custom_label_N folosit de Hontrio: primul pe care feedul omului nu-l folosește
ALTER TABLE stores ADD COLUMN IF NOT EXISTS merchant_label_index      smallint
  CHECK (merchant_label_index IS NULL OR merchant_label_index BETWEEN 0 AND 4);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS merchant_synced_at        timestamptz;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS merchant_error            text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS send_costs_to_google      boolean NOT NULL DEFAULT true;
-- Ultima trecere a cronului de reclame (audit, metrici, buclă)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS ads_synced_at             timestamptz;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS ads_sync_error            text;

-- 2. commerce_offers: oferta așa cum o știe Merchant Center
-- (la Edinio e chiar offer_id; la WooCommerce și Shopify se află din Merchant API)
ALTER TABLE commerce_offers ADD COLUMN IF NOT EXISTS merchant_offer_id     text;
ALTER TABLE commerce_offers ADD COLUMN IF NOT EXISTS merchant_issues       jsonb;
-- Ce a trimis Hontrio ultima dată în sursa suplimentară (ca să nu retrimită degeaba)
ALTER TABLE commerce_offers ADD COLUMN IF NOT EXISTS merchant_cogs_pushed  numeric(12,2);
ALTER TABLE commerce_offers ADD COLUMN IF NOT EXISTS merchant_label_pushed text;
CREATE INDEX IF NOT EXISTS idx_commerce_offers_merchant
  ON commerce_offers(store_id, merchant_offer_id) WHERE merchant_offer_id IS NOT NULL;

-- 3. ad_campaigns: ciorna ține setările pilotului; fiecare campanie lansată are rândul ei
ALTER TABLE ad_campaigns DROP CONSTRAINT IF EXISTS ad_campaigns_type_check;
ALTER TABLE ad_campaigns ADD CONSTRAINT ad_campaigns_type_check
  CHECK (type IN ('performance_max', 'shopping'));
ALTER TABLE ad_campaigns DROP CONSTRAINT IF EXISTS ad_campaigns_status_check;
ALTER TABLE ad_campaigns ADD CONSTRAINT ad_campaigns_status_check
  CHECK (status IN ('draft', 'active', 'paused', 'removed', 'ended'));

-- Pe ciornă: cum lucrează pilotul și până unde poate urca bugetul singur
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'approve'
  CHECK (mode IN ('approve', 'auto'));
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS max_daily_budget numeric(12,2)
  CHECK (max_daily_budget IS NULL OR max_daily_budget > 0);

-- Pe campaniile lansate
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS stage text
  CHECK (stage IS NULL OR stage IN ('starter', 'growth', 'segment'));
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS segment               text;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS name                  text;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS merchant_center_id    text;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS feed_label            text;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS google_budget_id      text;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS google_asset_group_id text;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS google_ad_group_id    text;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS target_roas           numeric(8,2);
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS cpc_ceiling           numeric(12,2);
-- Produsele excluse acum din campanie (ID-urile din Merchant Center)
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS excluded_item_ids     text[] NOT NULL DEFAULT '{}';
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS target_changed_at     timestamptz;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS budget_changed_at     timestamptz;
-- De când se socotește limita de pierdere (lansarea sau ultima repornire)
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS loss_check_from       timestamptz;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS last_synced_at        timestamptz;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS last_error            text;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS paused_reason         text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ad_campaigns_google
  ON ad_campaigns (customer_id, google_campaign_id) WHERE google_campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_store ON ad_campaigns (store_id, status);

-- 4. Ultimul audit al contului Google Ads (unul pe magazin)
CREATE TABLE IF NOT EXISTS google_audits (
  store_id     uuid PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id  text NOT NULL,
  result       jsonb NOT NULL,
  checked_at   timestamptz NOT NULL DEFAULT now()
);

-- 5. Metricile din Google Ads, în moneda contului
CREATE TABLE IF NOT EXISTS ad_metrics_daily (
  store_id            uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id         text NOT NULL,
  google_campaign_id  text NOT NULL,
  date                date NOT NULL,
  campaign_name       text,
  channel_type        text,
  cost                numeric(14,2) NOT NULL DEFAULT 0,
  clicks              integer NOT NULL DEFAULT 0,
  impressions         integer NOT NULL DEFAULT 0,
  conversions         numeric(12,2) NOT NULL DEFAULT 0,
  conversions_value   numeric(14,2) NOT NULL DEFAULT 0,
  synced_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, google_campaign_id, date)
);
CREATE INDEX IF NOT EXISTS idx_ad_metrics_daily_date ON ad_metrics_daily (store_id, date);

-- Pe produs: item_id = segments.product_item_id (Google îl dă cu litere mici)
CREATE TABLE IF NOT EXISTS ad_product_metrics_daily (
  store_id            uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  google_campaign_id  text NOT NULL,
  date                date NOT NULL,
  item_id             text NOT NULL,
  cost                numeric(14,2) NOT NULL DEFAULT 0,
  clicks              integer NOT NULL DEFAULT 0,
  impressions         integer NOT NULL DEFAULT 0,
  conversions         numeric(12,2) NOT NULL DEFAULT 0,
  conversions_value   numeric(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, google_campaign_id, date, item_id)
);
CREATE INDEX IF NOT EXISTS idx_ad_product_metrics_item ON ad_product_metrics_daily (store_id, item_id, date);

-- Termenii de căutare pe ultimele 30 de zile (se înlocuiesc la fiecare trecere)
CREATE TABLE IF NOT EXISTS ad_search_terms (
  store_id            uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  google_campaign_id  text NOT NULL,
  search_term         text NOT NULL,
  clicks              integer NOT NULL DEFAULT 0,
  impressions         integer NOT NULL DEFAULT 0,
  cost                numeric(14,2) NOT NULL DEFAULT 0,
  conversions         numeric(12,2) NOT NULL DEFAULT 0,
  conversions_value   numeric(14,2) NOT NULL DEFAULT 0,
  period_start        date NOT NULL,
  period_end          date NOT NULL,
  PRIMARY KEY (store_id, google_campaign_id, search_term)
);

-- 6. Jurnalul pilotului: propuneri, aprobări, ce s-a aplicat
CREATE TABLE IF NOT EXISTS ad_actions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id        uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  ad_campaign_id  uuid REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  kind            text NOT NULL,
  params          jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Mesaj salvat ca cheie de traducere (storedMessage)
  reason          text,
  status          text NOT NULL DEFAULT 'proposed'
                    CHECK (status IN ('proposed', 'applied', 'rejected', 'failed', 'expired')),
  source          text NOT NULL DEFAULT 'autopilot' CHECK (source IN ('autopilot', 'user')),
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  decided_at      timestamptz,
  applied_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_ad_actions_store ON ad_actions (store_id, created_at DESC);
-- O singură propunere deschisă de un fel pe campanie
CREATE UNIQUE INDEX IF NOT EXISTS uq_ad_actions_open
  ON ad_actions (store_id, coalesce(ad_campaign_id, '00000000-0000-0000-0000-000000000000'::uuid), kind)
  WHERE status = 'proposed';

-- 7. Rapoartele de piață din Merchant Center (ultima citire)
CREATE TABLE IF NOT EXISTS merchant_insights (
  store_id    uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('price_competitiveness', 'price_insights', 'best_sellers')),
  rows        jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, kind)
);

-- Le citește și le scrie numai serverul (service role), ca pe commerce_*
ALTER TABLE google_audits            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_metrics_daily         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_product_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_search_terms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_actions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_insights        ENABLE ROW LEVEL SECURITY;
