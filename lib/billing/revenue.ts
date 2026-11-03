// =============================================
// Cât a adus o tranzacție de credite, pentru rapoartele din admin.
// Baza de date nu păstrează suma plătită, ci doar creditele primite, așa că suma
// se deduce din prețurile din catalog: un abonament (prima plată sau o reînnoire)
// după creditele planului, un pachet după mărimea lui. Vezi avertismentul din
// lib/billing/catalog.ts înainte să schimbi prețurile.
// =============================================

import { PACKS, PAID_PLANS } from './catalog'

/** Câmpurile din credit_transactions de care e nevoie. */
export type CreditTx = { type?: string | null; amount: number; reference_type?: string | null }

export type PurchaseRevenue = { kind: 'subscription' | 'pack'; usd: number }

const SUBSCRIPTION_REFS = new Set(['subscription', 'subscription_renewal'])

const planByCredits = (credits: number) => Object.values(PAID_PLANS).find(p => p.credits === credits)
const packByCredits = (credits: number) => Object.values(PACKS).find(p => p.credits === credits)

/**
 * Venitul unei tranzacții, în USD, sau null dacă nu e o plată (consum, bonus,
 * credite date de admin) ori creditele nu se potrivesc cu niciun preț din catalog.
 */
export function purchaseRevenue(tx: CreditTx): PurchaseRevenue | null {
  if (tx.type !== 'purchase' && tx.type !== 'subscription') return null
  const ref = tx.reference_type ?? null
  if (ref && SUBSCRIPTION_REFS.has(ref)) {
    const plan = planByCredits(tx.amount)
    return plan ? { kind: 'subscription', usd: plan.priceUsd } : null
  }
  if (ref === 'credit_purchase') {
    const pack = packByCredits(tx.amount)
    return pack ? { kind: 'pack', usd: pack.priceUsd } : null
  }
  if (ref) return null
  // Fără tip de referință: după credite (planurile și pachetele au mărimi diferite)
  const plan = planByCredits(tx.amount)
  if (plan) return { kind: 'subscription', usd: plan.priceUsd }
  const pack = packByCredits(tx.amount)
  return pack ? { kind: 'pack', usd: pack.priceUsd } : null
}

/** Veniturile unor tranzacții, separat pe abonamente și pachete, în USD. */
export function revenueTotals(txs: readonly CreditTx[]): { subscriptions: number; packs: number; total: number } {
  let subscriptions = 0
  let packs = 0
  for (const tx of txs) {
    const r = purchaseRevenue(tx)
    if (r?.kind === 'subscription') subscriptions += r.usd
    else if (r?.kind === 'pack') packs += r.usd
  }
  return { subscriptions, packs, total: subscriptions + packs }
}
