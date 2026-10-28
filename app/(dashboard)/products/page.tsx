'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, Check, ChevronLeft, ChevronRight, ExternalLink, ImageIcon, Loader2, Package, Percent, RefreshCw, Search, Store, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardHeader } from '@/components/app/surface'
import { Badge, type Tone } from '@/components/app/badge'
import { Button, linkStyles } from '@/components/app/button'
import { Checkbox, Input, Select } from '@/components/app/input'
import { Segmented } from '@/components/app/tabs'
import { Table, Td, Th, Tr } from '@/components/app/table'
import { Callout, EmptyState, Skeleton } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { useFormats, type Formats } from '@/components/app/formats'

// =============================================
// Produse — ofertele magazinului, cum ajung la Google, cu vânzările de pe
// site și prețul de cost. Pe ele se sprijină campaniile: ce produse merită
// promovate și cât poate costa o vânzare. Cifrele de sus sunt și filtre.
// =============================================

type Sales = { units: number; revenue: number; orders: number }
type Offer = {
  offer_id: string; external_product_id: string; item_group_id: string | null
  title: string; product_name: string | null; variant_title: string | null; category: string | null
  url: string | null; image_url: string | null
  price: number; compare_at_price: number | null; currency: string
  available: boolean; stock: number | null; sku: string | null; gtin: string | null; brand: string | null
  google_status: string | null; cost_price: number | null; sales: Sales
  /** De unde vine costul: scris de om, estimat în masă sau preluat din platformă */
  cost_source: 'manual' | 'estimate' | 'woocommerce' | 'shopify' | null
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
const QUICKS: Quick[] = ['all', 'out', 'no_cost', 'google_issue']
// Platformele din care Hontrio preia singur prețul de cost
const COST_PLATFORMS = ['woocommerce', 'shopify']
// Stări la Google cu care oferta nu poate rula în reclame
const GOOGLE_PROBLEMS = ['disapproved', 'error', 'expirat', 'exclus']
const GOOGLE_TONE: Record<string, Tone> = {
  active: 'green', pending: 'amber', expirat: 'amber', disapproved: 'red', error: 'red', exclus: 'neutral',
}

function marginOf(o: Offer): { amount: number; pct: number } | null {
  if (o.cost_price === null || !(o.price > 0)) return null
  const amount = o.price - o.cost_price
  return { amount, pct: (amount / o.price) * 100 }
}

/** Prețul de cost al unei oferte: se salvează la Enter sau la ieșirea din câmp. */
function CostInput({ offer, f, siblings, platform, onSaved }: {
  offer: Offer
  f: Formats
  siblings: number
  /** Magazinul din care pot veni costuri, cu explicația lor */
  platform: { name: string; hint: string }
  onSaved: (offerIds: string[], cost: number | null) => void
}) {
  const { t } = useT()
  const shown = offer.cost_price === null ? '' : String(offer.cost_price).replace('.', ',')
  const [value, setValue] = useState(shown)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [applying, setApplying] = useState(false)
  // Costul schimbat din afară (în masă, pe toate variantele) intră în câmp
  const [seen, setSeen] = useState(shown)
  if (seen !== shown) { setSeen(shown); setValue(shown) }

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
    <div className="w-[132px]">
      <div className="relative">
        <Input value={value} inputMode="decimal" aria-label={t('catalog.cost')} placeholder="—" aria-invalid={state === 'error'} suffix={offer.currency}
          className={cn('h-8 text-right tabular-nums', state === 'saved' && 'border-emerald-400')}
          onChange={e => { setValue(e.target.value); if (state === 'error') setState('idle') }}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setValue(shown); setState('idle') } }} />
        {state === 'saving' && <Loader2 className="absolute -right-5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-neutral-400" />}
        {state === 'saved' && <Check className="absolute -right-5 top-1/2 size-3.5 -translate-y-1/2 text-emerald-600" />}
      </div>
      {state === 'error' && <p className="mt-1 text-[11px] text-red-600">{t('catalog.cost_invalid')}</p>}
      {state !== 'error' && offer.cost_price !== null && offer.cost_source === 'estimate' && (
        <p className="mt-1 text-[11px] font-medium text-amber-600" title={t('catalog.cost_estimated_hint')}>{t('catalog.cost_estimated')}</p>
      )}
      {state !== 'error' && offer.cost_price !== null && (offer.cost_source === 'woocommerce' || offer.cost_source === 'shopify') && (
        <p className="mt-1 text-[11px] text-neutral-400" title={platform.hint}>{t('catalog.cost_from_platform', { platform: platform.name })}</p>
      )}
      {state !== 'error' && siblings > 0 && offer.cost_price !== null && (
        <button onClick={applyToVariants} disabled={applying} title={t('catalog.apply_variants_hint', { cost: f.money2.format(offer.cost_price) })}
          className={cn(linkStyles, 'mt-1 text-left text-[11px] font-normal text-neutral-500 disabled:opacity-50')}>
          {applying ? t('catalog.applying') : t('catalog.apply_variants', { count: siblings + 1 })}
        </button>
      )}
    </div>
  )
}

type Scope = 'all' | `c:${string}` | `b:${string}`

/** Valorile unui câmp, cu câte oferte are fiecare, cele mai dese întâi. */
function countBy(offers: Offer[], pick: (o: Offer) => string | null): [string, number][] {
  const m = new Map<string, number>()
  for (const o of offers) { const v = pick(o); if (v) m.set(v, (m.get(v) ?? 0) + 1) }
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

/**
 * Costul ca procent din preț, în masă: pe tot catalogul, pe o categorie sau pe
 * o marcă. Implicit doar unde costul lipsește; costurile completate așa sunt
 * „estimate" și omul le poate corecta una câte una.
 */
function BulkCostPanel({ offers, f, onClose, onApplied }: {
  offers: Offer[]
  f: Formats
  onClose: () => void
  onApplied: (count: number) => void
}) {
  const { t } = useT()
  const [percent, setPercent] = useState('60')
  const [scope, setScope] = useState<Scope>('all')
  const [onlyMissing, setOnlyMissing] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categories = useMemo(() => countBy(offers, o => o.category), [offers])
  const brands = useMemo(() => countBy(offers, o => o.brand), [offers])
  const pct = Number(percent.trim().replace(',', '.'))
  const valid = Number.isFinite(pct) && pct >= 1 && pct <= 99
  const inScope = (o: Offer) => scope === 'all' || (scope.startsWith('c:') ? o.category === scope.slice(2) : o.brand === scope.slice(2))
  // Ca în funcția din baza de date: fără preț nu are din ce să se calculeze
  const matches = offers.filter(o => o.price > 0 && inScope(o) && (!onlyMissing || o.cost_price === null))
  const overwrites = onlyMissing ? 0 : matches.filter(o => o.cost_source === 'manual').length
  const example = matches[0]

  async function apply() {
    if (!valid || !matches.length) return
    setSaving(true); setError(null)
    try {
      const r = await fetch('/api/catalog/cost/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          percent: pct, only_missing: onlyMissing,
          category: scope.startsWith('c:') ? scope.slice(2) : undefined,
          brand: scope.startsWith('b:') ? scope.slice(2) : undefined,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error)
      onApplied(Number(d.updated) || 0)
    } catch (e) {
      setError((e as Error).message || t('catalog.bulk_error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader icon={<Percent />} title={t('catalog.bulk_title')} description={t('catalog.bulk_hint')}
        action={<Button size="icon" variant="ghost" onClick={onClose} aria-label={t('catalog.bulk_cancel')}><X /></Button>} />
      <div className="space-y-4 px-5 pb-5 pt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
          <label className="block">
            <span className="text-[12px] font-medium text-neutral-600">{t('catalog.bulk_percent_label')}</span>
            <Input value={percent} onChange={e => setPercent(e.target.value)} inputMode="decimal" aria-invalid={!valid} suffix={t('catalog.bulk_percent_suffix')}
              wrapperClassName="mt-1.5" className="pr-20 text-right font-medium tabular-nums" />
          </label>
          <label className="block min-w-0">
            <span className="text-[12px] font-medium text-neutral-600">{t('catalog.bulk_scope_label')}</span>
            <Select value={scope} onChange={e => setScope(e.target.value as Scope)} wrapperClassName="mt-1.5">
              <option value="all">{t('catalog.bulk_scope_all', { count: f.int.format(offers.length) })}</option>
              {categories.length > 0 && (
                <optgroup label={t('catalog.bulk_scope_categories')}>
                  {categories.map(([name, n]) => <option key={`c:${name}`} value={`c:${name}`}>{name} ({f.int.format(n)})</option>)}
                </optgroup>
              )}
              {brands.length > 0 && (
                <optgroup label={t('catalog.bulk_scope_brands')}>
                  {brands.map(([name, n]) => <option key={`b:${name}`} value={`b:${name}`}>{name} ({f.int.format(n)})</option>)}
                </optgroup>
              )}
            </Select>
          </label>
        </div>

        <Checkbox checked={onlyMissing} onChange={setOnlyMissing}>{t('catalog.bulk_only_missing')}</Checkbox>

        <div className="rounded-lg bg-neutral-50 px-4 py-3 text-[13px] leading-relaxed text-neutral-600 ring-1 ring-inset ring-neutral-200/60">
          {!valid ? <span className="text-red-600">{t('catalog.bulk_invalid')}</span>
            : !matches.length ? t('catalog.bulk_nothing')
            : (
              <>
                <span className="font-medium text-neutral-900">{t('catalog.bulk_preview', { count: f.int.format(matches.length) })}</span>
                {example && <> {t('catalog.bulk_example', { product: example.product_name || example.title, price: f.money2.format(example.price), cost: f.money2.format(Math.round(example.price * pct) / 100) })}</>}
                {overwrites > 0 && <span className="mt-1 block text-amber-700">{t('catalog.bulk_overwrite_warning', { count: f.int.format(overwrites) })}</span>}
              </>
            )}
        </div>

        {error && <Callout tone="danger">{error}</Callout>}

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" loading={saving} disabled={!valid || !matches.length} onClick={apply}>{t('catalog.bulk_apply')}</Button>
          <Button onClick={onClose}>{t('catalog.bulk_cancel')}</Button>
        </div>
      </div>
    </Card>
  )
}

function ProductsView() {
  const { t, intlLocale } = useT()
  // Căutarea din antet trimite aici cu ?search=; pașii și recomandările cu ?view= (ex. no_cost)
  const params = useSearchParams()
  const urlSearch = params.get('search')
  const urlView = params.get('view')
  const viewOf = (v: string | null): Quick | null => (v && QUICKS.includes(v as Quick) ? (v as Quick) : null)

  const [days, setDays] = useState<Period>(30)
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [hasData, setHasData] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearchState] = useState(urlSearch ?? '')
  const [quick, setQuickState] = useState<Quick>(viewOf(urlView) ?? 'all')
  const [sort, setSortState] = useState<Sort>('sales')
  const [page, setPage] = useState(1)
  const [syncing, setSyncing] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  // Filtrele schimbă lista: se pornește de la prima pagină
  const setSearch = (v: string) => { setSearchState(v); setPage(1) }
  const setQuick = (v: Quick) => { setQuickState(v); setPage(1) }
  const setSort = (v: Sort) => { setSortState(v); setPage(1) }

  // O nouă căutare din antet (sau un link cu ?view=) cât timp pagina e deschisă
  const [seenUrl, setSeenUrl] = useState(`${urlSearch}|${urlView}`)
  if (seenUrl !== `${urlSearch}|${urlView}`) {
    setSeenUrl(`${urlSearch}|${urlView}`)
    if (urlSearch !== null) { setSearchState(urlSearch); setQuickState('all'); setPage(1) }
    const view = viewOf(urlView)
    if (view) { setQuickState(view); setPage(1) }
  }

  const load = useCallback(async (period: Period) => {
    setLoadError(false)
    try {
      const r = await fetch(`/api/catalog?days=${period}`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      setStore(d.store)
      setOffers(d.offers || [])
      setHasData(true)
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

  const f = useFormats(store?.currency || offers[0]?.currency || 'RON')

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
      return [o.title, o.product_name, o.variant_title, o.sku, o.gtin, o.brand, o.category, o.offer_id]
        .some(v => v && v.toLowerCase().includes(q))
    })
    const byName = (a: Offer, b: Offer) => (a.title || '').localeCompare(b.title || '', intlLocale)
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
  }, [offers, quick, search, sort, intlLocale])

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const current = Math.min(page, pages)
  const visible = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE)

  // Costul scris de om e „manual": nici estimările în masă, nici platforma nu-l mai schimbă
  const onSaved = useCallback((ids: string[], cost: number | null) => {
    const set = new Set(ids)
    setOffers(list => list.map(o => (set.has(o.offer_id) ? { ...o, cost_price: cost, cost_source: cost === null ? null : 'manual' } : o)))
  }, [])

  async function onBulkApplied(count: number) {
    setBulkOpen(false)
    setNotice({ ok: true, text: t('catalog.bulk_done', { count: f.int.format(count) }) })
    await load(days)
  }

  async function handleSync() {
    if (!store) return
    setSyncing(true); setNotice(null)
    try {
      const r = await fetch(`/api/stores/${store.id}/sync`, { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) setNotice({ ok: false, text: d.error || t('catalog.sync_error') })
      // Un magazin mare nu încape într-o rulare: restul vine la sincronizările următoare
      else setNotice({ ok: true, text: t(d.complete === false ? 'catalog.sync_partial' : 'edinio.sync_done', { offers: t('common.offers_count', { count: Number(d.synced ?? 0) }), orders: t('common.orders_count', { count: Number(d.orders ?? 0) }) }) })
      await load(days)
    } catch {
      setNotice({ ok: false, text: t('catalog.sync_error') })
    } finally {
      setSyncing(false)
    }
  }

  const description = store?.supported && offers.length > 0
    ? `${t('catalog.subtitle', { count: offers.length, store: store.store_name || '' })}${store.last_sync_at ? ` · ${t('catalog.synced_at', { time: f.dateTime.format(new Date(store.last_sync_at)) })}` : ''}`
    : t('catalog.subtitle_empty')
  const header = (
    <PageHeader title={t('catalog.title')} description={description}
      actions={store?.supported && (
        <>
          <Segmented id="catalog-period" value={String(days)} onChange={v => setDays(Number(v) as Period)}
            items={PERIODS.map(p => ({ value: String(p), label: t(`catalog.period_short_${p}`) }))} />
          <Button onClick={handleSync} disabled={syncing || store.connection_status === 'revoked'}>
            <RefreshCw className={cn(syncing && 'animate-spin')} />{t('settings.sync_now')}
          </Button>
        </>
      )} />
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2"><Skeleton className="h-8 w-40" /><Skeleton className="h-4 w-80 max-w-full" /></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[92px] rounded-xl" />)}</div>
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
    )
  }

  if (loadError && !hasData) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <EmptyState icon={<AlertCircle />} title={t('catalog.load_error')} description={t('campaigns.load_error_hint')}
            action={<Button variant="primary" onClick={() => load(days)}>{t('catalog.retry')}</Button>} />
        </Card>
      </div>
    )
  }

  if (!store || !store.supported) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <EmptyState icon={<Store />}
            title={store ? t('catalog.unsupported_title') : t('catalog.no_store_title')}
            description={store ? t('catalog.unsupported_desc') : t('catalog.no_store_desc')}
            action={!store && <Button asChild variant="primary"><Link href="/settings?tab=integrations">{t('catalog.connect_store')}</Link></Button>} />
        </Card>
      </div>
    )
  }

  const vatHint = store.prices_include_vat === true ? t('catalog.cost_hint_vat')
    : store.prices_include_vat === false ? t('catalog.cost_hint_no_vat') : t('catalog.cost_hint_unknown')
  // Costul preluat din magazin e contabil (fără TVA): îl aducem pe baza prețului, ca la sincronizare
  const platformCost = {
    name: store.platform_name,
    hint: t(store.prices_include_vat === false ? 'catalog.cost_from_platform_hint' : 'catalog.cost_from_platform_hint_vat', { platform: store.platform_name }),
  }
  const tiles: { key: Quick; value: number; label: string; tone?: 'amber' | 'red' }[] = [
    { key: 'all', value: counts.all, label: t('catalog.stat_all') },
    { key: 'out', value: counts.out, label: t('catalog.stat_out'), tone: counts.out ? 'amber' : undefined },
    { key: 'no_cost', value: counts.no_cost, label: t('catalog.stat_no_cost'), tone: counts.no_cost ? 'amber' : undefined },
    ...(store.google_status_known ? [{ key: 'google_issue' as Quick, value: counts.google_issue, label: t('catalog.stat_google_issue'), tone: counts.google_issue ? 'red' as const : undefined }] : []),
  ]

  return (
    <div className="space-y-6">
      {header}

      {(store.connection_status === 'revoked' || store.connection_status === 'error') && (
        <Callout tone="warning"
          action={store.connection_status === 'revoked' && <Button asChild size="sm"><Link href="/settings?tab=integrations">{t('catalog.reconnect')}</Link></Button>}>
          {store.connection_status === 'revoked' ? t('catalog.revoked', { platform: store.platform_name }) : t('catalog.store_error', { platform: store.platform_name })}
          {store.connection_status === 'error' && store.last_error && <span className="block opacity-80">{translateStored(t, store.last_error)}</span>}
        </Callout>
      )}

      {notice && <Callout tone={notice.ok ? 'success' : 'warning'} onClose={() => setNotice(null)}>{notice.text}</Callout>}

      {offers.length === 0 ? (
        <Card>
          <EmptyState icon={firstSyncRunning ? <Loader2 className="animate-spin" /> : <Package />}
            title={firstSyncRunning ? t('catalog.first_sync_title') : t('catalog.empty_title')}
            description={firstSyncRunning ? t('catalog.first_sync_desc') : t('catalog.empty_desc')} />
        </Card>
      ) : (
        <>
          {/* Cifrele de sus sunt și filtre */}
          <FadeIn>
            <div className={cn('grid grid-cols-2 gap-3', tiles.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
              {tiles.map(s => {
                const active = quick === s.key
                return (
                  <button key={s.key} onClick={() => setQuick(active && s.key !== 'all' ? 'all' : s.key)} aria-pressed={active}
                    className={cn('group rounded-xl border bg-white p-4 text-left shadow-card transition-[border-color,box-shadow]',
                      active ? 'border-neutral-900 ring-1 ring-neutral-900' : 'border-neutral-200/80 hover:border-neutral-300 hover:shadow-raised')}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-neutral-500">{s.label}</span>
                      {s.tone && <span className={cn('size-2 rounded-full', s.tone === 'red' ? 'bg-red-500' : 'bg-amber-500')} />}
                    </span>
                    <span className="mt-1.5 block text-[24px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-neutral-950">{f.int.format(s.value)}</span>
                  </button>
                )
              })}
            </div>
          </FadeIn>

          {counts.no_cost > 0 && !bulkOpen && (
            <Callout tone="info" action={<Button size="sm" onClick={() => setBulkOpen(true)}><Percent />{t('catalog.bulk_open')}</Button>}>
              {t('catalog.cost_explainer')} {vatHint}
              {COST_PLATFORMS.includes(store.platform) && <> {t(`catalog.cost_cogs_hint_${store.platform}`)}</>}
            </Callout>
          )}

          {bulkOpen && (
            <FadeIn><BulkCostPanel offers={offers} f={f} onClose={() => setBulkOpen(false)} onApplied={onBulkApplied} /></FadeIn>
          )}

          <FadeIn delay={0.04}>
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Input icon={<Search />} value={search} onChange={e => setSearch(e.target.value)} placeholder={t('catalog.search_placeholder')} className="pr-8" />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-400 hover:text-neutral-600" aria-label={t('common.close')}>
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                <Select value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label={t('catalog.sort_label')} wrapperClassName="sm:w-52">
                  {SORTS.map(s => <option key={s} value={s}>{t(`catalog.sort_${s}`)}</option>)}
                </Select>
                <Button variant={bulkOpen ? 'dark' : 'secondary'} onClick={() => setBulkOpen(o => !o)} aria-pressed={bulkOpen}>
                  <Percent />{t('catalog.bulk_button')}
                </Button>
              </div>

              {filtered.length === 0 ? (
                <p className="border-t border-neutral-100 py-14 text-center text-[13px] text-neutral-400">{t('catalog.no_results')}</p>
              ) : (
                <Table className="min-w-[960px]">
                  <thead>
                    <tr>
                      <Th>{t('catalog.col_product')}</Th>
                      <Th align="right">{t('catalog.col_price')}</Th>
                      <Th>{t('catalog.col_stock')}</Th>
                      {store.google_status_known && <Th>{t('catalog.col_google')}</Th>}
                      <Th align="right">{t('catalog.col_sales', { period: t(`catalog.period_short_${days}`) })}</Th>
                      <Th>{t('catalog.col_cost')}</Th>
                      <Th align="right">{t('catalog.col_margin')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(o => {
                      const m = marginOf(o)
                      const onSale = o.compare_at_price !== null && o.compare_at_price > o.price
                      return (
                        <Tr key={o.offer_id} className="[&>td]:align-top">
                          <Td>
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-50 ring-1 ring-inset ring-neutral-200/70">
                                {o.image_url
                                  // eslint-disable-next-line @next/next/no-img-element
                                  ? <img src={o.image_url} alt="" loading="lazy" className="size-full object-cover" />
                                  : <ImageIcon className="size-4 text-neutral-300" />}
                              </div>
                              <div className="min-w-0">
                                <p className="line-clamp-2 font-medium leading-snug text-neutral-900">{o.product_name || o.title}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-neutral-500">
                                  {o.variant_title && <Badge>{o.variant_title}</Badge>}
                                  {o.sku && <span>SKU {o.sku}</span>}
                                  {o.url && (
                                    <a href={o.url} target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 hover:text-neutral-900">
                                      {t('catalog.view')}<ExternalLink className="size-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Td>
                          <Td align="right" className="whitespace-nowrap">
                            <p className="font-semibold text-neutral-900">{f.money2.format(o.price)}</p>
                            {onSale && <p className="text-[12px] text-neutral-400 line-through">{f.money2.format(o.compare_at_price!)}</p>}
                          </Td>
                          <Td className="whitespace-nowrap">
                            {!o.available ? <Badge tone="red">{t('catalog.stock_out')}</Badge>
                              : o.stock === null ? <span className="text-neutral-500">{t('catalog.stock_untracked')}</span>
                              : <span className={cn('tabular-nums', o.stock <= 3 ? 'font-medium text-amber-600' : 'text-neutral-700')}>{t('catalog.stock_units', { count: o.stock })}</span>}
                          </Td>
                          {store.google_status_known && (
                            <Td className="whitespace-nowrap">
                              {o.google_status
                                ? <Badge tone={GOOGLE_TONE[o.google_status] ?? 'neutral'} dot>{t(`catalog.google_${GOOGLE_TONE[o.google_status] ? o.google_status : 'other'}`)}</Badge>
                                : <span className="text-neutral-400" title={t('catalog.google_none_hint')}>{t('catalog.google_none')}</span>}
                            </Td>
                          )}
                          <Td align="right" className="whitespace-nowrap">
                            {o.sales.units > 0 ? (
                              <>
                                <p className="font-medium text-neutral-900">{t('catalog.units', { count: Number(o.sales.units) })}</p>
                                <p className="text-[12px] text-neutral-400">{f.money.format(o.sales.revenue)}</p>
                              </>
                            ) : <span className="text-neutral-300">—</span>}
                          </Td>
                          <Td>
                            <CostInput offer={o} f={f} platform={platformCost} onSaved={onSaved}
                              siblings={o.item_group_id ? Math.max(0, (siblingsByProduct.get(o.external_product_id) ?? 1) - 1) : 0} />
                          </Td>
                          <Td align="right" className="whitespace-nowrap">
                            {m ? (
                              <>
                                <p className={cn('font-semibold', m.amount < 0 ? 'text-red-600' : m.pct < 20 ? 'text-amber-600' : 'text-emerald-600')}>{Math.round(m.pct)}%</p>
                                <p className="text-[12px] text-neutral-400">{f.money2.format(m.amount)}</p>
                              </>
                            ) : <span className="text-neutral-300">—</span>}
                          </Td>
                        </Tr>
                      )
                    })}
                  </tbody>
                </Table>
              )}

              {pages > 1 && (
                <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-5 py-3 text-[12px] text-neutral-500">
                  <span className="tabular-nums">{t('catalog.page_of', { from: f.int.format((current - 1) * PER_PAGE + 1), to: f.int.format(Math.min(current * PER_PAGE, filtered.length)), total: f.int.format(filtered.length) })}</span>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={current === 1} aria-label={t('catalog.prev')}><ChevronLeft /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={current === pages} aria-label={t('catalog.next')}><ChevronRight /></Button>
                  </div>
                </div>
              )}
            </Card>
          </FadeIn>
        </>
      )}
    </div>
  )
}

// useSearchParams cere o graniță Suspense la randarea statică
export default function ProductsPage() {
  return <Suspense fallback={null}><ProductsView /></Suspense>
}
