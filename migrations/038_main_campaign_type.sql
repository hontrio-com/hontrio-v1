-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — tipul campaniei principale, ales de om
--
-- Doar ADĂUGIRI. Pe ciornă (rândul cu setările campaniei principale, unul pe
-- magazin), `chosen_type`:
-- - 'auto' (implicit): Hontrio alege după cumpărările din 30 de zile, Shopping
--   standard sub 15, apoi Performance Max (pilotul face trecerea);
-- - 'performance_max': Performance Max de la lansare, oricâte conversii ar
--   avea contul.
-- Pe campaniile lansate coloana rămâne 'auto' și nu înseamnă nimic: tipul lor
-- e în `type`, iar `stage` spune dacă mai pot trece la Performance Max.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS chosen_type text NOT NULL DEFAULT 'auto'
  CHECK (chosen_type IN ('auto', 'performance_max'));
