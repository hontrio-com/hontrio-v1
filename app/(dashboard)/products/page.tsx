'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/context'
import {
  AlertCircle, ChevronLeft, ChevronRight, ExternalLink, ImageIcon, Info, Loader2,
  Package, RefreshCw, Search, Store, X,
} from 'lucide-react'

// =============================================
// Produse — ofertele magazinului, cum ajung la Google, cu vânzările de pe
// site și prețul de cost. Pe ele se vor sprijini campaniile: ce produse
// merită promovate și cât poate costa o vânzare.
// =============================================

type Sales = { units: number; revenue: number; orders: number }
type Offer = {
  offer_id: string; external_product_id: string; item_group_id: string | null
  title: string; product_name: string | null; variant_title: string | null; category: string | null
  url: string | null; image_url: string | null
  price: number; compare_at_price: number | null; currency: string
  available: boolean; stock: number | null; sku: string | null; gtin: string | null; brand: string | null
  google_status: string | null; cost_price: number | null; sales: Sales
}
type StoreInfo = {
  id: string; platform: string; platform_name: string; store_name: string | null; currency: string
  connection_status: string | null; sync_status: string | null; last_sync_at: string | null; last_error: string | null
  prices_include_vat: boolean | null; supported: boolean
  /** Edinio știe ce face Google cu ofertele; la WooCommerce aflăm după legarea contului Google */
  google_status_known: boolean
}
type Period = 30 | 90 | 365
type Quick = 'all' | 'out' | 'no_cost' | 'google_issue'
type Sort = 'sales' | 'revenue' | 'margin' | 'price' | 'name'

const PER_PAGE = 50
const PERIODS: Period[] = [30, 90, 365]
const SORTS: Sort[] = ['sales', 'revenue', 'margin', 'price', 'name']
// Stări la Google cu care oferta nu poate rula în reclame
const GOOGLE_PROBLEMS = ['disapproved', 'error', 'expirat', 'exclus']

const GOOGLE_STYLE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  expirat: 'bg-amber-50 text-amber-700',
  disapproved: 'bg-red-50 text-red-600',
  error: 'bg-red-50 text-red-600',
  exclus: 'bg-neutral-100 text-neutral-500',
}

function marginOf(o: Offer): { amount: number; pct: number } | null {
  if (o.cost_price === null || !(o.price > 0)) return null
  const amount = o.price - o.cost_price
  return { amount, pct: (amount / o.price) * 100 }
}

function CostInput({ offer, fmt, siblings, onSaved }: {
  offer: Offer
  fmt: Intl.NumberFormat
  siblings: number
  onSaved: (offerIds: string[], cost: number | null) => void
}) {
  const { t } = useT()
  const shown = offer.cost_price === null ? '' : String(offer.cost_price).replace('.', ',')
  const [value, setValue] = useState(shown)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [applying, setApplying] = useState(false)

  useEffect(() => { setValue(shown) }, [shown])

  async function patch(body: Record<string, unknown>) {
    const r = await fetch('/api/catalog/cost', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.error || 'error')
    return d as { updated: string[]; cost_price: number | null }
  }

  async function save() {
    const raw = value.trim().replace(/\s/g, '').replace(',', '.')
    const next = raw === '' ? null : Number(raw)
    if (next !== null && (!Number.isFinite(next) || next < 0)) { setState('error'); return }
    const same = next === null ? offer.cost_price === null
      : offer.cost_price !== null && Math.round(next * 100) === Math.round(offer.cost_price * 100)
    if (same) { setState('idle'); return }
    setState('saving')
    try {
      const d = await patch({ offer_id: offer.offer_id, cost_price: next })
      onSaved(d.updated, d.cost_price)
      setState('saved')
      setTimeout(() => setState(s => (s === 'saved' ? 'idle' : s)), 1500)
    } catch {
      setState('error')
    }
  }

  async function applyToVariants() {
    setApplying(true)
    try {
      const d = await patch({ product_id: offer.external_product_id, cost_price: offer.cost_price })
      onSaved(d.updated, d.cost_price)
    } catch {
      setState('error')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="w-[120px]">
      <div className={`flex items-center h-8 rounded-lg border bg-white px-2 transition-colors
        ${state === 'error' ? 'border-red-300' : state === 'saved' ? 'border-emerald-300' : 'border-neutral-200 focus-within:border-neutral-400'}`}>
        <input
          value={value}
          inputMode="decimal"
          aria-label={t('catalog.cost')}
          placeholder="—"
          onChange={e => { setValue(e.target.value); if (state === 'error') setState('idle') }}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setValue(shown); setState('idle') } }}
          className="w-full min-w-0 bg-transparent text-[13px] text-neutral-900 tabular-nums text-right focus:outline-none placeholder:text-neutral-300"
        />
        <span className="ml-1 text-[11px] text-neutral-400 shrink-0">{offer.currency}</span>
        {state === 'saving' && <Loader2 className="ml-1 h-3 w-3 animate-spin text-neutral-400 shrink-0" />}
      </div>
      {state === 'error' && <p className="mt-0.5 text-[10px] text-red-500">{t('catalog.cost_invalid')}</p>}
      {state !== 'error' && siblings > 0 && offer.cost_price !== null && (
        <button onClick={applyToVariants} disabled={applying}
          title={t('catalog.apply_variants_hint', { cost: fmt.format(offer.cost_price) })}
          className="mt-0.5 text-[10px] text-neutral-400 hover:text-neutral-700 underline-offset-2 hover:underline disabled:opacity-50">
          {applying ? t('catalog.applying') : t('catalog.apply_variants', { count: String(siblings + 1) })}
        </button>
      )}
    </div>
  )
}

export default function ProductsPage() {
  const { t, locale } = useT()
  const [days, setDays] = useState<Period>(30)
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [quick, setQuick] = useState<Quick>('all')
  const [sort, setSort] = useState<Sort>('sales')
  const [page, setPage] = useState(1)
  const [syncing, setSyncing] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const loadedOnce = useRef(false)

  const load = useCallback(async (period: Period) => {
    if (!loadedOnce.current) setLoading(true)
    setLoadError(false)
    try {
      const r = await fetch(`/api/catalog?days=${period}`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      setStore(d.store)
      setOffers(d.offers || [])
      loadedOnce.current = true
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(days) }, [days, load])

  // Prima sincronizare după conectare: pagina o urmărește până apar ofertele
  const firstSyncRunning = !!store?.supported && offers.length === 0
    && (store.sync_status === 'syncing' || (!store.last_sync_at && store.connection_status === 'active'))
  useEffect(() => {
    if (!firstSyncRunning) return
    const id = setInterval(() => load(days), 5000)
    return () => clearInterval(id)
  }, [firstSyncRunning, days, load])

  const currency = store?.currency || offers[0]?.currency || 'RON'
  const numberLocale = locale === 'en' ? 'en-GB' : 'ro-RO'
  const fmt = useMemo(() => {
    try { return new Intl.NumberFormat(numberLocale, { style: 'currency', currency, maximumFractionDigits: 2 }) }
    catch { return new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 2 }) }
  }, [numberLocale, currency])
  const fmtInt = useMemo(() => new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 }), [numberLocale])

  const siblingsByProduct = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of offers) if (o.item_group_id) m.set(o.external_product_id, (m.get(o.external_product_id) ?? 0) + 1)
    return m
  }, [offers])

  const counts = useMemo(() => ({
    all: offers.length,
    out: offers.filter(o => !o.available).length,
    no_cost: offers.filter(o => o.cost_price === null).length,
    google_issue: offers.filter(o => o.google_status && GOOGLE_PROBLEMS.includes(o.google_status)).length,
  }), [offers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = offers.filter(o => {
      if (quick === 'out' && o.available) return false
      if (quick === 'no_cost' && o.cost_price !== null) return false
      if (quick === 'google_issue' && !(o.google_status && GOOGLE_PROBLEMS.includes(o.google_status))) return false
      if (!q) return true
      return [o.title, o.product_name, o.variant_title, o.sku, o.gtin, o.category, o.offer_id]
        .some(v => v && v.toLowerCase().includes(q))
    })
    const byName = (a: Offer, b: Offer) => (a.title || '').localeCompare(b.title || '', numberLocale)
    return list.sort((a, b) => {
      if (sort === 'name') return byName(a, b)
      if (sort === 'price') return b.price - a.price || byName(a, b)
      if (sort === 'revenue') return b.sales.revenue - a.sales.revenue || byName(a, b)
      if (sort === 'margin') {
        const ma = marginOf(a), mb = marginOf(b)
        if (ma && mb) return mb.pct - ma.pct
        if (ma || mb) return ma ? -1 : 1
        return byName(a, b)
      }
      return b.sales.units - a.sales.units || b.sales.revenue - a.sales.revenue || byName(a, b)
    })
  }, [offers, quick, search, sort, numberLocale])

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const current = Math.min(page, pages)
  const visible = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE)
  useEffect(() => { setPage(1) }, [search, quick, sort])

  const onSaved = useCallback((ids: string[], cost: number | null) => {
    const set = new Set(ids)
    setOffers(list => list.map(o => (set.has(o.offer_id) ? { ...o, cost_price: cost } : o)))
  }, [])

  async function handleSync() {
    if (!store) return
    setSyncing(true); setNotice(null)
    try {
      const r = await fetch(`/api/stores/${store.id}/sync`, { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) setNotice({ ok: false, text: d.error || t('catalog.sync_error') })
      // Un magazin mare nu încape într-o rulare: restul vine la sincronizările următoare
      else setNotice({ ok: true, text: t(d.complete === false ? 'catalog.sync_partial' : 'edinio.sync_done', { offers: String(d.synced ?? 0), orders: String(d.orders ?? 0) }) })
      await load(days)
    } catch {
      setNotice({ ok: false, text: t('catalog.sync_error') })
    } finally {
      setSyncing(false)
    }
  }

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">{t('catalog.title')}</h1>
        <p className="text-[13px] text-neutral-400 mt-0.5">
          {store?.supported && offers.length > 0
            ? t('catalog.subtitle', { count: fmtInt.format(offers.length), store: store.store_name || '' })
            : t('catalog.subtitle_empty')}
          {store?.last_sync_at && store.supported && (
            <> · {t('catalog.synced_at', { time: new Date(store.last_sync_at).toLocaleString(numberLocale, { dateStyle: 'short', timeStyle: 'short' }) })}</>
          )}
        </p>
      </div>
      {store?.supported && (
        <div className="flex items-center gap-2">
          <select value={days} onChange={e => setDays(Number(e.target.value) as Period)} aria-label={t('catalog.period')}
            className="h-9 px-3 rounded-xl border border-neutral-200 bg-white text-[12px] font-medium text-neutral-600 focus:outline-none focus:border-neutral-400">
            {PERIODS.map(p => <option key={p} value={p}>{t(`catalog.period_${p}`)}</option>)}
          </select>
          <button onClick={handleSync} disabled={syncing || store.connection_status === 'revoked'}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-neutral-200 bg-white text-[12px] font-medium text-neutral-600 hover:border-neutral-300 hover:text-neutral-900 transition-all disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('settings.sync_now')}</span>
          </button>
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-5">
        {header}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-[76px] rounded-xl bg-neutral-100 animate-pulse" />)}
        </div>
        <div className="h-96 rounded-xl bg-neutral-100 animate-pulse" />
      </div>
    )
  }

  if (loadError && !loadedOnce.current) {
    return (
      <div className="space-y-5">
        {header}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white py-16 text-center">
          <AlertCircle className="h-6 w-6 text-neutral-400" />
          <p className="mt-3 text-[14px] font-medium text-neutral-900">{t('catalog.load_error')}</p>
          <button onClick={() => load(days)} className="mt-4 h-9 px-4 rounded-xl bg-neutral-900 text-white text-[13px] font-medium hover:bg-neutral-800">
            {t('catalog.retry')}
          </button>
        </div>
      </div>
    )
  }

  if (!store || !store.supported) {
    return (
      <div className="space-y-5">
        {header}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white py-20 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100">
            <Store className="h-6 w-6 text-neutral-500" />
          </div>
          <p className="mt-4 text-[15px] font-semibold text-neutral-900">
            {store ? t('catalog.unsupported_title') : t('catalog.no_store_title')}
          </p>
          <p className="mt-1 max-w-md text-[13px] text-neutral-400 leading-relaxed">
            {store ? t('catalog.unsupported_desc') : t('catalog.no_store_desc')}
          </p>
          {!store && (
            <Link href="/settings?tab=integrations"
              className="mt-5 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-neutral-900 text-white text-[13px] font-medium hover:bg-neutral-800">
              {t('catalog.connect_store')}
            </Link>
          )}
        </div>
      </div>
    )
  }

  const vatHint = store.prices_include_vat === true ? t('catalog.cost_hint_vat')
    : store.prices_include_vat === false ? t('catalog.cost_hint_no_vat') : t('catalog.cost_hint_unknown')

  return (
    <div className="space-y-5">
      {header}

      {(store.connection_status === 'revoked' || store.connection_status === 'error') && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-[12px] leading-relaxed bg-amber-50 border border-amber-100 text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 mt-px" />
          <span className="flex-1">
            {store.connection_status === 'revoked' ? t('catalog.revoked', { platform: store.platform_name }) : t('catalog.store_error', { platform: store.platform_name })}
            {store.connection_status === 'error' && store.last_error && <span className="block text-amber-700/70">{store.last_error}</span>}
          </span>
          {store.connection_status === 'revoked' && (
            <Link href="/settings?tab=integrations" className="font-medium underline underline-offset-2">{t('catalog.reconnect')}</Link>
          )}
        </div>
      )}

      {notice && (
        <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-[12px] leading-relaxed ${notice.ok ? 'bg-neutral-900 text-white' : 'bg-amber-50 border border-amber-100 text-amber-800'}`}>
          <AlertCircle className="h-4 w-4 shrink-0 mt-px" />
          <span className="flex-1">{notice.text}</span>
          <button onClick={() => setNotice(null)} className="opacity-50 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {offers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white py-20 text-center">
          {firstSyncRunning ? <Loader2 className="h-6 w-6 animate-spin text-neutral-400" /> : <Package className="h-6 w-6 text-neutral-400" />}
          <p className="mt-4 text-[15px] font-semibold text-neutral-900">
            {firstSyncRunning ? t('catalog.first_sync_title') : t('catalog.empty_title')}
          </p>
          <p className="mt-1 max-w-md text-[13px] text-neutral-400">
            {firstSyncRunning ? t('catalog.first_sync_desc') : t('catalog.empty_desc')}
          </p>
        </div>
      ) : (
        <>
          {/* Cifrele de sus sunt și filtre */}
          <div className={`grid grid-cols-2 gap-3 ${store.google_status_known ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            {([
              { key: 'all', value: counts.all, label: t('catalog.stat_all'), accent: '' },
              { key: 'out', value: counts.out, label: t('catalog.stat_out'), accent: counts.out ? 'text-amber-600' : '' },
              { key: 'no_cost', value: counts.no_cost, label: t('catalog.stat_no_cost'), accent: counts.no_cost ? 'text-amber-600' : '' },
              ...(store.google_status_known
                ? [{ key: 'google_issue', value: counts.google_issue, label: t('catalog.stat_google_issue'), accent: counts.google_issue ? 'text-red-600' : '' }]
                : []),
            ] as { key: Quick; value: number; label: string; accent: string }[]).map(s => {
              const active = quick === s.key
              return (
                <button key={s.key} onClick={() => setQuick(active && s.key !== 'all' ? 'all' : s.key)}
                  className={`text-left p-4 rounded-xl border transition-all ${active ? 'border-neutral-900 bg-neutral-900' : 'border-neutral-200 bg-white hover:border-neutral-300'}`}>
                  <p className={`text-[22px] font-bold tabular-nums ${active ? 'text-white' : (s.accent || 'text-neutral-900')}`}>{fmtInt.format(s.value)}</p>
                  <p className="text-[11px] mt-0.5 text-neutral-400">{s.label}</p>
                </button>
              )
            })}
          </div>

          {counts.no_cost > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-[12px] leading-relaxed bg-neutral-50 border border-neutral-100 text-neutral-600">
              <Info className="h-4 w-4 shrink-0 mt-px text-neutral-400" />
              <span>{t('catalog.cost_explainer')} {vatHint}</span>
            </div>
          )}

          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="flex flex-col gap-2 p-3 border-b border-neutral-100 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-300 pointer-events-none" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('catalog.search_placeholder')}
                  className="w-full h-9 pl-9 pr-8 rounded-xl bg-neutral-50 border border-neutral-100 text-[13px] text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:border-neutral-300 focus:bg-white transition-all" />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-500">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <select value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label={t('catalog.sort_label')}
                className="h-9 px-3 rounded-xl border border-neutral-200 bg-white text-[12px] font-medium text-neutral-600 focus:outline-none focus:border-neutral-400">
                {SORTS.map(s => <option key={s} value={s}>{t(`catalog.sort_${s}`)}</option>)}
              </select>
            </div>

            {filtered.length === 0 ? (
              <p className="py-14 text-center text-[13px] text-neutral-400">{t('catalog.no_results')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left">
                  <thead>
                    <tr className="border-b border-neutral-100 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                      <th className="px-4 py-2.5">{t('catalog.col_product')}</th>
                      <th className="px-3 py-2.5 text-right">{t('catalog.col_price')}</th>
                      <th className="px-3 py-2.5">{t('catalog.col_stock')}</th>
                      {store.google_status_known && <th className="px-3 py-2.5">{t('catalog.col_google')}</th>}
                      <th className="px-3 py-2.5 text-right">{t('catalog.col_sales', { period: t(`catalog.period_short_${days}`) })}</th>
                      <th className="px-3 py-2.5">{t('catalog.col_cost')}</th>
                      <th className="px-4 py-2.5 text-right">{t('catalog.col_margin')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {visible.map(o => {
                      const m = marginOf(o)
                      const onSale = o.compare_at_price !== null && o.compare_at_price > o.price
                      return (
                        <tr key={o.offer_id} className="align-top hover:bg-neutral-50/60">
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50 flex items-center justify-center">
                                {o.image_url
                                  // eslint-disable-next-line @next/next/no-img-element
                                  ? <img src={o.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                                  : <ImageIcon className="h-4 w-4 text-neutral-300" />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium text-neutral-900 leading-snug line-clamp-2">{o.product_name || o.title}</p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-400">
                                  {o.variant_title && <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-neutral-600">{o.variant_title}</span>}
                                  {o.sku && <span>SKU {o.sku}</span>}
                                  {o.url && (
                                    <a href={o.url} target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 hover:text-neutral-700">
                                      {t('catalog.view')}<ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            <p className="text-[13px] font-semibold text-neutral-900 tabular-nums">{fmt.format(o.price)}</p>
                            {onSale && <p className="text-[11px] text-neutral-400 line-through tabular-nums">{fmt.format(o.compare_at_price!)}</p>}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {!o.available ? (
                              <span className="inline-flex text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-red-50 text-red-600">{t('catalog.stock_out')}</span>
                            ) : o.stock === null ? (
                              <span className="text-[12px] text-neutral-500">{t('catalog.stock_untracked')}</span>
                            ) : (
                              <span className={`text-[12px] tabular-nums ${o.stock <= 3 ? 'text-amber-600 font-medium' : 'text-neutral-700'}`}>
                                {t('catalog.stock_units', { count: fmtInt.format(o.stock) })}
                              </span>
                            )}
                          </td>
                          {store.google_status_known && (
                            <td className="px-3 py-3 whitespace-nowrap">
                              {o.google_status ? (
                                <span className={`inline-flex text-[11px] font-medium px-1.5 py-0.5 rounded-md ${GOOGLE_STYLE[o.google_status] || 'bg-neutral-100 text-neutral-500'}`}>
                                  {t(`catalog.google_${GOOGLE_STYLE[o.google_status] ? o.google_status : 'other'}`)}
                                </span>
                              ) : (
                                <span className="text-[12px] text-neutral-300" title={t('catalog.google_none_hint')}>{t('catalog.google_none')}</span>
                              )}
                            </td>
                          )}
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            {o.sales.units > 0 ? (
                              <>
                                <p className="text-[13px] font-medium text-neutral-900 tabular-nums">{t('catalog.units', { count: fmtInt.format(o.sales.units) })}</p>
                                <p className="text-[11px] text-neutral-400 tabular-nums">{fmt.format(o.sales.revenue)}</p>
                              </>
                            ) : <span className="text-[12px] text-neutral-300">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            <CostInput offer={o} fmt={fmt} onSaved={onSaved}
                              siblings={o.item_group_id ? Math.max(0, (siblingsByProduct.get(o.external_product_id) ?? 1) - 1) : 0} />
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {m ? (
                              <>
                                <p className={`text-[13px] font-semibold tabular-nums ${m.amount < 0 ? 'text-red-600' : m.pct < 20 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {Math.round(m.pct)}%
                                </p>
                                <p className="text-[11px] text-neutral-400 tabular-nums">{fmt.format(m.amount)}</p>
                              </>
                            ) : <span className="text-[12px] text-neutral-300">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {pages > 1 && (
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-neutral-100 text-[12px] text-neutral-500">
                <span>{t('catalog.page_of', { from: fmtInt.format((current - 1) * PER_PAGE + 1), to: fmtInt.format(Math.min(current * PER_PAGE, filtered.length)), total: fmtInt.format(filtered.length) })}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={current === 1}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-40" aria-label={t('catalog.prev')}>
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={current === pages}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-40" aria-label={t('catalog.next')}>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
