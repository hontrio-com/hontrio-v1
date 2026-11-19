// =============================================
// Banii din panoul de administrare, pe monede: lei și euro nu se adună.
// Funcții pure (le folosesc și serverul, și paginile).
// =============================================

/** Sume pe monede: { RON: 120, EUR: 3 }. */
export type Money = Record<string, number>

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Adaugă o sumă la moneda ei (o sumă de zero nu lasă o monedă goală în urmă). */
export function addMoney(m: Money, currency: string | null | undefined, amount: number): Money {
  if (!amount) return m
  const c = (currency || 'RON').toUpperCase()
  m[c] = round2((m[c] ?? 0) + amount)
  return m
}
