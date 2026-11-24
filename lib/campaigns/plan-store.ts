import { createAdminClient } from '@/lib/supabase/admin'
import { SALES_DAYS, type AdsMode, type Offer } from '@/lib/commerce/ads-data'
import type { Plan, PlanOffer, Reason } from '@/lib/campaigns/plan'
import type { GroupTotals } from '@/lib/campaigns/groups'

// =============================================
// Ce a hotărât planul pentru fiecare ofertă, ținut lângă ea în baza de date
// (commerce_offers.plan_reason / plan_group / plan_item_id, migrations/037).
// Din ele, paginile cer ofertele pe pagini, din SQL: un catalog de zeci de mii
// de oferte nu mai pleacă întreg spre pagină (peste limita de 4,5 MB a
// funcțiilor Vercel) și planul nu se socotește din nou la fiecare pagină.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

/** Câte oferte pleacă într-o cerere de salvare (ID-urile ajung în corpul cererii). */
const SAVE_CHUNK = 5000
const ADS_MODES: AdsMode[] = ['auto', 'include', 'exclude']

export type PlanOfferChange = { offer_id: string; reason: string; group: string | null; item: string | null }

/** Ofertele la care planul a hotărât altceva decât e salvat: motivul (`included` = intră), grupa sau ID-ul din Merchant Center. */
export function planChanges(saved: Pick<Offer, 'offer_id' | 'plan_reason' | 'plan_group' | 'plan_item_id'>[], plan: Pick<Plan, 'offers'>): PlanOfferChange[] {
  const before = new Map(saved.map(o => [o.offer_id, o]))
  const out: PlanOfferChange[] = []
  for (const p of plan.offers) {
    const reason = p.reason ?? 'included'
    const s = before.get(p.offer_id)
    if (s && (s.plan_reason ?? null) === reason && (s.plan_group ?? null) === p.group_id && (s.plan_item_id ?? null) === p.item_id) continue
    out.push({ offer_id: p.offer_id, reason, group: p.group_id, item: p.item_id })
  }
  return out
}

/** Scrie schimbările planului. Întoarce eroarea, fără să oprească planul: paginile arată ce era salvat. */
export async function savePlanOffers(supabase: Supabase, storeId: string, changes: PlanOfferChange[]): Promise<string | null> {
  for (let i = 0; i < changes.length; i += SAVE_CHUNK) {
    const chunk = changes.slice(i, i + SAVE_CHUNK)
    const { error } = await supabase.rpc('set_plan_offers', {
      p_store_id: storeId,
      p_offer_ids: chunk.map(c => c.offer_id),
      p_reasons: chunk.map(c => c.reason),
      p_groups: chunk.map(c => c.group),
      p_items: chunk.map(c => c.item),
    })
    if (error) return `set_plan_offers: ${error.message}`
  }
  return null
}

/** Ferestrele planului (ca loadAdsData): vânzările din magazin pe 90 de zile, comenzile Google și cifrele pe produs pe 30. */
export function planWindows(now = Date.now()): { since90: string; since30: string; day30: string } {
  const since90 = new Date(now - SALES_DAYS * 86_400_000).toISOString()
  const since30 = new Date(now - 30 * 86_400_000).toISOString()
  return { since90, since30, day30: since30.slice(0, 10) }
}

/** Căutarea, pentru ILIKE: fără caracterele speciale ale tiparului, cel mult 100 de caractere; null = fără căutare. */
export function likePattern(q: unknown): string | null {
  const text = typeof q === 'string' ? q.trim().slice(0, 100) : ''
  if (!text) return null
  return `%${text.replace(/[\\%_]/g, c => `\\${c}`)}%`
}

/** Un rând din plan_offer_page (migrations/037). Numerele vin din jsonb (pot fi și text). */
export type PlanPageRow = {
  offer_id: string; title: string; variant_title: string | null; image_url: string | null
  category: string | null; brand: string | null; price: number | string; compare_at_price: number | string | null
  ads_mode: string; reason: string; group_id: string | null; in_draft?: boolean; item_id: string | null
  units: number | string; revenue: number | string; orders: number | string
  google_orders: number | string; google_revenue: number | string
  ads_cost: number | string | null; ads_conversions: number | string | null; ads_value: number | string | null
}

const num = (v: unknown) => Number(v) || 0

/** Oferta dintr-o pagină: ca în plan, plus dacă e în grupa în lucru (editorul grupei). */
export type PageOffer = PlanOffer & { in_draft: boolean }

/** Rândul din baza de date, ca oferta din plan (aceleași câmpuri ca buildPlan). */
export function planOfferOf(r: PlanPageRow): PageOffer {
  const price = num(r.price)
  const compare = r.compare_at_price === null ? null : num(r.compare_at_price)
  const google = { orders: num(r.google_orders), revenue: num(r.google_revenue) }
  return {
    offer_id: r.offer_id,
    item_id: r.item_id,
    title: r.title,
    variant_title: r.variant_title,
    image_url: r.image_url,
    category: r.category,
    brand: r.brand,
    price,
    on_sale: compare !== null && compare > price,
    units: num(r.units),
    revenue: num(r.revenue),
    orders: num(r.orders),
    google30: google.orders,
    // Ca în buildPlan: vânzările venite din Google Ads din magazin, când sunt mai multe decât a numărat Google
    ads30: r.ads_cost === null ? null : {
      cost: num(r.ads_cost),
      conversions: Math.max(num(r.ads_conversions), google.orders),
      value: Math.max(num(r.ads_value), google.revenue),
    },
    mode: ADS_MODES.includes(r.ads_mode as AdsMode) ? (r.ads_mode as AdsMode) : 'auto',
    reason: r.reason === 'included' ? null : (r.reason as Reason),
    group_id: r.group_id,
    in_draft: r.in_draft === true,
  }
}

/** Totalurile din plan_group_preview, ca numere. */
export function groupTotalsFrom(raw: unknown): GroupTotals {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    members: num(r.members), running: num(r.running), matched: num(r.matched), items: num(r.items), elsewhere: num(r.elsewhere),
    units: num(r.units), revenue: num(r.revenue), orders: num(r.orders), price_sum: num(r.price_sum),
    google_orders: num(r.google_orders), ads_cost: num(r.ads_cost), ads_conversions: num(r.ads_conversions), ads_value: num(r.ads_value),
  }
}

export type ItemOffer = { offer_id: string; title: string; variant_title: string | null; image_url: string | null }

/**
 * Oferta din spatele fiecărui produs din cifrele Google (ID-ul din Merchant Center, fără litere mari): numele și
 * poza din magazin, doar pentru produsele cerute (rapoarte, fișa campaniei). Fără ele, rândul arată ID-ul.
 */
export async function offersByItems(supabase: Supabase, storeId: string, items: string[]): Promise<{ offers: Map<string, ItemOffer>; error: string | null }> {
  const offers = new Map<string, ItemOffer>()
  const wanted = [...new Set(items.map(i => i.trim().toLowerCase()).filter(Boolean))]
  if (!wanted.length) return { offers, error: null }
  const { data, error } = await supabase.rpc('plan_offers_by_items', { p_store_id: storeId, p_items: wanted })
  if (error) return { offers, error: error.message }
  for (const r of (Array.isArray(data) ? data : []) as (ItemOffer & { item: string })[]) {
    if (!offers.has(r.item)) offers.set(r.item, { offer_id: r.offer_id, title: r.title, variant_title: r.variant_title, image_url: r.image_url })
  }
  return { offers, error: null }
}
