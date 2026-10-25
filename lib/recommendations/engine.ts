import { breakEvenRoas, economicsOf, marginOf, round1, THIN_MARGIN, type OrderTotals } from '@/lib/ads/economics'
import type { Offer, Sales } from '@/lib/commerce/ads-data'
import type { StoreSetup } from '@/lib/commerce/setup'

// =============================================
// Recomandările — reguli peste datele magazinului (oferte, vânzări, setări)
// Funcție pură: primește tot ce-i trebuie, nu atinge baza, deci se poate
// verifica separat. Textele sunt chei de traducere cu parametri; sumele de
// bani sunt marcate în `money`, ca interfața să le formateze în moneda
// magazinului și în limba omului.
// =============================================

export type Severity = 'critical' | 'high' | 'medium' | 'low'

type Text = { key: string; params?: Record<string, string | number>; money?: string[] }

export type RecItem = {
  offer_id: string
  title: string
  variant_title: string | null
  image_url: string | null
  note: Text | null
}

export type Recommendation = {
  id: string
  severity: Severity
  title: Text
  /** Una sau mai multe propoziții, afișate una după alta. */
  body: Text | Text[]
  /** Venitul din ultimele 90 de zile legat de ofertele afectate (cât e în joc). */
  impact_revenue: number | null
  items: RecItem[]
  total_items: number
  action: { href: string; external: boolean; label_key: string } | null
}

export type EngineInput = {
  store: { connection_status: string | null }
  /** Ce e pregătit în magazin și unde se repară ce lipsește, pe platforma lui. */
  setup: StoreSetup
  google: { connected: boolean; account_selected: boolean }
  offers: Offer[]
  /** Vânzările de pe site pe ofertă, în ultimele 90 de zile. */
  sales90: Sales
  /** Comenzile de pe site din ultimele 90 de zile. */
  orders90: OrderTotals
}

const MAX_ITEMS = 8
/** Stoc pentru mai puțin de atâtea zile, la ritmul de vânzare din ultimele 90. */
const COVER_DAYS = 14
const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
/** Pașii de pregătire: fără ei nu rulează nimic, deci stau primii în treapta lor. */
const SETUP = new Set(['store_revoked', 'google_not_connected', 'ads_account_missing', 'merchant_missing', 'conversion_missing'])

function item(o: Offer, note: Text | null): RecItem {
  return { offer_id: o.offer_id, title: o.product_name || o.title, variant_title: o.variant_title, image_url: o.image_url, note }
}

export function buildRecommendations(input: EngineInput): Recommendation[] {
  const recs: Recommendation[] = []
  const { offers, sales90 } = input
  const sold = (o: Offer) => sales90.get(o.offer_id) ?? { units: 0, revenue: 0 }
  const byRevenue = (a: Offer, b: Offer) => sold(b).revenue - sold(a).revenue
  const revenueOf = (list: Offer[]) => list.reduce((s, o) => s + sold(o).revenue, 0)
  const itemsRevenue = input.orders90.items
  const { setup } = input
  const econ = economicsOf(input.orders90, setup.pricesIncludeVat, setup.assumedVatRate)
  const openInStore = `recs.action_open_${setup.platform}`
  // La Edinio, pagina Merchant se deschide pe „De reparat", cu motivul fiecărei respingeri,
  // și acolo se repară datele produsului
  const merchantPage = { href: setup.merchant.href, external: true, label_key: openInStore }
  const productsPage = { href: setup.productsHref, external: true, label_key: openInStore }
  const planPage = { href: '/campaigns', external: false, label_key: 'recs.action_view_plan' }

  // ── Ce blochează campaniile ──────────────────────────────────────────────
  if (input.store.connection_status === 'revoked') {
    recs.push({
      id: 'store_revoked', severity: 'critical',
      title: { key: 'recs.store_revoked_title', params: { platform: setup.platformName } }, body: { key: 'recs.store_revoked_body' },
      impact_revenue: null, items: [], total_items: 0,
      action: { href: '/settings?tab=integrations', external: false, label_key: 'recs.action_reconnect' },
    })
  }
  if (!input.google.connected) {
    recs.push({
      id: 'google_not_connected', severity: 'high',
      title: { key: 'recs.google_not_connected_title' }, body: { key: 'recs.google_not_connected_body' },
      impact_revenue: null, items: [], total_items: 0,
      action: { href: '/settings?tab=integrations', external: false, label_key: 'recs.action_connect_google' },
    })
  } else if (!input.google.account_selected) {
    recs.push({
      id: 'ads_account_missing', severity: 'high',
      title: { key: 'recs.ads_account_missing_title' }, body: { key: 'recs.ads_account_missing_body' },
      impact_revenue: null, items: [], total_items: 0,
      action: { href: '/settings?tab=integrations', external: false, label_key: 'recs.action_choose_account' },
    })
  }
  // „De verificat" (un plugin pe care nu-l putem întreba) nu e o problemă: se verifică la lansare
  if (setup.merchant.status === 'missing') {
    recs.push({
      id: 'merchant_missing', severity: 'high',
      title: { key: 'recs.merchant_missing_title' },
      body: [{ key: 'recs.merchant_missing_body' }, { key: `recs.merchant_fix_${setup.platform}` }],
      impact_revenue: null, items: [], total_items: 0,
      action: merchantPage,
    })
  }
  if (setup.conversion.status === 'missing') {
    recs.push({
      id: 'conversion_missing', severity: 'high',
      title: { key: 'recs.conversion_missing_title' },
      body: [{ key: 'recs.conversion_missing_body' }, { key: `recs.conversion_fix_${setup.platform}` }],
      impact_revenue: null, items: [], total_items: 0,
      action: { href: setup.conversion.href, external: true, label_key: openInStore },
    })
  }

  // ── Ofertele care nu pot rula la Google ──────────────────────────────────
  const rejected = offers.filter(o => o.google_status && ['disapproved', 'error', 'expirat'].includes(o.google_status)).sort(byRevenue)
  if (rejected.length) {
    const impact = revenueOf(rejected)
    recs.push({
      id: 'google_issues', severity: impact > 0 ? 'high' : 'medium',
      title: { key: 'recs.google_issues_title', params: { count: rejected.length } },
      body: { key: 'recs.google_issues_body' },
      impact_revenue: impact || null,
      items: rejected.slice(0, MAX_ITEMS).map(o => item(o, { key: `recs.status_${o.google_status}` })),
      total_items: rejected.length,
      action: merchantPage,
    })
  }

  const excluded = offers.filter(o => o.google_status === 'exclus').sort(byRevenue)
  if (excluded.length) {
    recs.push({
      id: 'price_unconfirmed', severity: 'medium',
      title: { key: 'recs.price_unconfirmed_title', params: { count: excluded.length } },
      body: { key: 'recs.price_unconfirmed_body' },
      impact_revenue: revenueOf(excluded) || null,
      items: excluded.slice(0, MAX_ITEMS).map(o => item(o, null)),
      total_items: excluded.length,
      action: productsPage,
    })
  }

  // O ofertă fără stare e „netrimisă" doar acolo unde platforma știe starea (Edinio)
  const notSent = setup.googleStatusKnown && setup.merchant.status === 'ok' ? offers.filter(o => !o.google_status) : []
  if (notSent.length) {
    recs.push({
      id: 'not_sent', severity: 'medium',
      title: { key: 'recs.not_sent_title', params: { count: notSent.length } },
      body: { key: 'recs.not_sent_body' },
      impact_revenue: null,
      items: notSent.sort(byRevenue).slice(0, MAX_ITEMS).map(o => item(o, null)),
      total_items: notSent.length,
      action: merchantPage,
    })
  }

  // ── Stocul ───────────────────────────────────────────────────────────────
  const soldOut = offers.filter(o => !o.available && sold(o).revenue > 0).sort(byRevenue)
  if (soldOut.length) {
    const impact = revenueOf(soldOut)
    recs.push({
      id: 'out_of_stock_sellers', severity: itemsRevenue > 0 && impact / itemsRevenue >= 0.05 ? 'high' : 'medium',
      title: { key: 'recs.out_of_stock_title', params: { count: soldOut.length } },
      body: { key: 'recs.out_of_stock_body' },
      impact_revenue: impact,
      items: soldOut.slice(0, MAX_ITEMS).map(o => item(o, {
        key: 'recs.note_sold', params: { units: sold(o).units, revenue: sold(o).revenue }, money: ['revenue'],
      })),
      total_items: soldOut.length,
      action: productsPage,
    })
  }

  const lowStock = offers
    .filter(o => o.available && o.stock !== null && o.stock > 0 && sold(o).units > 0)
    .map(o => ({ o, cover: o.stock! / (sold(o).units / 90) }))
    .filter(x => x.cover < COVER_DAYS)
    .sort((a, b) => a.cover - b.cover)
  if (lowStock.length) {
    recs.push({
      id: 'low_stock_sellers', severity: 'medium',
      title: { key: 'recs.low_stock_title', params: { count: lowStock.length } },
      body: { key: 'recs.low_stock_body', params: { days: COVER_DAYS } },
      impact_revenue: revenueOf(lowStock.map(x => x.o)),
      items: lowStock.slice(0, MAX_ITEMS).map(x => {
        const days = Math.max(1, Math.round(x.cover))
        return item(x.o, { key: days === 1 ? 'recs.note_cover_one' : 'recs.note_cover', params: { days, stock: x.o.stock! } })
      }),
      total_items: lowStock.length,
      action: productsPage,
    })
  }

  // ── Marjele ──────────────────────────────────────────────────────────────
  const sellersNoCost = offers.filter(o => o.cost_price === null && sold(o).revenue > 0).sort(byRevenue)
  if (sellersNoCost.length) {
    const impact = revenueOf(sellersNoCost)
    recs.push({
      id: 'missing_costs', severity: itemsRevenue > 0 && impact / itemsRevenue >= 0.5 ? 'high' : 'medium',
      title: { key: 'recs.missing_costs_title', params: { count: sellersNoCost.length } },
      body: { key: 'recs.missing_costs_body' },
      impact_revenue: impact,
      items: sellersNoCost.slice(0, MAX_ITEMS).map(o => item(o, {
        key: 'recs.note_sold', params: { units: sold(o).units, revenue: sold(o).revenue }, money: ['revenue'],
      })),
      total_items: sellersNoCost.length,
      action: { href: '/products?view=no_cost', external: false, label_key: 'recs.action_add_costs' },
    })
  } else {
    const noCost = offers.filter(o => o.cost_price === null)
    if (noCost.length && offers.length && noCost.length / offers.length >= 0.2) {
      recs.push({
        id: 'missing_costs', severity: 'medium',
        title: { key: 'recs.missing_costs_generic_title', params: { count: noCost.length } },
        body: { key: 'recs.missing_costs_body' },
        impact_revenue: null, items: [], total_items: noCost.length,
        action: { href: '/products?view=no_cost', external: false, label_key: 'recs.action_add_costs' },
      })
    }
  }

  const belowCost = offers.filter(o => o.cost_price !== null && o.cost_price >= o.price).sort(byRevenue)
  if (belowCost.length) {
    recs.push({
      id: 'negative_margin', severity: 'high',
      title: { key: 'recs.negative_margin_title', params: { count: belowCost.length } },
      body: { key: 'recs.negative_margin_body' },
      impact_revenue: revenueOf(belowCost) || null,
      items: belowCost.slice(0, MAX_ITEMS).map(o => item(o, {
        key: 'recs.note_price_cost', params: { price: o.price, cost: o.cost_price! }, money: ['price', 'cost'],
      })),
      total_items: belowCost.length,
      action: { href: '/products', external: false, label_key: 'recs.action_check_costs' },
    })
  }

  const thin = offers
    .filter(o => o.cost_price !== null && o.cost_price < o.price && (marginOf(o.price, o.cost_price) ?? 0) < THIN_MARGIN && sold(o).revenue > 0)
    .sort(byRevenue)
  if (thin.length) {
    recs.push({
      id: 'thin_margin_sellers', severity: 'medium',
      title: { key: 'recs.thin_margin_title', params: { count: thin.length } },
      body: { key: 'recs.thin_margin_body', params: { pct: Math.round(THIN_MARGIN * 100) } },
      impact_revenue: revenueOf(thin),
      items: thin.slice(0, MAX_ITEMS).map(o => {
        const margin = marginOf(o.price, o.cost_price!)!
        const roas = breakEvenRoas(margin, econ)
        const pct = Math.round(margin * 100)
        return item(o, roas === null
          ? { key: 'recs.note_margin_no_roas', params: { pct } }
          : { key: 'recs.note_margin_roas', params: { pct, roas: round1(roas) } })
      }),
      total_items: thin.length,
      action: planPage,
    })
  }

  // Pragul de profit pentru tot magazinul, din produsele vândute care au cost
  const withCost = offers.filter(o => o.cost_price !== null && sold(o).revenue > 0)
  const costRevenue = revenueOf(withCost)
  if (withCost.length && itemsRevenue > 0 && costRevenue / revenueOf(offers) >= 0.5) {
    const profit = withCost.reduce((s, o) => s + sold(o).revenue - sold(o).units * o.cost_price!, 0)
    const margin = profit / costRevenue
    const roas = breakEvenRoas(margin, econ)
    if (roas !== null) {
      recs.push({
        id: 'break_even', severity: 'low',
        title: { key: 'recs.break_even_title', params: { roas: round1(roas) } },
        body: [
          { key: 'recs.break_even_body', params: { margin: Math.round(margin * 100), roas: round1(roas) } },
          ...(econ.vatFactor > 1 ? [{ key: econ.vatAssumed ? 'recs.break_even_vat_assumed' : 'recs.break_even_vat', params: { vat: Math.round((econ.vatFactor - 1) * 100) } }] : []),
          ...(econ.discountRate >= 0.01 ? [{ key: 'recs.break_even_discount', params: { discount: Math.round(econ.discountRate * 100) } }] : []),
        ],
        impact_revenue: null, items: [], total_items: 0, action: planPage,
      })
    } else if (margin > 0) {
      // Reducerile mănâncă toată marja: vânzările pierd bani înainte de orice reclamă
      recs.push({
        id: 'discounts_over_margin', severity: 'high',
        title: { key: 'recs.discounts_over_margin_title' },
        body: { key: 'recs.discounts_over_margin_body', params: { margin: Math.round(margin * 100), discount: Math.round(econ.discountRate * 100) } },
        impact_revenue: costRevenue, items: [], total_items: 0,
        action: { href: '/products', external: false, label_key: 'recs.action_check_costs' },
      })
    }
  }

  // ── Identificatorii ──────────────────────────────────────────────────────
  // Ofertele ținute departe de Google (prețul se află abia la comandă) n-au nevoie de cod
  const noId = offers.filter(o => o.brand && !o.gtin && !o.mpn && o.available && o.google_status !== 'exclus').sort(byRevenue)
  if (noId.length) {
    recs.push({
      id: 'missing_gtin', severity: 'low',
      title: { key: 'recs.missing_gtin_title', params: { count: noId.length } },
      body: { key: 'recs.missing_gtin_body', params: { platform: setup.platformName } },
      impact_revenue: null,
      items: noId.slice(0, MAX_ITEMS).map(o => item(o, null)),
      total_items: noId.length,
      action: productsPage,
    })
  }

  return recs.sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    || Number(SETUP.has(b.id)) - Number(SETUP.has(a.id))
    || (b.impact_revenue ?? 0) - (a.impact_revenue ?? 0))
}
