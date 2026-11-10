// =============================================
// Comenzile magazinului, pe scurt: comanda medie și cât adaugă o comandă peste
// valoarea produselor (transport, taxe). Planul de campanie, grupele și pilotul
// le folosesc ca unitate de măsură: plafonul pe click, oprirea de siguranță,
// pragurile pentru produse și căutări.
//
// Google Ads primește valoarea conversiei de la magazin: la Edinio, TOTALUL
// comenzii (cu TVA, transport și taxe, după reduceri).
// =============================================

/** Comenzile de pe site dintr-o perioadă, fără cele anulate sau rambursate. */
export type OrderTotals = {
  orders: number
  /** Ce plătește clientul, adică valoarea pe care o raportează conversia. */
  total: number
  /** Valoarea produselor: liniile comenzilor, fără extra. */
  items: number
  discount: number
  tax: number
}

export type Economics = {
  /** Totalul comenzii față de valoarea produselor. */
  valueRatio: number
  /** Valoarea medie a comenzii, null fără comenzi. */
  aov: number | null
}

export const NO_ORDERS: OrderTotals = { orders: 0, total: 0, items: 0, discount: 0, tax: 0 }

export function economicsOf(t: OrderTotals): Economics {
  return {
    valueRatio: t.items > 0 && t.total > 0 ? t.total / t.items : 1,
    aov: t.orders > 0 && t.total > 0 ? t.total / t.orders : null,
  }
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
