-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — limba interfeței, în cont
-- Run this in Supabase SQL Editor (aplicată prin MCP pe 25.10.2026)
--
-- Limba aleasă de om (română / engleză). Interfața o folosește pe
-- dispozitivele unde n-a ales încă nimic, iar e-mailurile pleacă în ea.
-- NULL = n-a ales: limba se deduce din țară și din limba browserului.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_locale text CHECK (ui_locale IN ('ro', 'en'));
