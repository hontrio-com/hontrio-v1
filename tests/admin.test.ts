import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addSales, emptySales, periodStart } from '@/lib/admin/accounts'
import { addMoney } from '@/lib/admin/money'

// Panoul de administrare: perioadele după ceasul României și banii pe monede
// (comenzile aduse de campaniile Hontrio).

test('perioadele încep la miezul nopții în România, cu ora de vară socotită', () => {
  const now = Date.parse('2026-11-19T09:30:00Z')
  // 1 noiembrie, ora 00:00 în România (iarnă, UTC+2)
  assert.equal(periodStart('month', now), '2026-10-31T22:00:00.000Z')
  // 21 octombrie, ora 00:00 în România (încă vară, UTC+3): azi și cele 29 de zile dinainte
  assert.equal(periodStart('d30', now), '2026-10-20T21:00:00.000Z')
  assert.ok(periodStart('all', now) < '2001-01-01')
  // Prima oră a lunii în România e încă luna trecută în UTC
  assert.equal(periodStart('month', Date.parse('2026-11-30T22:30:00Z')), '2026-11-30T22:00:00.000Z')
})

test('banii rămân pe monede: lei cu lei, euro cu euro', () => {
  const m = {}
  addMoney(m, 'RON', 10.005)
  addMoney(m, 'ron', 5)
  addMoney(m, 'EUR', 3)
  addMoney(m, 'EUR', 0)
  addMoney(m, null, 1)
  assert.deepEqual(m, { RON: 16.01, EUR: 3 })

  // Un magazin în lei și unul în euro: comenzile se adună, sumele rămân pe monede
  const all = addSales(addSales(addSales(emptySales(), 2, 300.5, 'RON'), 1, 40, 'EUR'), 0, 0, 'RON')
  assert.equal(all.orders, 3)
  assert.deepEqual(all.sales, { RON: 300.5, EUR: 40 })
})
