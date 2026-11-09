// =============================================
// Cât ne costă o generare la furnizorii AI, în USD. Sunt estimări folosite doar în
// admin (Statistici, Costuri, Raport financiar); nu le copia în alte fișiere — erau
// trei copii, iar Raportul financiar ajunsese să socotească altfel imaginile.
//
// Text, GPT-4o-mini: $0.15 / 1M tokeni la intrare și $0.60 / 1M la ieșire. O generare
// are cam 800 + 1.500 de tokeni ≈ $0.001; $0.004 acoperă reîncercările, promptul de
// sistem și textele mai lungi.
// Imagine, KIE Nano Banana Pro: $0.09 la 1K și 2K, $0.12 la 4K. Generăm la 1K, iar
// $0.10 acoperă reîncercările și interogările repetate până e gata imaginea.
// =============================================

/** O generare de text (GPT-4o-mini), în USD. */
export const COST_PER_TEXT_GENERATION = 0.004

/** O generare de imagine (KIE Nano Banana Pro, 1K), în USD. */
export const COST_PER_IMAGE_GENERATION = 0.1
