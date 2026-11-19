import { addMoney, type Money } from '@/lib/admin/money'

// =============================================
// Soldul facturilor unui cont, din situațiile lui lunare: ce are de plată, ce
// e trecut de scadență, ce a plătit și ce s-a facturat în total (fără cele
// anulate). Funcție pură, pe monede.
// =============================================

type Row = { status: string; amount: number; currency: string; due_date: string | null }

export type Balance = {
  /** Facturi emise și neplătite. */
  due: Money
  /** Dintre ele, cele trecute de scadență. */
  overdue: Money
  overdue_count: number
  paid: Money
  /** Tot ce s-a facturat (fără cele anulate). */
  invoiced: Money
}

export const emptyBalance = (): Balance => ({ due: {}, overdue: {}, overdue_count: 0, paid: {}, invoiced: {} })

/** Ce datorează și ce a plătit un cont, din situațiile lui. `today` = ziua de azi în România. */
export function balanceOf(rows: Row[], today: string): Balance {
  const b = emptyBalance()
  for (const r of rows) {
    if (r.status === 'invoiced') {
      addMoney(b.due, r.currency, r.amount)
      addMoney(b.invoiced, r.currency, r.amount)
      if (r.due_date && r.due_date < today) { addMoney(b.overdue, r.currency, r.amount); b.overdue_count++ }
    } else if (r.status === 'paid') {
      addMoney(b.paid, r.currency, r.amount)
      addMoney(b.invoiced, r.currency, r.amount)
    }
  }
  return b
}
