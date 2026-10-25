// =============================================
// Rentabilitatea reclamelor — aceleași socoteli în Recomandări și în planul
// de campanie, ca cifrele să nu se contrazică între pagini.
//
// Google Ads primește valoarea conversiei de la magazin: la Edinio, TOTALUL
// comenzii (cu TVA, transport și taxe, după reduceri). Comerciantului îi
// rămâne marja produselor fără TVA, minus reducerile date. Transportul și
// taxele încasate se socotesc trecute mai departe (acoperă curierul).
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
  /** 1 + cota de TVA când prețurile includ TVA (dedusă din comenzi), altfel 1. */
  vatFactor: number
  /** Cota nu vine din comenzi (magazinul nu calculează taxe): e cea standard a țării. */
  vatAssumed: boolean
  /** Totalul comenzii față de valoarea produselor. */
  valueRatio: number
  /** Partea din valoarea produselor dată înapoi ca reducere. */
  discountRate: number
  /** Valoarea medie a comenzii, null fără comenzi. */
  aov: number | null
}

/** Sub marja asta, o reclamă trebuie să aducă un ROAS greu de atins ca să nu piardă bani. */
export const THIN_MARGIN = 0.2

export const NO_ORDERS: OrderTotals = { orders: 0, total: 0, items: 0, discount: 0, tax: 0 }

/**
 * `assumedVatRate`: cota standard a țării, folosită când comenzile n-au TVA
 * (magazinul nu calculează taxe) dar prețurile pot să-l includă.
 */
export function economicsOf(t: OrderTotals, pricesIncludeVat: boolean | null, assumedVatRate: number | null = null): Economics {
  const net = t.total - t.tax
  const known = t.items > 0 && t.total > 0
  const fromOrders = pricesIncludeVat === true && net > 0 && t.tax > 0 ? 1 + t.tax / net : null
  // Cu prețuri fără TVA, TVA-ul adăugat la plată e deja în raportul valorii
  const assumed = fromOrders === null && pricesIncludeVat !== false && !!assumedVatRate
  return {
    vatFactor: fromOrders ?? (assumed ? 1 + assumedVatRate! : 1),
    vatAssumed: assumed,
    valueRatio: known ? t.total / t.items : 1,
    discountRate: known ? Math.max(0, t.discount) / t.items : 0,
    aov: t.orders > 0 && t.total > 0 ? t.total / t.orders : null,
  }
}

/** Marja pe preț, pe aceeași bază ca prețul (costul se scrie cu sau fără TVA, ca prețul). */
export function marginOf(price: number, cost: number): number | null {
  return price > 0 ? (price - cost) / price : null
}

/**
 * ROAS-ul (valoarea raportată de Google Ads ÷ costul reclamei) de la care o
 * vânzare își plătește reclama. Null când marja nu acoperă nici reducerile.
 *
 *   profitul înainte de reclamă = produse × (marjă − reduceri) ÷ factorul TVA
 *   valoarea raportată          = produse × raportul valorii
 */
export function breakEvenRoas(margin: number, e: Economics): number | null {
  const net = margin - e.discountRate
  return net > 0 ? (e.vatFactor * e.valueRatio) / net : null
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
