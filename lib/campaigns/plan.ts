import { economicsOf, type OrderTotals } from '@/lib/ads/economics'
import type { AdsMode, Offer, ProductTotals, Sales } from '@/lib/commerce/ads-data'
import type { SetupStatus, StoreSetup } from '@/lib/commerce/setup'
import { purchaseConversions30, type AuditResult } from '@/lib/google/audit'
import { EXCLUDE_LABEL, MAX_LISTING_ITEMS } from '@/lib/google/operations'

// =============================================
// Planul de campanie — ce va crea Hontrio în contul Google Ads al omului,
// socotit din datele magazinului și din auditul contului: treapta (pornire
// sau creștere), ce produse intră, bugetul, plafonul pe click și oprirea de
// siguranță. Funcție pură, ca motorul de recomandări. Vezi
// docs/campanii/SPECIFICATIE.md §2–§5.
//
// Hontrio nu cere și nu folosește costurile produselor. Fără marjă, singura
// pierdere sigură e o reclamă care a costat mai mult decât au adus vânzările
// ei (ROAS sub 1): de la ea pornesc plafonul pe click și oprirea de siguranță,
// măsurate în comenzi medii.
//
// O singură campanie pe tot catalogul eligibil: cu puține conversii, o
// campanie învață mai repede decât mai multe mici. Grupele făcute de om
// (lib/campaigns/groups.ts) au campaniile lor: produsele unei grupe lansate
// ies din cea principală.
// =============================================

export type Mode = 'approve' | 'auto'
export type Stage = 'starter' | 'growth'

export const MODES: Mode[] = ['approve', 'auto']

/** Minimul Google pentru licitarea pe valoare la Shopping: 15 conversii în ultimele 30 de zile. */
export const GROWTH_MIN_CONVERSIONS = 15
/**
 * Plafonul pe click la pornire, ca parte din comanda medie: la o vânzare din
 * 100 de clicuri, vânzarea își acoperă reclama.
 */
export const CPC_CEILING_SHARE = 0.01
/** Oprirea de siguranță, în comenzi medii cheltuite: fără nicio vânzare / cu vânzări sub costul reclamei. */
export const LOSS_NO_CONVERSIONS = 1
export const LOSS_LOW_ROAS = 3
/** Sub plafonul ăsta (în moneda contului) campania de pornire va avea foarte puțin trafic. */
export const LOW_CPC = 0.05
export const DAYS_PER_MONTH = 30.4
/** Bugetul propus când contul n-are încă Shopping: o parte din comanda medie, pe zi. */
export const START_BUDGET_SHARE = 0.2

export type Reason =
  // Nu pot rula: se repară în magazin
  | 'out_of_stock' | 'google_rejected' | 'price_unconfirmed' | 'not_in_merchant'
  // Scoasă de om
  | 'manual'
  // Scoasă de pilot după cifrele din Google Ads (omul o poate include la loc)
  | 'ads_no_sales' | 'ads_unprofitable'
  // Poate rula, dar în campania unei grupe lansate, nu în cea principală
  | 'in_group'

/** Motivele pentru care o ofertă care ar putea rula e scoasă din campanie (în arborele de produse). */
export const CAMPAIGN_EXCLUSIONS: Reason[] = ['manual', 'ads_no_sales', 'ads_unprofitable']

/** Eticheta Hontrio pe ofertele scoase din campanie (ID-ul ofertei → eticheta), pentru sursa suplimentară. */
export function exclusionLabelMap(plan: Pick<Plan, 'offers'>): Map<string, string> {
  return new Map(plan.offers.filter(o => o.reason && CAMPAIGN_EXCLUSIONS.includes(o.reason)).map(o => [o.offer_id, EXCLUDE_LABEL]))
}

export type PlanOffer = {
  offer_id: string
  /** ID-ul din Merchant Center, pe care se exclude produsul în campanie; null = nepotrivit încă. */
  item_id: string | null
  title: string
  variant_title: string | null
  image_url: string | null
  category: string | null
  brand: string | null
  price: number
  /** Prețul are o reducere față de cel vechi. */
  on_sale: boolean
  /** Vânzările de pe site din ultimele 90 de zile. */
  units: number
  revenue: number
  /** Comenzile cu produsul, în aceleași 90 de zile. */
  orders: number
  /** Comenzile aduse de Google Ads (gclid sau UTM) cu produsul, în ultimele 30 de zile. */
  google30: number
  /** Ce a raportat Google pentru produs în ultimele 30 de zile, din toate campaniile Shopping și PMax. */
  ads30: { cost: number; conversions: number; value: number } | null
  mode: AdsMode
  /** De ce nu intră în campania principală; null = intră. */
  reason: Reason | null
  /** Grupa omului din care face parte (lansată sau ciornă). */
  group_id: string | null
}

export type BlockerId =
  | 'store' | 'google_ads' | 'ads_account' | 'currency' | 'merchant' | 'conversion' | 'no_offers'
  // Din auditul contului Google Ads
  | 'audit' | 'account_manager' | 'merchant_not_linked' | 'merchant_other' | 'merchant_choose'
  | 'purchase_missing' | 'purchase_not_primary' | 'purchase_no_value' | 'too_many_exclusions'
  // Merchant Center are produse care nu sunt ale magazinului, iar excluderile au trecut pe etichetă
  | 'merchant_foreign'

export type PlanInput = {
  store: { currency: string; connection_status: string | null; name: string | null; url: string | null }
  /** Ce e pregătit în magazin și unde se repară ce lipsește, pe platforma lui. */
  setup: StoreSetup
  google: { connected: boolean; account: { customer_id: string; name: string | null; currency: string | null } | null }
  /** Ultimul audit al contului Google Ads; null = încă nefăcut (sau eșuat). */
  audit: AuditResult | null
  merchant: {
    id: string | null
    feed_label: string | null
    /**
     * Starea ofertelor la Google e știută (de la Edinio cu Merchant legat, sau din Merchant
     * Center la celelalte): o ofertă fără stare e atunci „netrimisă".
     */
    statuses_known: boolean
    /** custom_label_N liber pentru Hontrio (cataloagele prea mari pentru lista de ID-uri). */
    label_index: number | null
    /**
     * Produsele din Merchant Center care nu sunt ale magazinului, dar ar intra în campanie
     * (aceeași etichetă de feed, pot rula în țară): ID-ul din Merchant Center.
     */
    foreign_ids?: string[]
  }
  offers: Offer[]
  sales90: Sales
  orders90: OrderTotals
  googleAds90: { orders: number; total: number }
  googleAds30: { orders: number; total: number }
  /** Vânzările aduse de Google Ads în 30 de zile, pe ofertă. */
  googleSales30?: Sales
  /** Cifrele Google pe produs în 30 de zile (ID-ul din Merchant Center, cu litere mici). */
  products30?: ProductTotals
  /**
   * Grupele omului: `assigned` = grupa fiecărei oferte (lansată sau ciornă), `live` = grupele
   * lansate, ale căror produse ies din campania principală.
   */
  groups?: { assigned: Map<string, string>; live: Set<string> }
  settings: { daily_budget: number | null; mode: Mode; max_daily_budget: number | null }
}

export type Plan = {
  platform: { id: StoreSetup['platform']; name: string }
  /**
   * Ce mai trebuie făcut până la lansare, în ordinea în care se face.
   * `variant` = varianta textului: platforma, unde pasul se face altfel (Merchant
   * Center, conversia); „groups" când toate produsele sunt în grupe.
   */
  blockers: { id: BlockerId; href: string; external: boolean; variant?: string; params?: Record<string, string | number> }[]
  /** Pornire = Shopping standard cu „Maximizează clicurile"; creștere = Performance Max doar pe feed. */
  stage: { id: Stage; conversions30: number; basis: 'google_ads' | 'store' }
  campaign: {
    country: string | null
    language: string | null
    currency: string
    account: { customer_id: string; name: string | null } | null
    merchant: { status: SetupStatus; via: string | null }
    conversion: { status: SetupStatus; via: string | null }
  }
  structure: {
    type: 'shopping' | 'performance_max'
    /** Plafonul pe click al campaniei de pornire: 1% din comanda medie. */
    cpc_ceiling: number | null
    cpc_ceiling_low: boolean
    /** Cheltuiala la care pilotul oprește campania: fără nicio vânzare / cu vânzări sub costul reclamei. */
    loss_limit: { no_conversions: number; low_roas: number } | null
    merchant_id: string | null
    feed_label: string | null
    /** Numele magazinului ca cuvânt negativ, când contul are o campanie Search (căutările pe brand sunt ale ei). */
    brand_negatives: string[]
  }
  economics: {
    /** Comanda medie: din comenzile de pe site, altfel prețul mediu al produselor care pot rula. */
    aov: number | null
    /** Totalul comenzii față de valoarea produselor (TVA, transport): din valoarea produselor, valoarea raportată. */
    value_ratio: number
  }
  /**
   * `suggested` = cât cheltuie contul acum pe zi pe Shopping/PMax (`basis` „history”),
   * altfel o cincime din comanda medie (`basis` „aov”).
   */
  budget: { suggested: number | null; basis: 'history' | 'aov' | null; chosen: number | null; daily: number | null }
  settings: { mode: Mode; max_daily_budget: number | null }
  history: {
    google_ads_orders: number
    google_ads_total: number
    /** ROAS-ul pe care contul îl face acum (Shopping/PMax, altfel tot contul), din audit; null = prea puține date. */
    roas30: number | null
    /** Google a raportat deja cifre pe produs (pilotul a citit contul): conversiile grupelor vin de acolo. */
    product_data: boolean
  }
  /**
   * Ce se exclude în campanie, după ID-ul din Merchant Center. `foreign` = câte dintre ele sunt
   * produse din Merchant Center care nu sunt ale magazinului.
   */
  exclusions: { item_ids: string[]; unmatched: number; foreign: number; mode: 'items' | 'label' | 'too_many' }
  offers: PlanOffer[]
  /** `in_groups` = produsele care pot rula, dar sunt în campaniile grupelor lansate. */
  counts: { included: number; excluded: number; in_groups: number }
}

const REJECTED = ['disapproved', 'error', 'expirat']

/** Un buget ușor de citit: din 10 în 10 peste 100, din 5 în 5 peste 20. */
export function niceBudget(n: number): number {
  if (n >= 100) return Math.round(n / 10) * 10
  if (n >= 20) return Math.round(n / 5) * 5
  return Math.max(1, Math.round(n))
}

/** Bugetul propus pentru o comandă medie dată, când contul n-are încă Shopping. */
export function startBudget(aov: number | null): number | null {
  return aov !== null && aov > 0 ? niceBudget(aov * START_BUDGET_SHARE) : null
}

/** Plafonul pe click pentru o comandă medie dată (în moneda contului, două zecimale). */
export function cpcCeilingOf(aov: number | null): number | null {
  return aov !== null && aov > 0 ? Math.max(0.01, Math.floor(aov * CPC_CEILING_SHARE * 100) / 100) : null
}

/** Cheltuiala la care se oprește o campanie, pentru o comandă medie dată. */
export function lossLimitOf(aov: number | null): Plan['structure']['loss_limit'] {
  return aov !== null && aov > 0
    ? { no_conversions: Math.ceil(LOSS_NO_CONVERSIONS * aov), low_roas: Math.ceil(LOSS_LOW_ROAS * aov) }
    : null
}

function reasonOf(o: Offer, statusKnown: boolean): Reason | null {
  if (!o.available) return 'out_of_stock'
  if (o.google_status && REJECTED.includes(o.google_status)) return 'google_rejected'
  if (o.google_status === 'exclus') return 'price_unconfirmed'
  // O ofertă fără stare e „netrimisă" doar dacă știm starea și Merchant Center e legat;
  // altfel lipsa lui e deja un pas de făcut, nu vina ofertei
  if (statusKnown && !o.google_status) return 'not_in_merchant'
  if (o.ads_mode === 'exclude') return 'manual'
  if (o.ads_mode === 'include') return null
  if (o.ads_auto_reason) return o.ads_auto_reason === 'no_sales' ? 'ads_no_sales' : 'ads_unprofitable'
  return null
}

/** „Lampi LED SRL" + „https://www.lampi-led.ro" → ['lampi led'] (fără forma juridică, fără duplicate). */
/**
 * Domeniile platformelor de magazin: un magazin găzduit la ele (edinio.com/magazin,
 * magazin.myshopify.com) nu are brandul în primul cuvânt al domeniului.
 */
const PLATFORM_HOSTS = ['edinio.com', 'edinio.ro', 'myshopify.com', 'shopify.com', 'gomag.ro', 'gomag.com', 'merchantpro.com', 'merchantpro.ro']

export function brandTerms(name: string | null, url: string | null): string[] {
  const clean = (s: string) => s.toLowerCase()
    .replace(/\b(s\.?r\.?l\.?|s\.?a\.?|pfa|ii|ltd|llc|gmbh|inc)\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ')
  const terms = new Set<string>()
  if (name) terms.add(clean(name))
  if (url) {
    try {
      const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
      if (!PLATFORM_HOSTS.some(p => host === p || host.endsWith(`.${p}`))) terms.add(clean(host.split('.')[0]))
    } catch {}
  }
  return [...terms].filter(t => t.length >= 3).slice(0, 2)
}

export function buildPlan(input: PlanInput): Plan {
  const { store, setup, audit } = input
  const econ = economicsOf(input.orders90)
  const statusKnown = input.merchant.statuses_known

  const offers: PlanOffer[] = input.offers.map(o => {
    const s = input.sales90.get(o.offer_id) ?? { units: 0, revenue: 0, orders: 0 }
    const itemId = o.merchant_offer_id ?? (setup.platform === 'edinio' ? o.offer_id : null)
    const ads = itemId ? input.products30?.get(itemId.trim().toLowerCase()) : undefined
    const groupId = input.groups?.assigned.get(o.offer_id) ?? null
    // Motivul de excludere vine întâi (un produs epuizat nu rulează nicăieri); grupa, doar pentru cele eligibile
    const reason = reasonOf(o, statusKnown)
    return {
      offer_id: o.offer_id,
      item_id: itemId,
      title: o.product_name || o.title,
      variant_title: o.variant_title,
      image_url: o.image_url,
      category: o.category?.trim() || null,
      brand: o.brand?.trim() || null,
      price: o.price,
      on_sale: o.compare_at_price !== null && o.compare_at_price > o.price,
      units: s.units,
      revenue: s.revenue,
      orders: s.orders ?? 0,
      google30: input.googleSales30?.get(o.offer_id)?.orders ?? 0,
      ads30: ads ? { cost: ads.cost, conversions: ads.conversions, value: ads.value } : null,
      mode: o.ads_mode,
      reason: reason === null && groupId && input.groups?.live.has(groupId) ? 'in_group' : reason,
      group_id: groupId,
    }
  }).sort((a, b) => b.revenue - a.revenue || b.price - a.price)

  // ── Produsele care pot rula, cu grupe cu tot; campania principală, fără grupele lansate ──
  const eligible = offers.filter(o => o.reason === null || o.reason === 'in_group')
  const included = offers.filter(o => o.reason === null)

  // ── Comanda medie: unitatea de măsură pentru plafon, oprire și bugetul propus ──
  const aov = econ.aov ?? (eligible.length ? eligible.reduce((s, o) => s + o.price, 0) / eligible.length : null)

  // ── Treapta: Google cere 15 conversii în 30 de zile pentru licitarea pe valoare la Shopping ──
  // Doar cumpărările: Performance Max licitează numai pe PURCHASE~WEBSITE (un „adaugă în coș" principal nu contează)
  const conversions30 = audit ? purchaseConversions30(audit) : input.googleAds30.orders
  const stageId: Stage = conversions30 >= GROWTH_MIN_CONVERSIONS ? 'growth' : 'starter'

  // ROAS-ul pe care contul îl face acum (Shopping/PMax, altfel tot contul), doar ca informație
  let historical: number | null = null
  if (audit) {
    const h = audit.history
    if (h.shopping_cost30 > 0 && h.shopping_conversions30 >= 5) historical = h.shopping_value30 / h.shopping_cost30
    else if (h.cost30 > 0 && h.conversions30 >= 5) historical = h.value30 / h.cost30
  }

  // ── Bugetul: cât cheltuie contul acum pe Shopping/PMax, altfel o cincime din comanda medie ──
  const current = audit && audit.history.shopping_cost30 > 0 ? niceBudget(audit.history.shopping_cost30 / 30) : null
  const suggested = current ?? startBudget(aov)
  const basis: Plan['budget']['basis'] = current !== null ? 'history' : suggested !== null ? 'aov' : null
  const chosen = input.settings.daily_budget
  const daily = chosen ?? suggested

  const cpcCeiling = stageId === 'starter' ? cpcCeilingOf(aov) : null

  // ── Excluderile din campanie, după ID-ul din Merchant Center ─────────────
  const excludedOffers = offers.filter(o => o.reason !== null && CAMPAIGN_EXCLUSIONS.includes(o.reason))
  // Și produsele din Merchant Center care nu sunt ale magazinului: altfel campania le-ar promova
  const own = new Set(offers.map(o => o.item_id?.trim().toLowerCase()).filter((x): x is string => !!x))
  const foreignIds = [...new Set(input.merchant.foreign_ids ?? [])].filter(id => !own.has(id.trim().toLowerCase()))
  const itemIds = [...new Set([...excludedOffers.map(o => o.item_id).filter((x): x is string => !!x), ...foreignIds])]
  const unmatched = excludedOffers.filter(o => !o.item_id).length
  // Shopping standard duce 20.000 de noduri; PMax 1.000 pe grup, iar peste ele trece pe eticheta Hontrio
  const exclusionMode: Plan['exclusions']['mode'] = stageId === 'starter' || itemIds.length <= MAX_LISTING_ITEMS
    ? 'items' : input.merchant.label_index !== null ? 'label' : 'too_many'

  // ── Ce lipsește până la lansare ──────────────────────────────────────────
  const blockers: Plan['blockers'] = []
  const settingsPage = { href: '/settings?tab=integrations', external: false }
  if (store.connection_status !== 'active') blockers.push({ id: 'store', ...settingsPage })
  if (!input.google.connected) blockers.push({ id: 'google_ads', ...settingsPage })
  else if (!input.google.account) blockers.push({ id: 'ads_account', ...settingsPage })
  else if (input.google.account.currency && input.google.account.currency !== store.currency) {
    // Bugetul și valorile conversiilor sunt în moneda contului
    blockers.push({ id: 'currency', ...settingsPage, params: { account: input.google.account.currency, store: store.currency } })
  }
  // „De verificat" nu oprește planul: pluginul se verifică la lansare, prin audit
  if (setup.merchant.status === 'missing') blockers.push({ id: 'merchant', href: setup.merchant.href, external: true, variant: setup.platform })
  if (setup.conversion.status === 'missing') blockers.push({ id: 'conversion', href: setup.conversion.href, external: true, variant: setup.platform })
  // Toate produsele care pot rula sunt în grupe: campania principală n-are ce vinde
  if (!included.length) blockers.push({ id: 'no_offers', href: '/products', external: false, ...(eligible.length ? { variant: 'groups' } : {}) })
  // Auditul contului: fără el nu știm dacă Merchant Center e legat și dacă există conversia
  if (input.google.account) {
    if (!audit) blockers.push({ id: 'audit', href: '/campaigns?tab=plan#audit', external: false })
    else {
      for (const c of audit.checks) {
        // Moneda o spune deja pasul contului. Conversia fără valoarea comenzii oprește ambele trepte:
        // pilotul judecă ROAS-ul (oprirea de siguranță, produsele, bugetul) din valoarea ei
        // (un audit salvat înainte o are încă drept avertisment)
        const blocks = c.level === 'blocker' || c.id === 'purchase_no_value'
        if (!blocks || c.id === 'currency_mismatch') continue
        blockers.push({ id: c.id as BlockerId, href: '/campaigns?tab=plan#audit', external: false, params: c.params })
      }
    }
  }
  if (exclusionMode === 'too_many') blockers.push({ id: 'too_many_exclusions', href: '/campaigns?tab=plan', external: false, params: { count: itemIds.length } })
  // Eticheta Hontrio se pune doar pe produsele magazinului: cele străine ar rămâne în campanie
  else if (exclusionMode === 'label' && foreignIds.length) {
    blockers.push({ id: 'merchant_foreign', href: 'https://merchants.google.com/', external: true, params: { count: foreignIds.length } })
  }

  const merchantId = input.merchant.id ?? audit?.merchant_id ?? null

  return {
    platform: { id: setup.platform, name: setup.platformName },
    blockers,
    stage: { id: stageId, conversions30: Math.round(conversions30 * 10) / 10, basis: audit ? 'google_ads' : 'store' },
    campaign: {
      country: setup.feed.country,
      language: setup.feed.language,
      currency: input.google.account?.currency || store.currency,
      account: input.google.account ? { customer_id: input.google.account.customer_id, name: input.google.account.name } : null,
      merchant: { status: setup.merchant.status, via: setup.merchant.via },
      conversion: { status: setup.conversion.status, via: setup.conversion.via },
    },
    structure: {
      type: stageId === 'starter' ? 'shopping' : 'performance_max',
      cpc_ceiling: cpcCeiling,
      cpc_ceiling_low: cpcCeiling !== null && cpcCeiling < LOW_CPC,
      loss_limit: lossLimitOf(aov),
      merchant_id: merchantId,
      feed_label: input.merchant.feed_label,
      brand_negatives: audit?.search_active ? brandTerms(store.name, store.url) : [],
    },
    economics: { aov, value_ratio: econ.valueRatio },
    budget: { suggested, basis, chosen, daily },
    settings: { mode: input.settings.mode, max_daily_budget: input.settings.max_daily_budget },
    history: {
      google_ads_orders: input.googleAds90.orders,
      google_ads_total: input.googleAds90.total,
      roas30: historical === null ? null : Math.round(historical * 100) / 100,
      product_data: (input.products30?.size ?? 0) > 0,
    },
    exclusions: { item_ids: itemIds, unmatched, foreign: foreignIds.length, mode: exclusionMode },
    offers,
    counts: { included: included.length, excluded: offers.length - eligible.length, in_groups: eligible.length - included.length },
  }
}
