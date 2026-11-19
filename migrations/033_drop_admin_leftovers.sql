-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio — ce nu se mai folosește din migrarea 031 (19.11.2026). De aplicat
-- prin MCP, cu acordul omului (ștergeri):
-- - admin_store_summaries: aduna cifrele din Google Ads ale clienților, pe
--   care panoul de administrare nu le mai arată (politica de confidențialitate);
-- - admin_impersonations: jurnalul „Conectare”, gol, funcția a fost scoasă.
-- users.last_seen_at rămâne.
-- ═══════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS admin_store_summaries(timestamptz, uuid);
DROP TABLE IF EXISTS admin_impersonations;
