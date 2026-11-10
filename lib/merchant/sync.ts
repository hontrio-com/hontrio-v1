import { createAdminClient } from '@/lib/supabase/admin'
import { storedMessage } from '@/lib/i18n/stored'
import { logError } from '@/lib/logger'
import { storeSetup } from '@/lib/commerce/setup'
import { getAccessTokenForUser, GoogleAuthError } from '@/lib/google/oauth'
import {
  createSupplementalDataSource, deleteProductInput, insertProductInput, listDataSources, listProducts,
  MerchantApiError, priceOf, productInputName, searchReports, setDefaultRule,
  type DataSourceReference, type ReportRow,
} from '@/lib/merchant/api'
import { dominantFeed, freeLabelIndex, matchProducts, shoppingIssues, shoppingStatus, type OfferRef } from '@/lib/merchant/match'

// =============================================
// Sincronizarea cu Merchant Center-ul magazinului (cron zilnic și la cerere):
// 1. potrivește produsele de acolo cu ofertele și le citește starea și problemele;
// 2. pune eticheta Hontrio pe produsele scoase din campanii, în sursa suplimentară
//    „Hontrio" (doar la cataloagele prea mari pentru lista de ID-uri);
// 3. aduce rapoartele de piață (prețuri față de concurență, cele mai vândute).
// Hontrio nu mai trimite costuri: un cost trimis înainte se șterge la prima trecere.
// Vezi docs/campanii/SPECIFICATIE.md §4, §8.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

export const SUPPLEMENTAL_NAME = 'Hontrio'
const PUSH_CONCURRENCY = 5

type StoreRow = {
  id: string; user_id: string; platform: string; store_url: string | null; currency: string | null
  country: string | null; language: string | null; platform_data: unknown
  merchant_center_id: string | null; merchant_feed_label: string | null; merchant_content_language: string | null
  merchant_data_source: string | null; merchant_label_index: number | null
}

const STORE_COLUMNS = 'id, user_id, platform, store_url, currency, country, language, platform_data, merchant_center_id, merchant_feed_label, merchant_content_language, merchant_data_source, merchant_label_index'

type EdinioMerchant = { google_merchant?: { cont_id?: string | null; eticheta_feed?: string | null; tara?: string | null; limba?: string | null } | null }

/**
 * Contul Merchant Center al magazinului: ales/salvat, cel din Edinio, sau cel
 * legat de contul Google Ads (din audit).
 */
export function merchantIdForStore(store: { merchant_center_id: string | null; platform: string; platform_data: unknown }, auditMerchantId: string | null): string | null {
  if (store.merchant_center_id) return store.merchant_center_id
  if (store.platform === 'edinio') {
    const id = (store.platform_data as EdinioMerchant | null)?.google_merchant?.cont_id
    if (id) return String(id)
  }
  return auditMerchantId
}

/** Eticheta feedului pe care rulează campania: din Edinio sau aflată din produse. */
export function feedLabelForStore(store: { merchant_feed_label: string | null; platform: string; platform_data: unknown }): string | null {
  if (store.platform === 'edinio') {
    const label = (store.platform_data as EdinioMerchant | null)?.google_merchant?.eticheta_feed
    if (label) return label
  }
  return store.merchant_feed_label
}

export type MerchantSyncResult =
  | { ok: true; merchant_id: string; products: number; matched: number; pushed: number; removed: number; insights: string[] }
  | { ok: false; reason: 'no_store' | 'no_merchant' | 'google_not_connected' | 'denied' | 'failed' }

type OfferRow = OfferRef & {
  /** Costul trimis cândva în Merchant Center (înainte să renunțăm la costuri): se șterge. */
  merchant_cogs_pushed: number | null
  merchant_label_pushed: string | null
}

async function readOffers(supabase: Supabase, storeId: string): Promise<OfferRow[]> {
  const all: OfferRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('commerce_offers')
      .select('offer_id, external_product_id, sku, gtin, url, merchant_cogs_pushed, merchant_label_pushed')
      .eq('store_id', storeId).order('offer_id').range(from, from + 999)
    if (error) throw new Error(`commerce_offers: ${error.message}`)
    for (const o of data ?? []) {
      all.push({
        ...o,
        merchant_cogs_pushed: o.merchant_cogs_pushed === null ? null : Number(o.merchant_cogs_pushed),
      } as OfferRow)
    }
    if (!data || data.length < 1000) return all
  }
}

/** Câte cereri deodată, ca să nu lovim limitele Merchant API. */
async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>, deadline?: number) {
  let i = 0
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      if (deadline && Date.now() > deadline) return
      const item = items[i++]
      await fn(item)
    }
  })
  await Promise.all(workers)
}

/**
 * Sursa suplimentară „Hontrio": o găsește sau o creează și o leagă de sursele
 * principale ale produselor, ULTIMA în regula implicită. Ce e deja în feedul
 * omului câștigă; noi completăm doar ce lipsește (eticheta noastră).
 */
async function ensureSupplemental(token: string, merchantId: string, known: string | null, primaries: Set<string>): Promise<string> {
  const sources = await listDataSources(token, merchantId)
  let ours = sources.find(s => s.name === known && s.supplementalProductDataSource)
    ?? sources.find(s => s.displayName === SUPPLEMENTAL_NAME && s.supplementalProductDataSource)
  if (!ours) ours = await createSupplementalDataSource(token, merchantId, SUPPLEMENTAL_NAME)

  for (const primary of sources.filter(s => s.primaryProductDataSource && primaries.has(s.name))) {
    const current: DataSourceReference[] = primary.primaryProductDataSource?.defaultRule?.takeFromDataSources ?? []
    if (current.some(r => r.supplementalDataSourceName === ours!.name)) continue
    // Fără `self`, Google ar ignora datele din sursa principală: îl punem primul dacă lipsește
    const base = current.length ? current : [{ self: true }]
    await setDefaultRule(token, primary.name, [...base, { supplementalDataSourceName: ours.name }])
  }
  return ours.name
}

// ─── Rapoartele de piață ────────────────────────────────────────────────────

export type PriceCompetitivenessRow = { offer_id: string; title: string; price: number | null; benchmark: number | null; currency: string | null }
export type PriceInsightRow = { offer_id: string; title: string; price: number | null; suggested: number | null; conversions_change: number | null; clicks_change: number | null; effectiveness: string | null }
export type BestSellerRow = { title: string; brand: string | null; category: string | null; rank: number | null; previous_rank: number | null; demand: string | null; report_date: string | null }

const view = (r: ReportRow, key: string) => (r[key] ?? {}) as Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : v === undefined || v === null ? null : String(v))
const num = (v: unknown) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
const dateOf = (v: unknown) => {
  const d = v as { year?: number; month?: number; day?: number } | undefined
  return d?.year ? `${d.year}-${String(d.month ?? 1).padStart(2, '0')}-${String(d.day ?? 1).padStart(2, '0')}` : null
}
const safeCode = (s: string) => s.replace(/[^A-Za-z]/g, '').toUpperCase()

async function fetchInsights(token: string, merchantId: string, country: string) {
  const c = safeCode(country)
  const out: { kind: 'price_competitiveness' | 'price_insights' | 'best_sellers'; rows: unknown[] }[] = []

  // Rapoartele cer un cont eligibil: unul refuzat lipsește, fără să oprească sincronizarea
  try {
    // i18n-ignore: interogare tehnică (GAQL / Merchant Reports)
    const rows = await searchReports(token, merchantId, `
      SELECT id, offer_id, title, price, benchmark_price, report_country_code
      FROM price_competitiveness_product_view
      WHERE report_country_code = '${c}'
      LIMIT 2000`)
    out.push({
      kind: 'price_competitiveness',
      rows: rows.map(r => view(r, 'priceCompetitivenessProductView')).map((v): PriceCompetitivenessRow => {
        const price = v.price as { amountMicros?: string; currencyCode?: string } | undefined
        return { offer_id: String(v.offerId ?? ''), title: str(v.title) ?? '', price: priceOf(price), benchmark: priceOf(v.benchmarkPrice as never), currency: price?.currencyCode ?? null }
      }).filter(r => r.offer_id && r.benchmark !== null),
    })
  } catch (err) { if (!(err instanceof MerchantApiError)) throw err }

  try {
    // i18n-ignore: interogare tehnică (GAQL / Merchant Reports)
    const rows = await searchReports(token, merchantId, `
      SELECT id, offer_id, title, price, suggested_price, predicted_clicks_change_fraction,
             predicted_conversions_change_fraction, effectiveness
      FROM price_insights_product_view
      LIMIT 2000`)
    out.push({
      kind: 'price_insights',
      rows: rows.map(r => view(r, 'priceInsightsProductView')).map((v): PriceInsightRow => ({
        offer_id: String(v.offerId ?? ''), title: str(v.title) ?? '',
        price: priceOf(v.price as never), suggested: priceOf(v.suggestedPrice as never),
        conversions_change: num(v.predictedConversionsChangeFraction), clicks_change: num(v.predictedClicksChangeFraction),
        effectiveness: str(v.effectiveness),
      })).filter(r => r.offer_id && r.suggested !== null),
    })
  } catch (err) { if (!(err instanceof MerchantApiError)) throw err }

  try {
    const select = `SELECT report_date, report_granularity, report_country_code, report_category_id, title, brand,
             category_l1, category_l2, category_l3, rank, previous_rank, relative_demand, inventory_status, brand_inventory_status
      FROM best_sellers_product_cluster_view`
    let rows: ReportRow[]
    try {
      // i18n-ignore: interogare tehnică (GAQL / Merchant Reports)
      rows = await searchReports(token, merchantId, `${select}
        WHERE report_country_code = '${c}' AND report_granularity = 'WEEKLY'
          AND inventory_status = 'NOT_IN_INVENTORY' AND brand_inventory_status = 'IN_STOCK'
        ORDER BY rank LIMIT 100`)
    } catch (err) {
      if (!(err instanceof MerchantApiError) || err.httpStatus !== 400) throw err
      // Dacă filtrele pe stoc nu sunt primite, le aplicăm noi
      // i18n-ignore: interogare tehnică (GAQL / Merchant Reports)
      rows = (await searchReports(token, merchantId, `${select}
        WHERE report_country_code = '${c}' AND report_granularity = 'WEEKLY'
        ORDER BY rank LIMIT 1000`))
        .filter(r => { const v = view(r, 'bestSellersProductClusterView'); return v.inventoryStatus === 'NOT_IN_INVENTORY' && v.brandInventoryStatus === 'IN_STOCK' })
        .slice(0, 100)
    }
    out.push({
      kind: 'best_sellers',
      rows: rows.map(r => view(r, 'bestSellersProductClusterView')).map((v): BestSellerRow => ({
        title: str(v.title) ?? '', brand: str(v.brand),
        category: str(v.categoryL3) ?? str(v.categoryL2) ?? str(v.categoryL1),
        rank: num(v.rank), previous_rank: num(v.previousRank), demand: str(v.relativeDemand), report_date: dateOf(v.reportDate),
      })).filter(r => r.title),
    })
  } catch (err) { if (!(err instanceof MerchantApiError)) throw err }

  return out
}

// ─── Sincronizarea ──────────────────────────────────────────────────────────

/**
 * `labels`: ofertele care trebuie să poarte eticheta Hontrio (doar campaniile care
 * filtrează după etichetă, la cataloage prea mari pentru lista de ID-uri).
 */
export async function syncMerchant(storeId: string, opts: { auditMerchantId?: string | null; labels?: Map<string, string> | null; deadline?: number } = {}): Promise<MerchantSyncResult> {
  const supabase = createAdminClient()
  const { data: store } = await supabase.from('stores').select(STORE_COLUMNS).eq('id', storeId).maybeSingle<StoreRow>()
  if (!store) return { ok: false, reason: 'no_store' }

  let auditMerchantId = opts.auditMerchantId ?? null
  if (auditMerchantId === null && !store.merchant_center_id) {
    const { data: audit } = await supabase.from('google_audits').select('result').eq('store_id', storeId).maybeSingle()
    auditMerchantId = (audit?.result as { merchant_id?: string | null } | null)?.merchant_id ?? null
  }
  const merchantId = merchantIdForStore(store, auditMerchantId)
  if (!merchantId) return { ok: false, reason: 'no_merchant' }

  const fail = async (reason: 'denied' | 'failed' | 'google_not_connected', message: string) => {
    await supabase.from('stores').update({ merchant_error: message }).eq('id', storeId)
    return { ok: false as const, reason }
  }

  let token: string
  try {
    token = await getAccessTokenForUser(store.user_id)
  } catch (err) {
    if (err instanceof GoogleAuthError) return fail('google_not_connected', storedMessage('sync.merchant_google_missing'))
    throw err
  }

  try {
    const products = await listProducts(token, merchantId)
    const offers = await readOffers(supabase, storeId)
    const setup = storeSetup(store as never)
    const country = (setup?.feed.country || store.country || '').toUpperCase() || null
    const matches = matchProducts(store.platform, offers, products, feedLabelForStore(store))

    // 1. ID-ul din Merchant Center, problemele și (unde magazinul nu o spune) starea
    const setStatus = store.platform !== 'edinio'
    const rows = offers.map(o => {
      const p = matches.get(o.offer_id)
      return {
        offer_id: o.offer_id,
        merchant_offer_id: p ? p.offerId : null,
        merchant_issues: p ? shoppingIssues(p, country) : null,
        google_status: p ? shoppingStatus(p, country) : null,
      }
    })
    for (let i = 0; i < rows.length; i += 1000) {
      const { error } = await supabase.rpc('commerce_set_merchant_data', { p_store_id: storeId, p_rows: rows.slice(i, i + 1000), p_set_status: setStatus })
      if (error) throw new Error(`commerce_set_merchant_data: ${error.message}`)
    }

    const matched = [...matches.values()]
    const feed = dominantFeed(matched)
    const labelIndex = store.merchant_label_index ?? freeLabelIndex(products)

    // 2. Etichetele, în sursa suplimentară (un cost trimis cândva se scoate odată cu ele)
    let pushed = 0
    let removed = 0
    let dataSource = store.merchant_data_source
    const labels = opts.labels ?? null
    const wanted = (o: OfferRow) => ({
      cogs: null as number | null,
      label: labels && labelIndex !== null ? labels.get(o.offer_id) ?? null : null,
    })
    const sendList = offers.filter(o => {
      if (!matches.has(o.offer_id)) return false
      const w = wanted(o)
      return w.cogs !== o.merchant_cogs_pushed || w.label !== o.merchant_label_pushed
    })

    if (sendList.length) {
      const primaries = new Set(matched.map(p => p.dataSource).filter((x): x is string => !!x))
      dataSource = await ensureSupplemental(token, merchantId, store.merchant_data_source, primaries)
      const done: { offer_id: string; cogs: number | null; label: string | null }[] = []
      await pool(sendList, PUSH_CONCURRENCY, async o => {
        const p = matches.get(o.offer_id)!
        const w = wanted(o)
        const cogs = w.cogs
        try {
          if (cogs === null && w.label === null) {
            await deleteProductInput(token, productInputName(merchantId, p.contentLanguage, p.feedLabel, p.offerId), dataSource!)
            removed++
          } else {
            const attrs: Record<string, unknown> = {}
            if (w.label !== null && labelIndex !== null) attrs[`customLabel${labelIndex}`] = w.label
            await insertProductInput(token, merchantId, dataSource!, { offerId: p.offerId, contentLanguage: p.contentLanguage, feedLabel: p.feedLabel, productAttributes: attrs })
            pushed++
          }
          done.push({ offer_id: o.offer_id, cogs, label: w.label })
        } catch (err) {
          // Un produs refuzat nu oprește restul; se reîncearcă la următoarea trecere
          if (err instanceof MerchantApiError && err.httpStatus === 404 && cogs === null && w.label === null) {
            done.push({ offer_id: o.offer_id, cogs: null, label: null })
            return
          }
          if (!(err instanceof MerchantApiError)) throw err
          logError('merchant-sync', 'Produs netrimis în sursa suplimentară', { storeId, offerId: p.offerId, error: err.message })
        }
      }, opts.deadline)
      for (let i = 0; i < done.length; i += 1000) {
        const { error } = await supabase.rpc('commerce_mark_merchant_pushed', { p_store_id: storeId, p_rows: done.slice(i, i + 1000) })
        if (error) throw new Error(`commerce_mark_merchant_pushed: ${error.message}`)
      }
    }

    // 3. Rapoartele de piață
    const insights = country ? await fetchInsights(token, merchantId, country) : []
    const now = new Date().toISOString()
    if (insights.length) {
      await supabase.from('merchant_insights').upsert(insights.map(i => ({ store_id: storeId, kind: i.kind, rows: i.rows, fetched_at: now })), { onConflict: 'store_id,kind' })
    }

    await supabase.from('stores').update({
      merchant_center_id: merchantId,
      merchant_feed_label: feed.feedLabel ?? store.merchant_feed_label,
      merchant_content_language: feed.contentLanguage ?? store.merchant_content_language,
      merchant_data_source: dataSource,
      merchant_label_index: labelIndex,
      merchant_synced_at: now,
      merchant_error: null,
    }).eq('id', storeId)

    return { ok: true, merchant_id: merchantId, products: products.length, matched: matches.size, pushed, removed, insights: insights.map(i => i.kind) }
  } catch (err) {
    if (err instanceof MerchantApiError) {
      const denied = err.httpStatus === 401 || err.httpStatus === 403
      logError('merchant-sync', 'Merchant API a refuzat sincronizarea', { storeId, status: err.httpStatus, reason: err.reason, error: err.message })
      return fail(denied ? 'denied' : 'failed', storedMessage(denied ? 'sync.merchant_denied' : 'sync.merchant_failed', { merchant: merchantId, detail: err.message.slice(0, 300) }))
    }
    throw err
  }
}
