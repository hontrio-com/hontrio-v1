-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — Google Ads connection
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- One Google login per Hontrio user. The refresh token is encrypted
-- with lib/security/encryption.ts (AES-256-GCM).
CREATE TABLE IF NOT EXISTS google_connections (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  google_user_id           text NOT NULL,
  google_email             text,
  refresh_token_encrypted  text NOT NULL,
  scopes                   text[] NOT NULL DEFAULT '{}',
  status                   text NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'revoked', 'error')),
  last_error               text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Google Ads accounts reachable through the connection.
-- login_customer_id = the manager account the client account is reached
-- through (required as the login-customer-id header); NULL for direct access.
CREATE TABLE IF NOT EXISTS google_ads_accounts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connection_id      uuid NOT NULL REFERENCES google_connections(id) ON DELETE CASCADE,
  customer_id        text NOT NULL CHECK (customer_id ~ '^[0-9]{10}$'),
  login_customer_id  text CHECK (login_customer_id ~ '^[0-9]{10}$'),
  descriptive_name   text,
  currency_code      text,
  time_zone          text,
  is_manager         boolean NOT NULL DEFAULT false,
  is_test_account    boolean NOT NULL DEFAULT false,
  is_selected        boolean NOT NULL DEFAULT false,
  status             text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_google_ads_accounts_connection
  ON google_ads_accounts(connection_id);

-- At most one selected account per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_google_ads_accounts_one_selected
  ON google_ads_accounts(user_id) WHERE is_selected;

-- Only the server (service role) reads these tables
ALTER TABLE google_connections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_accounts ENABLE ROW LEVEL SECURITY;
