// =============================================
// Prețurile Hontrio, într-un singur loc. De aici citesc checkout-ul Stripe,
// paginile Abonament și Setări și veniturile din admin; nu le copia în alte fișiere.
//
// Abonamentele se încasează prin Price ID-urile din Stripe (lib/stripe/client.ts),
// așa că prețul de aici trebuie să fie cel setat acolo. Pachetele de credite se
// încasează exact cu suma de aici (checkout-ul o trimite la Stripe, în USD).
//
// ⚠ Baza de date păstrează doar creditele primite, nu și suma plătită, iar veniturile
// din admin se deduc din prețurile de aici (lib/billing/revenue.ts). Toate achizițiile
// de până acum s-au făcut la prețurile de azi, în vigoare din 19 martie 2026. Dacă le
// schimbi, păstrează și vechile oferte, altfel achizițiile vechi se reevaluează sau
// ajung să valoreze 0.
// =============================================

export type PlanId = 'starter' | 'professional' | 'enterprise'
export type PackId = 'pack_50' | 'pack_100' | 'pack_300' | 'pack_500' | 'pack_1000'

/** Planurile plătite: creditele primite în fiecare lună și prețul lunar. */
export const PAID_PLANS: Record<PlanId, { name: string; credits: number; priceUsd: number }> = {
  starter: { name: 'Starter', credits: 150, priceUsd: 19 },
  professional: { name: 'Professional', credits: 400, priceUsd: 49 },
  enterprise: { name: 'Enterprise', credits: 900, priceUsd: 99 },
}

/** Pachetele de credite, cumpărate o singură dată; creditele nu expiră. */
export const PACKS: Record<PackId, { credits: number; priceUsd: number }> = {
  pack_50: { credits: 50, priceUsd: 9 },
  pack_100: { credits: 100, priceUsd: 15 },
  pack_300: { credits: 300, priceUsd: 35 },
  pack_500: { credits: 500, priceUsd: 55 },
  pack_1000: { credits: 1000, priceUsd: 99 },
}

export const PLAN_IDS = Object.keys(PAID_PLANS) as PlanId[]
export const PACK_IDS = Object.keys(PACKS) as PackId[]

/** Planul plătit cu acest id, sau null pentru planul gratuit ori unul necunoscut. */
export function paidPlan(plan: string | null | undefined) {
  return plan && Object.prototype.hasOwnProperty.call(PAID_PLANS, plan) ? PAID_PLANS[plan as PlanId] : null
}

/** Prețul lunar al unui plan, în USD; 0 pentru planul gratuit sau unul necunoscut. */
export function planPriceUsd(plan: string | null | undefined): number {
  return paidPlan(plan)?.priceUsd ?? 0
}

/** Cât costă un credit dintr-un pachet, în USD. */
export function perCreditUsd(pack: PackId): number {
  return PACKS[pack].priceUsd / PACKS[pack].credits
}
