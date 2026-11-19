-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — cifrele de azi din Google Ads (19.11.2026). Aplicată prin MCP.
--
-- Trecerea zilnică a pilotului citește doar zilele încheiate, o dată la ~20
-- de ore. Cronul citește acum, din oră în oră, și zilele de după ea (până azi)
-- pentru magazinele cu campanii pornite. Coloana spune când a făcut-o ultima
-- oară: paginile arată ziua de azi doar dacă a fost citită.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE stores ADD COLUMN IF NOT EXISTS ads_today_at timestamptz;
