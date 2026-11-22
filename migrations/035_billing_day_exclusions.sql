-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — zilele Gomag scoase din calcul după o contestație (22.11.2026).
-- Aplicată prin MCP.
--
-- La Gomag, platforma nu dă sursa comenzii, așa că taxa se calculează din
-- conversiile Google Ads ale campaniilor Hontrio, pe zile (Termeni, art. 9.2).
-- Rândul contestat este ziua magazinului, nu o comandă, deci nu încape în
-- billing_exclusions (cheia ei este comanda).
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS billing_day_exclusions (
  store_id   uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  day        date NOT NULL,
  reason     text NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, day)
);

ALTER TABLE billing_day_exclusions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON billing_day_exclusions FROM anon, authenticated;
