-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — jurnalul intrărilor echipei în conturile clienților (22.11.2026).
-- Aplicată prin MCP.
--
-- „Conectare” din panoul de administrare: administratorul intră în contul unui
-- client, cel mult o oră, doar dacă acesta a acceptat Termenii cu accesul
-- echipei pentru suport (art. 10.5, versiunea 2026-11-22). Fiecare intrare și
-- ieșire rămâne aici; clientul le vede în Setări, la Securitate.
-- (Tabelul a existat în migrarea 031 și a fost scos în 033, când „Conectare”
-- a fost scoasă; acum revine, cu acordul clientului prin Termeni.)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS admin_impersonations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  admin_email text NOT NULL,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  user_email  text NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  ended_at    timestamptz,
  ended_by    text CHECK (ended_by IN ('admin', 'expired', 'session')),
  ip          text,
  user_agent  text
);
CREATE INDEX IF NOT EXISTS idx_admin_impersonations_user  ON admin_impersonations (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_impersonations_admin ON admin_impersonations (admin_id, started_at DESC);
ALTER TABLE admin_impersonations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_impersonations FROM anon, authenticated;
