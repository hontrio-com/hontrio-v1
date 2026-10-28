import { breakEvenRoas, economicsOf, marginOf, round1, THIN_MARGIN, type OrderTotals } from '@/lib/ads/economics'
import type { Offer, Sales } from '@/lib/commerce/ads-data'
import type { StoreSetup } from '@/lib/commerce/setup'
import type { AuditResult } from '@/lib/google/audit'
import type { BestSellerRow, PriceCompetitivenessRow, PriceInsightRow } from '@/lib/merchant/sync'

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
  /** Ultimul audit al contului Google Ads (null = încă nefăcut). */
  audit?: AuditResult | null
  merchant?: {
    /** ID-ul contului Merchant Center, dacă îl știm. */
    id: string | null
    /** Stările ofertelor vin din Merchant Center (WooCommerce, Shopify), nu de la platformă. */
    from_merchant: boolean
    send_costs: boolean
    /** Magazinul e în SEE/Elveția/Regatul Unit, unde reclamele Shopping trec printr-un CSS. */
    css_region: boolean
    /** Edinio trimite coșul de produse în conversie; null = nu știm (alte platforme). */
    cart_data: boolean | null
  }
  insights?: {
    price_competitiveness: PriceCompetitivenessRow[]
    price_insights: PriceInsightRow[]
    best_sellers: BestSellerRow[]
  }
}

const MAX_ITEMS = 8
/** Textele problemelor conversiei de cumpărare (din audit), pe verificare. */
const PURCHASE_TEXT = {
  purchase_missing: ['recs.purchase_missing_title', 'recs.purchase_missing_body'],
  purchase_not_primary: ['recs.purchase_not_primary_title', 'recs.purchase_not_primary_body'],
  purchase_no_value: ['recs.purchase_no_value_title', 'recs.purchase_no_value_body'],
} as const
/** Prețul e „peste piață" de la atât în sus față de prețul de referință. */
const ABOVE_MARKET = 0.05
/** Sugestia de preț contează de la atâtea conversii estimate în plus. */
const PRICE_SUGGESTION_GAIN = 0.1

/** Țările unde reclamele Shopping trec printr-un CSS (SEE, Elveția, Regatul Unit). */
export const CSS_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'CH', 'GB',
])
/** Stoc pentru mai puțin de atâtea zile, la ritmul de vânzare din ultimele 90. */
const COVER_DAYS = 14
const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
/** Pașii de pregătire: fără ei nu rulează nimic, deci stau primii în treapta lor. */
const SETUP = new Set(['store_revoked', 'google_not_connected', 'ads_account_missing', 'merchant_missing', 'conversion_missing', 'eu_undeclared', 'purchase_conversion'])

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
  const planPage = { href: '/campaigns?tab=plan', external: false, label_key: 'recs.action_view_plan' }

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

  // ── Contul Google Ads (din audit) ────────────────────────────────────────
  const audit = input.audit ?? null
  if (audit) {
    const has = (id: string) => audit.checks.find(c => c.id === id)
    if (has('eu_undeclared')) {
      recs.push({
        id: 'eu_undeclared', severity: 'high',
        title: { key: 'recs.eu_undeclared_title', params: { count: audit.eu_undeclared.length } },
        body: { key: 'recs.eu_undeclared_body' },
        impact_revenue: null, items: [], total_items: 0, action: planPage,
      })
    }
    const purchase = has('purchase_missing') ?? has('purchase_not_primary') ?? has('purchase_no_value')
    if (purchase && setup.conversion.status !== 'missing') {
      recs.push({
        id: 'purchase_conversion', severity: purchase.id === 'purchase_no_value' ? 'medium' : 'high',
        title: { key: PURCHASE_TEXT[purchase.id as keyof typeof PURCHASE_TEXT][0] }, body: { key: PURCHASE_TEXT[purchase.id as keyof typeof PURCHASE_TEXT][1] },
        impact_revenue: null, items: [], total_items: 0, action: planPage,
      })
    }
    if (has('overlap')) {
      recs.push({
        id: 'overlap', severity: 'medium',
        title: { key: 'recs.overlap_title', params: { count: audit.overlap.length } },
        body: { key: 'recs.overlap_body' },
        impact_revenue: null, items: [], total_items: 0, action: planPage,
      })
    }
    if (has('auto_tagging_off')) {
      recs.push({
        id: 'auto_tagging_off', severity: 'medium',
        title: { key: 'recs.auto_tagging_off_title' }, body: { key: 'recs.auto_tagging_off_body' },
        impact_revenue: null, items: [], total_items: 0,
        action: { href: 'https://ads.google.com/', external: true, label_key: 'recs.action_open_google_ads' },
      })
    }
  }

  // ── Ofertele care nu pot rula la Google ──────────────────────────────────
  const fromMerchant = !!input.merchant?.from_merchant
  // La WooCommerce și Shopify starea vine din Merchant Center: problemele le spune Google, nu Edinio
  const merchantCenter = { href: 'https://merchants.google.com/', external: true, label_key: 'recs.action_open_merchant' }
  const rejected = offers.filter(o => o.google_status && ['disapproved', 'error', 'expirat'].includes(o.google_status)).sort(byRevenue)
  if (rejected.length) {
    const impact = revenueOf(rejected)
    recs.push({
      id: 'google_issues', severity: impact > 0 ? 'high' : 'medium',
      title: { key: 'recs.google_issues_title', params: { count: rejected.length } },
      body: { key: fromMerchant ? 'recs.google_issues_body_merchant' : 'recs.google_issues_body' },
      impact_revenue: impact || null,
      items: rejected.slice(0, MAX_ITEMS).map(o => item(o, fromMerchant && o.merchant_issues?.[0]
        ? { key: 'recs.note_issue', params: { issue: o.merchant_issues[0].description || o.merchant_issues[0].code } }
        : { key: `recs.status_${o.google_status}` })),
      total_items: rejected.length,
      action: fromMerchant ? merchantCenter : merchantPage,
    })
  }

  // Ofertele care rulează, dar cu probleme care le scad afișarea (Google le „retrogradează")
  const demoted = fromMerchant
    ? offers.filter(o => o.google_status === 'active' && o.merchant_issues?.some(i => i.severity === 'DEMOTED')).sort(byRevenue)
    : []
  if (demoted.length) {
    recs.push({
      id: 'merchant_demoted', severity: 'medium',
      title: { key: 'recs.merchant_demoted_title', params: { count: demoted.length } },
      body: { key: 'recs.merchant_demoted_body' },
      impact_revenue: revenueOf(demoted) || null,
      items: demoted.slice(0, MAX_ITEMS).map(o => {
        const issue = o.merchant_issues!.find(i => i.severity === 'DEMOTED')!
        return item(o, { key: 'recs.note_issue', params: { issue: issue.description || issue.code } })
      }),
      total_items: demoted.length,
      action: merchantCenter,
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

  // O ofertă fără stare e „netrimisă" doar acolo unde starea se știe (Edinio, sau Merchant Center citit de noi)
  const notSent = (setup.googleStatusKnown && setup.merchant.status === 'ok') || fromMerchant ? offers.filter(o => !o.google_status) : []
  if (notSent.length) {
    recs.push({
      id: 'not_sent', severity: 'medium',
      title: { key: 'recs.not_sent_title', params: { count: notSent.length } },
      body: { key: fromMerchant ? `recs.not_sent_body_${setup.platform}` : 'recs.not_sent_body' },
      impact_revenue: null,
      items: notSent.sort(byRevenue).slice(0, MAX_ITEMS).map(o => item(o, null)),
      total_items: notSent.length,
      action: fromMerchant ? merchantCenter : merchantPage,
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

  // ── Piața (rapoartele din Merchant Center) ───────────────────────────────
  const byItem = new Map(offers.filter(o => o.merchant_offer_id || setup.platform === 'edinio')
    .map(o => [(o.merchant_offer_id ?? o.offer_id).toLowerCase(), o]))
  const insights = input.insights
  if (insights?.price_competitiveness.length) {
    const above = insights.price_competitiveness
      .map(r => ({ r, o: byItem.get(r.offer_id.toLowerCase()) }))
      .filter((x): x is { r: PriceCompetitivenessRow; o: Offer } => !!x.o && x.r.price !== null && x.r.benchmark !== null && x.r.benchmark > 0
        && x.r.price / x.r.benchmark - 1 >= ABOVE_MARKET && x.o.available)
      .sort((a, b) => byRevenue(a.o, b.o) || (b.r.price! / b.r.benchmark! - a.r.price! / a.r.benchmark!))
    if (above.length) {
      recs.push({
        id: 'price_above_market', severity: above.some(x => sold(x.o).revenue > 0) ? 'medium' : 'low',
        title: { key: 'recs.price_above_market_title', params: { count: above.length } },
        body: { key: 'recs.price_above_market_body', params: { pct: Math.round(ABOVE_MARKET * 100) } },
        impact_revenue: revenueOf(above.map(x => x.o)) || null,
        items: above.slice(0, MAX_ITEMS).map(x => item(x.o, {
          key: 'recs.note_price_benchmark',
          params: { price: x.r.price!, benchmark: x.r.benchmark!, pct: Math.round((x.r.price! / x.r.benchmark! - 1) * 100) },
          money: ['price', 'benchmark'],
        })),
        total_items: above.length,
        action: productsPage,
      })
    }
  }
  if (insights?.price_insights.length) {
    const worth = insights.price_insights
      .map(r => ({ r, o: byItem.get(r.offer_id.toLowerCase()) }))
      .filter((x): x is { r: PriceInsightRow; o: Offer } => !!x.o && x.o.available && x.r.suggested !== null
        && (x.r.conversions_change ?? 0) >= PRICE_SUGGESTION_GAIN && x.r.effectiveness !== 'LOW')
      .sort((a, b) => (b.r.conversions_change ?? 0) - (a.r.conversions_change ?? 0))
    if (worth.length) {
      recs.push({
        id: 'price_suggestions', severity: 'low',
        title: { key: 'recs.price_suggestions_title', params: { count: worth.length } },
        body: { key: 'recs.price_suggestions_body' },
        impact_revenue: null,
        items: worth.slice(0, MAX_ITEMS).map(x => item(x.o, {
          key: 'recs.note_price_suggestion',
          params: { suggested: x.r.suggested!, gain: Math.round((x.r.conversions_change ?? 0) * 100) },
          money: ['suggested'],
        })),
        total_items: worth.length,
        action: productsPage,
      })
    }
  }
  if (insights?.best_sellers.length) {
    const top = insights.best_sellers.slice(0, MAX_ITEMS)
    recs.push({
      id: 'best_sellers_missing', severity: 'low',
      title: { key: 'recs.best_sellers_missing_title', params: { count: insights.best_sellers.length } },
      body: { key: 'recs.best_sellers_missing_body' },
      impact_revenue: null,
      items: top.map((r, i) => ({
        offer_id: `best:${i}`, title: r.title, variant_title: r.brand, image_url: null,
        note: r.rank !== null ? { key: 'recs.note_best_seller_rank', params: { rank: r.rank } } : null,
      })),
      total_items: insights.best_sellers.length,
      action: null,
    })
  }

  // ── Profitul în Google și costul pe click ────────────────────────────────
  const merchant = input.merchant
  if (merchant?.id && !merchant.send_costs && offers.some(o => o.cost_price !== null)) {
    recs.push({
      id: 'costs_to_google', severity: 'low',
      title: { key: 'recs.costs_to_google_title' }, body: { key: 'recs.costs_to_google_body' },
      impact_revenue: null, items: [], total_items: 0,
      action: { href: '/settings?tab=integrations', external: false, label_key: 'recs.action_open_settings' },
    })
  }
  if (merchant?.cart_data === false) {
    recs.push({
      id: 'cart_data_missing', severity: 'low',
      title: { key: 'recs.cart_data_missing_title' }, body: { key: 'recs.cart_data_missing_body' },
      impact_revenue: null, items: [], total_items: 0,
      action: { href: setup.conversion.href, external: true, label_key: openInStore },
    })
  }
  if (merchant?.css_region && setup.merchant.status !== 'missing') {
    recs.push({
      id: 'css_partner', severity: 'low',
      title: { key: 'recs.css_partner_title' }, body: { key: 'recs.css_partner_body' },
      impact_revenue: null, items: [], total_items: 0,
      action: { href: 'https://support.google.com/merchants/answer/12652686', external: true, label_key: 'recs.action_read_more' },
    })
  }

  return recs.sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    || Number(SETUP.has(b.id)) - Number(SETUP.has(a.id))
    || (b.impact_revenue ?? 0) - (a.impact_revenue ?? 0))
}
