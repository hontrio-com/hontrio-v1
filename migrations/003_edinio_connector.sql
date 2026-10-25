-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — conectorul Edinio și modelul comun de comerț
-- (oferte din catalog, comenzi și liniile lor, multi-monedă)
-- Run this in Supabase SQL Editor
--
-- Doar ADĂUGIRI: nicio coloană existentă nu se schimbă și nimic nu se
-- șterge. Codul vechi (WooCommerce / Shopify) merge neatins.
--
-- Tabelele commerce_* nu țin date personale ale cumpărătorilor: Edinio
-- nu le trimite (vezi docs/hontrio/CONECTOR.md în repo-ul Edinio).
-- ═══════════════════════════════════════════════════════════════════════

-- 1. stores: ce are nevoie modelul de reclame de la orice platformă
ALTER TABLE stores ADD COLUMN IF NOT EXISTS external_id        text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS timezone           text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS platform_data      jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS connection_status  text
  CHECK (connection_status IN ('active', 'revoked', 'error'));
ALTER TABLE stores ADD COLUMN IF NOT EXISTS last_error         text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS orders_count       integer NOT NULL DEFAULT 0;
-- Până unde s-a citit sigur (începutul ultimei treceri complete).
-- Următoarea trecere cere „ce s-a schimbat de atunci", cu suprapunere.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS products_watermark timestamptz;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS orders_watermark   timestamptz;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS last_full_sync_at  timestamptz;

-- 2. Ofertele din catalog: una pe produs simplu, una pe variantă.
-- offer_id = offerId din Merchant Center = segments.product_item_id din
-- rapoartele Google Ads. Pe el se leagă performanța de produs.
CREATE TABLE IF NOT EXISTS commerce_offers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id             uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id             text NOT NULL,
  external_product_id  text NOT NULL,
  item_group_id        text,
  title                text NOT NULL,
  product_name         text,
  variant_title        text,
  category             text,
  url                  text,
  image_url            text,
  price                numeric(12,2) NOT NULL,
  compare_at_price     numeric(12,2),
  currency             text NOT NULL,
  available            boolean NOT NULL,
  stock                integer,                 -- NULL = stoc neurmărit (nelimitat)
  sku                  text,
  gtin                 text,
  mpn                  text,
  brand                text,
  custom_labels        jsonb NOT NULL DEFAULT '{}'::jsonb,
  google_status        text,                    -- starea la Google văzută de platformă
  cost_price           numeric(12,2),           -- introdus în Hontrio; sincronizarea NU îl scrie
  source_updated_at    timestamptz,
  synced_at            timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, offer_id)
);

CREATE INDEX IF NOT EXISTS idx_commerce_offers_product
  ON commerce_offers(store_id, external_product_id);

-- 3. Comenzile. `status` e cel al platformei, `state` e același lucru spus
-- la fel pentru toate platformele (pending / confirmed / fulfilled /
-- cancelled / refunded), ca rapoartele să nu depindă de platformă.
CREATE TABLE IF NOT EXISTS commerce_orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id           uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_id        text NOT NULL,
  order_number       text,
  placed_at          timestamptz NOT NULL,
  source_updated_at  timestamptz,
  status             text NOT NULL,
  state              text NOT NULL
                       CHECK (state IN ('pending', 'confirmed', 'fulfilled', 'cancelled', 'refunded')),
  payment_status     text,
  payment_method     text,
  channel            text NOT NULL DEFAULT 'store',   -- 'store' sau marketplace-ul
  currency           text NOT NULL,
  subtotal           numeric(12,2) NOT NULL DEFAULT 0,
  shipping           numeric(12,2) NOT NULL DEFAULT 0,
  discount           numeric(12,2) NOT NULL DEFAULT 0, -- toate reducerile la un loc
  fees               numeric(12,2) NOT NULL DEFAULT 0, -- taxa de ramburs și altele
  tax                numeric(12,2) NOT NULL DEFAULT 0,
  total              numeric(12,2) NOT NULL DEFAULT 0,
  discount_code      text,
  country            text,
  gclid              text,
  utm_source         text,
  utm_medium         text,
  utm_campaign       text,
  attribution        jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at          timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_commerce_orders_placed
  ON commerce_orders(store_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_gclid
  ON commerce_orders(store_id, gclid) WHERE gclid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commerce_orders_campaign
  ON commerce_orders(store_id, utm_campaign) WHERE utm_campaign IS NOT NULL;

-- 4. Liniile comenzilor: venitul pe ofertă, pentru ROAS pe produs.
CREATE TABLE IF NOT EXISTS commerce_order_lines (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  store_id             uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  position             integer NOT NULL,
  external_product_id  text,
  offer_id             text,
  name                 text NOT NULL,
  variant_title        text,
  quantity             numeric(12,3) NOT NULL DEFAULT 0,
  unit_price           numeric(12,2) NOT NULL DEFAULT 0,
  is_extra             boolean NOT NULL DEFAULT false,
  synced_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, position)
);

CREATE INDEX IF NOT EXISTS idx_commerce_order_lines_offer
  ON commerce_order_lines(store_id, offer_id) WHERE offer_id IS NOT NULL;

-- Only the server (service role) reads these tables
ALTER TABLE commerce_offers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_order_lines ENABLE ROW LEVEL SECURITY;
