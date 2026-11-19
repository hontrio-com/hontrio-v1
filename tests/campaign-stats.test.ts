import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addRow, change, derive, emptyTotals, isStatsPeriod } from '@/lib/campaigns/stats'

// Fișa unei campanii: sumele din Google Ads și ce se socotește din ele. O împărțire la zero nu are rezultat.

test('VetDepo, prima zi: 30 de clicuri, 2.593 de afișări, 31,92 lei, nicio vânzare', () => {
  const t = addRow(emptyTotals(), { cost: '31.92', clicks: 30, impressions: 2593, conversions: 0, conversions_value: 0 })
  const d = derive(t)
  assert.equal(Math.round(d.ctr! * 10000) / 10000, 0.0116)
  assert.equal(Math.round(d.cpc! * 100) / 100, 1.06)
  assert.equal(d.conv_rate, 0)
  // Fără conversii: costul pe conversie și valoarea medie nu există; ROAS-ul e zero (a cheltuit, n-a vândut)
  assert.equal(d.cost_per_conv, null)
  assert.equal(d.avg_value, null)
  assert.equal(d.roas, 0)
})

test('sumele se adună pe zile; cifrele se socotesc din sume, nu din medii', () => {
  const t = emptyTotals()
  addRow(t, { cost: 10, clicks: 10, impressions: 100, conversions: 1, conversions_value: 100 })
  addRow(t, { cost: 30, clicks: 10, impressions: 900, conversions: 1.5, value: 150 })
  assert.deepEqual(t, { cost: 40, clicks: 20, impressions: 1000, conversions: 2.5, value: 250 })
  const d = derive(t)
  assert.equal(d.ctr, 0.02)
  assert.equal(d.cpc, 2)
  assert.equal(d.conv_rate, 0.125)
  assert.equal(d.cost_per_conv, 16)
  assert.equal(d.roas, 6.25)
  assert.equal(d.avg_value, 100)
  // Fără nimic: nicio cifră socotită
  assert.deepEqual(derive(emptyTotals()), { ctr: null, cpc: null, conv_rate: null, cost_per_conv: null, roas: null, avg_value: null })
})

test('schimbarea față de perioada de dinainte; fără bază, nimic', () => {
  assert.equal(change(150, 100), 0.5)
  assert.equal(change(50, 100), -0.5)
  assert.equal(change(10, 0), null)
  assert.equal(change(null, 5), null)
  assert.equal(change(5, null), null)
  assert.ok(isStatsPeriod(7) && isStatsPeriod(30) && isStatsPeriod(90))
  assert.ok(!isStatsPeriod(14))
})
