-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — facturarea (18.11.2026). Aplicată prin MCP.
--
-- Taxa lunară din Termeni, art. 9: pentru fiecare magazin, din vânzările
-- aduse de campaniile Hontrio în luna calendaristică; factura se emite în
-- SmartBill pe 15 ale lunii următoare, cu termen de plată de 10 zile.
--
-- 1. billing_profiles: datele firmei clientului, pentru factură.
-- 2. billing_config: data de la care se numără vânzările (nulă = facturarea
--    oprită, ca în perioada de lansare, art. 9.5) și anunțul de 30 de zile.
-- 3. billing_statements: situația lunară a fiecărui magazin (comenzile
--    numărate, taxa) și factura ei. Rândul rămâne și după ștergerea
--    magazinului sau a contului: factura e un document contabil.
-- 4. billing_exclusions: comenzile scoase din calcul după o contestație.
-- 5. stores.billing_suspended_at: pilotul oprit pentru o factură neplătită
--    (art. 13); campaniile rămân în Google Ads.
-- Totul se citește și se scrie numai din server (service role), ca restul.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS billing_profiles (
  user_id      uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  vat_code     text NOT NULL,
  reg_com      text,
  is_vat_payer boolean NOT NULL DEFAULT false,
  address      text NOT NULL,
  city         text NOT NULL,
  county       text,
  country      text NOT NULL DEFAULT 'RO',
  email        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_config (
  id             smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  start_date     date,
  notice_sent_at timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid REFERENCES users(id) ON DELETE SET NULL
);
INSERT INTO billing_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS billing_statements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES users(id) ON DELETE SET NULL,
  store_id         uuid REFERENCES stores(id) ON DELETE SET NULL,
  store_name       text NOT NULL,
  period           date NOT NULL,
  currency         text NOT NULL CHECK (currency IN ('RON', 'EUR')),
  sales            numeric(14,2) NOT NULL DEFAULT 0,
  orders_count     integer NOT NULL DEFAULT 0,
  -- taxa din grilă pentru vânzările lunii
  fee              numeric(12,2) NOT NULL DEFAULT 0,
  -- creditul folosit din rambursările de după facturile trecute (art. 9.3), cu minus
  adjustment       numeric(12,2) NOT NULL DEFAULT 0,
  -- de plată: fee + adjustment; creditul rămas trece în luna următoare
  amount           numeric(12,2) NOT NULL DEFAULT 0,
  credit_carry     numeric(12,2) NOT NULL DEFAULT 0,
  -- comenzile numărate (lista de la art. 9.2), cu valoarea în moneda situației
  orders           jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- comenzile din lunile facturate trecute în credit aici (rambursate, anulate, contestate)
  adjusted_orders  jsonb NOT NULL DEFAULT '[]'::jsonb,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('free', 'pending', 'needs_profile', 'issuing', 'invoiced', 'paid', 'error', 'void')),
  invoice_series   text,
  invoice_number   text,
  invoice_url      text,
  payment_url      text,
  invoice_total    numeric(12,2),
  issued_at        timestamptz,
  due_date         date,
  paid_at          timestamptz,
  reminders        smallint NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  error            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, period)
);
CREATE INDEX IF NOT EXISTS idx_billing_statements_user   ON billing_statements (user_id, period DESC);
CREATE INDEX IF NOT EXISTS idx_billing_statements_status ON billing_statements (status) WHERE status IN ('pending', 'needs_profile', 'issuing', 'invoiced', 'error');

CREATE TABLE IF NOT EXISTS billing_exclusions (
  order_id   uuid PRIMARY KEY REFERENCES commerce_orders(id) ON DELETE CASCADE,
  reason     text NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stores ADD COLUMN IF NOT EXISTS billing_suspended_at timestamptz;

ALTER TABLE billing_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_exclusions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON billing_profiles, billing_config, billing_statements, billing_exclusions FROM anon, authenticated;
