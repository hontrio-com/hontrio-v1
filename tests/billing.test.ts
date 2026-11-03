import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PACKS, PACK_IDS, PAID_PLANS, PLAN_IDS, paidPlan, perCreditUsd, planPriceUsd } from '@/lib/billing/catalog'
import { purchaseRevenue, revenueTotals, type CreditTx } from '@/lib/billing/revenue'

// Prețurile dintr-un singur loc și veniturile din admin deduse din ele.

test('planurile și pachetele au mărimi diferite, ca o achiziție să se poată recunoaște după credite', () => {
  const planCredits = PLAN_IDS.map(id => PAID_PLANS[id].credits)
  const packCredits = PACK_IDS.map(id => PACKS[id].credits)
  const all = [...planCredits, ...packCredits]
  assert.equal(new Set(all).size, all.length)
  for (const id of PLAN_IDS) assert.ok(PAID_PLANS[id].priceUsd > 0)
  for (const id of PACK_IDS) assert.ok(Number.isInteger(PACKS[id].priceUsd * 100))
})

test('prețul unui plan și prețul pe credit al unui pachet', () => {
  assert.equal(planPriceUsd('starter'), 19)
  assert.equal(planPriceUsd('enterprise'), 99)
  assert.equal(planPriceUsd('free'), 0)
  assert.equal(planPriceUsd(null), 0)
  assert.equal(planPriceUsd('toString'), 0) // nu o proprietate moștenită
  assert.equal(paidPlan('professional')?.credits, 400)
  assert.equal(paidPlan('free'), null)
  assert.equal(perCreditUsd('pack_300').toFixed(2), '0.12')
  assert.equal(perCreditUsd('pack_1000').toFixed(2), '0.10')
})

test('o achiziție se evaluează după tipul ei și creditele primite', () => {
  assert.deepEqual(purchaseRevenue({ type: 'purchase', reference_type: 'subscription', amount: 150 }), { kind: 'subscription', usd: 19 })
  assert.deepEqual(purchaseRevenue({ type: 'purchase', reference_type: 'subscription_renewal', amount: 900 }), { kind: 'subscription', usd: 99 })
  assert.deepEqual(purchaseRevenue({ type: 'purchase', reference_type: 'credit_purchase', amount: 300 }), { kind: 'pack', usd: 35 })
  // Fără tip de referință: după credite
  assert.deepEqual(purchaseRevenue({ type: 'purchase', reference_type: null, amount: 400 }), { kind: 'subscription', usd: 49 })
  assert.deepEqual(purchaseRevenue({ type: 'purchase', amount: 500 }), { kind: 'pack', usd: 55 })
})

test('ce nu e o plată sau nu se potrivește cu niciun preț nu aduce venit', () => {
  assert.equal(purchaseRevenue({ type: 'usage', reference_type: 'image_generation', amount: -6 }), null)
  assert.equal(purchaseRevenue({ type: 'bonus', reference_type: null, amount: 100 }), null)
  assert.equal(purchaseRevenue({ type: 'manual', reference_type: null, amount: 300 }), null)
  // Un pachet de mărimea unui plan nu e luat drept abonament, și invers
  assert.equal(purchaseRevenue({ type: 'purchase', reference_type: 'credit_purchase', amount: 900 }), null)
  assert.equal(purchaseRevenue({ type: 'purchase', reference_type: 'subscription', amount: 300 }), null)
  // Creditele ofertelor de dinainte de 19 martie 2026 (2000 la Enterprise) nu mai există
  assert.equal(purchaseRevenue({ type: 'purchase', reference_type: 'subscription', amount: 2000 }), null)
  assert.equal(purchaseRevenue({ type: 'purchase', reference_type: 'subscription_cancelled', amount: 150 }), null)
})

test('cele 7 achiziții reale (martie–mai 2026) fac $549: $316 abonamente și $233 pachete', () => {
  const real: CreditTx[] = [
    { type: 'purchase', reference_type: 'credit_purchase', amount: 300 },
    { type: 'purchase', reference_type: 'subscription', amount: 900 },
    { type: 'purchase', reference_type: 'credit_purchase', amount: 1000 },
    { type: 'purchase', reference_type: 'credit_purchase', amount: 1000 },
    { type: 'purchase', reference_type: 'subscription', amount: 150 },
    { type: 'purchase', reference_type: 'subscription_renewal', amount: 900 },
    { type: 'purchase', reference_type: 'subscription_renewal', amount: 900 },
    // Consumul de credite din aceeași perioadă nu contează
    { type: 'usage', reference_type: 'text_generation', amount: -3 },
  ]
  assert.deepEqual(revenueTotals(real), { subscriptions: 316, packs: 233, total: 549 })
})
