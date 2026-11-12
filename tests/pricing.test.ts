import { test } from 'node:test'
import assert from 'node:assert/strict'
import { feeShare, monthlyFee, pricingTier, PRICING } from '@/lib/pricing'

// Grila de prețuri: pragurile (inclusiv chiar la limită), exemplele de pe pagina
// /pricing, lipsa plafonului și intrările care nu sunt vânzări.

test('lei: gratuit până la 5.000 inclusiv, 199 lei până la 10.000 inclusiv', () => {
  assert.equal(monthlyFee(0, 'RON'), 0)
  assert.equal(monthlyFee(4999.99, 'RON'), 0)
  assert.equal(monthlyFee(5000, 'RON'), 0)
  assert.equal(monthlyFee(5000.01, 'RON'), 199)
  assert.equal(monthlyFee(7500, 'RON'), 199)
  assert.equal(monthlyFee(10000, 'RON'), 199)
})

test('lei: peste 10.000, 2% din toate vânzările lunii, rotunjit la bani', () => {
  assert.equal(monthlyFee(10000.01, 'RON'), 200)
  assert.equal(monthlyFee(10001, 'RON'), 200.02)
  assert.equal(monthlyFee(12345.67, 'RON'), 246.91)
  // Jumătatea de ban se rotunjește în sus: 2% din 10.000,25 = 200,005
  assert.equal(monthlyFee(10000.25, 'RON'), 200.01)
})

test('lei: exemplele de pe pagină', () => {
  const examples: [number, number][] = [[10000, 199], [25000, 500], [50000, 1000], [75000, 1500], [100000, 2000], [200000, 4000], [500000, 10000]]
  for (const [sales, fee] of examples) assert.equal(monthlyFee(sales, 'RON'), fee, `${sales} lei`)
})

test('euro: gratuit până la 1.000, 39 € până la 2.000, apoi 2%', () => {
  assert.equal(monthlyFee(1000, 'EUR'), 0)
  assert.equal(monthlyFee(1000.01, 'EUR'), 39)
  assert.equal(monthlyFee(2000, 'EUR'), 39)
  assert.equal(monthlyFee(2000.01, 'EUR'), 40)
  const examples: [number, number][] = [[5000, 100], [10000, 200], [50000, 1000]]
  for (const [sales, fee] of examples) assert.equal(monthlyFee(sales, 'EUR'), fee, `${sales} €`)
})

test('fără plafon și fără scăderi: taxa nu scade niciodată când vânzările cresc', () => {
  for (const currency of ['RON', 'EUR'] as const) {
    let previous = 0
    for (let sales = 0; sales <= 40000; sales += 25) {
      const fee = monthlyFee(sales, currency)
      assert.ok(fee >= previous, `${currency} ${sales}: ${fee} < ${previous}`)
      previous = fee
    }
  }
  assert.equal(monthlyFee(10_000_000, 'RON'), 200000)
})

test('treptele și procentul din vânzări', () => {
  assert.equal(pricingTier(PRICING.RON.freeUpTo, 'RON'), 'free')
  assert.equal(pricingTier(PRICING.RON.freeUpTo + 0.01, 'RON'), 'flat')
  assert.equal(pricingTier(PRICING.RON.flatUpTo, 'RON'), 'flat')
  assert.equal(pricingTier(PRICING.RON.flatUpTo + 0.01, 'RON'), 'percent')
  assert.equal(pricingTier(PRICING.EUR.flatUpTo + 0.01, 'EUR'), 'percent')
  assert.equal(feeShare(25000, 'RON'), 2)
  assert.equal(feeShare(7500, 'RON'), 2.65)
  assert.equal(feeShare(5000, 'RON'), 0)
  assert.equal(feeShare(0, 'EUR'), 0)
})

test('ce nu e o sumă de vânzări nu costă nimic', () => {
  assert.equal(monthlyFee(-100, 'RON'), 0)
  assert.equal(monthlyFee(Number.NaN, 'RON'), 0)
  assert.equal(monthlyFee(Number.POSITIVE_INFINITY, 'EUR'), 0)
  assert.equal(feeShare(Number.NaN, 'RON'), 0)
})
