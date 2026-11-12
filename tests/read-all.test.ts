import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readAll, readAllSoft, PAGE_SIZE } from '@/lib/ads/read-all'

// Citirile din Supabase trec de 1.000 de rânduri (metricile pe produs, termenii,
// vânzările pe ofertă): se citesc pagină cu pagină, până la o pagină incompletă.

function source(total: number) {
  const calls: [number, number][] = []
  const rows = Array.from({ length: total }, (_, i) => ({ i }))
  const page = (from: number, to: number) => {
    calls.push([from, to])
    return Promise.resolve({ data: rows.slice(from, to + 1), error: null })
  }
  return { calls, page }
}

test('toate rândurile, nu doar prima pagină', async () => {
  const s = source(2 * PAGE_SIZE + 17)
  const all = await readAll(s.page)
  assert.equal(all.length, 2 * PAGE_SIZE + 17)
  assert.deepEqual(s.calls, [[0, 999], [1000, 1999], [2000, 2999]])
  // Exact o pagină plină: se mai cere una, goală
  const exact = source(PAGE_SIZE)
  assert.equal((await readAll(exact.page)).length, PAGE_SIZE)
  assert.equal(exact.calls.length, 2)
})

test('o eroare oprește citirea; varianta „soft" o întoarce ca mesaj', async () => {
  const failing = () => Promise.resolve({ data: null, error: { message: 'timeout' } })
  await assert.rejects(readAll(failing), /timeout/)
  assert.deepEqual(await readAllSoft(failing), { data: [], error: 'timeout' })
})
