// =============================================
// Datele demonstrative ale secțiunii „Pilotul, direct în contul tău Google
// Ads" și momentele poveștii pe derulare. Aceeași săptămână ca în „De ce
// Hontrio": un magazin de iluminat cu comanda medie de 180 RON, campania de
// pornire (Shopping) la 40 RON pe zi, limitată de buget, cu ROAS 4,2.
// Regulile sunt cele din docs/campanii/SPECIFICATIE.md §6:
//   - un termen cu cost ≥ comanda medie și nicio conversie în 30 de zile devine
//     cuvânt negativ exact (numele magazinului, niciodată);
//   - un produs cu ≥ 21 de zile de date iese din campanie dacă a cheltuit ≥ prețul
//     lui fără vânzări sau dacă are vânzări, dar ROAS sub 1;
//   - bugetul crește cu cel mult 20%, doar cu aprobarea omului.
// Cifrele pe 30 de zile se potrivesc între ele: termenii și produsele arătate
// sunt o parte din campanie (1.168,40 RON cost, 26 de conversii, ROAS 4,2).
// =============================================

/** Comanda medie a magazinului: pragul pentru căutările fără vânzări. */
export const AOV = 180

// i18n-ignore-start (nume proprii și identificatori din contul demonstrativ)
export const ACCOUNT = { name: 'Casa Luminii', id: '123-456-7893' }
export const CAMPAIGN_NAME = 'Hontrio · Shopping · Casa Luminii'
/** Căutarea pe numele magazinului: nu devine niciodată cuvânt negativ. */
export const BRAND_TERM = 'casa luminii'
// i18n-ignore-end

export type TermId = 'uv' | 'h7' | 'ceiling' | 'chandelier' | 'wall' | 'strip' | 'kids' | 'brand'
export type Term = { id: TermId; clicks: number; impr: number; cost: number; conv: number; value: number; drop?: boolean }

/** Termenii de căutare ai campaniei, după cost (ca în raportul Google Ads). */
export const TERMS: Term[] = [
  { id: 'uv', clicks: 191, impr: 6830, cost: 214.3, conv: 0, value: 0, drop: true },
  { id: 'h7', clicks: 167, impr: 5120, cost: 186.7, conv: 0, value: 0, drop: true },
  { id: 'ceiling', clicks: 118, impr: 3940, cost: 126.4, conv: 4, value: 1402.6 },
  { id: 'chandelier', clicks: 64, impr: 2210, cost: 98.7, conv: 2, value: 1010 },
  { id: 'wall', clicks: 52, impr: 1480, cost: 61.9, conv: 2, value: 368 },
  { id: 'strip', clicks: 77, impr: 2960, cost: 58.3, conv: 3, value: 396.2 },
  // Fără vânzări, dar sub o comandă medie: încă prea puține date, rămâne
  { id: 'kids', clicks: 36, impr: 1120, cost: 41.2, conv: 0, value: 0 },
  { id: 'brand', clicks: 41, impr: 230, cost: 18.6, conv: 4, value: 772.4 },
]

export type ProductId = 'ceiling' | 'crystal' | 'sconce' | 'strip' | 'bulbs' | 'desk' | 'bedside'
export type Product = { id: ProductId; item: string; price: number; clicks: number; cost: number; conv: number; value: number; drop?: boolean }

/** Produsele campaniei, după cost. Aplica a cheltuit peste prețul ei fără vânzări; becurile au ROAS 0,68. */
export const PRODUCTS: Product[] = [
  { id: 'ceiling', item: '1042', price: 320, clicks: 214, cost: 231.6, conv: 4, value: 1401.6 },
  { id: 'crystal', item: '1187', price: 980, clicks: 96, cost: 168.2, conv: 1, value: 1072.1 },
  { id: 'sconce', item: '1213', price: 139, clicks: 133, cost: 152, conv: 0, value: 0, drop: true },
  { id: 'strip', item: '1056', price: 120, clicks: 141, cost: 107.4, conv: 4, value: 528 },
  { id: 'bulbs', item: '1009', price: 60, clicks: 182, cost: 96, conv: 1, value: 65.6, drop: true },
  { id: 'desk', item: '1121', price: 140, clicks: 88, cost: 74.3, conv: 2, value: 336.9 },
  { id: 'bedside', item: '1198', price: 190, clicks: 47, cost: 52.8, conv: 1, value: 207.9 },
]

/** Campania pe 30 de zile; bugetul crește cu 20%, după aprobare. */
export const CAMPAIGN = { from: 40, to: 48, clicks: 1402, cost: 1168.4, conv: 26, value: 4907.3 }
export const roasOf = (value: number, cost: number) => (cost > 0 ? value / cost : 0)

/** Clicurile și costul pe zi, în cele 30 de zile (graficul campaniei); costul atinge bugetul de 40. */
export const DAILY = Array.from({ length: 30 }, (_, i) => {
  const wave = Math.sin(i * 0.9) * 0.5 + Math.sin(i * 0.37 + 1) * 0.5
  return { clicks: Math.round(46 + wave * 7 + (i % 7 === 5 || i % 7 === 6 ? -6 : 0)), cost: Math.min(40, 37.6 + wave * 2.6) }
})

/** Momentele poveștii, pe progresul derulării (0 → 1). */
export const P = {
  // 1. Termenii de căutare
  cursorIn: 0.04, sel1: 0.1, sel2: 0.15, negClick: 0.2, termsDone: 0.215, termsGone: 0.25, snack1: 0.215, notice1: 0.235,
  // 2. Produsele
  products: 0.36, sel3: 0.44, sel4: 0.49, exClick: 0.535, prodsDone: 0.55, prodsGone: 0.585, snack2: 0.55, notice2: 0.57,
  // 3. Bugetul
  campaigns: 0.68, notice3: 0.72, approve: 0.8, budget: 0.815, snack3: 0.815,
} as const
/** Unde începe fiecare pas (bara de deasupra ferestrei). */
export const STEPS = [0, P.products, P.campaigns, 1]

export type View = 'terms' | 'products' | 'campaigns'
export type Frame = {
  view: View
  /** Câte rânduri a bifat pilotul (în vederea de acum). */
  selected: number
  /** Butonul din bara de selecție, apăsat. */
  pressed: boolean
  /** Rândurile au primit „Exclus"; apoi s-au strâns. */
  done: boolean
  gone: boolean
  snack: View | null
  notice: 1 | 2 | 3 | null
  approved: boolean
}

export function frameAt(p: number): Frame {
  if (p < P.products) {
    return {
      view: 'terms',
      selected: p >= P.sel2 ? 2 : p >= P.sel1 ? 1 : 0,
      pressed: p >= P.negClick && p < P.termsDone + 0.02,
      done: p >= P.termsDone, gone: p >= P.termsGone,
      snack: p >= P.snack1 && p < P.snack1 + 0.1 ? 'terms' : null,
      notice: p >= P.notice1 ? 1 : null,
      approved: false,
    }
  }
  if (p < P.campaigns) {
    return {
      view: 'products',
      selected: p >= P.sel4 ? 2 : p >= P.sel3 ? 1 : 0,
      pressed: p >= P.exClick && p < P.prodsDone + 0.02,
      done: p >= P.prodsDone, gone: p >= P.prodsGone,
      snack: p >= P.snack2 && p < P.snack2 + 0.1 ? 'products' : null,
      notice: p >= P.notice2 ? 2 : 1,
      approved: false,
    }
  }
  return {
    view: 'campaigns', selected: 0, pressed: false, done: false, gone: false,
    snack: p >= P.snack3 && p < P.snack3 + 0.12 ? 'campaigns' : null,
    notice: p >= P.notice3 ? 3 : 2,
    approved: p >= P.approve,
  }
}

export const sameFrame = (a: Frame, b: Frame) =>
  a.view === b.view && a.selected === b.selected && a.pressed === b.pressed && a.done === b.done && a.gone === b.gone
  && a.snack === b.snack && a.notice === b.notice && a.approved === b.approved

export const stepAt = (p: number) => (p < P.products ? 0 : p < P.campaigns ? 1 : 2)
