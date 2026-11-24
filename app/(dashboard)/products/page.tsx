'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, ChevronLeft, ChevronRight, ExternalLink, ImageIcon, Loader2, Package, RefreshCw, Search, Store, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/app/page-header'
import { Card } from '@/components/app/surface'
import { Badge, type Tone } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { Input, Select } from '@/components/app/input'
import { Segmented } from '@/components/app/tabs'
import { Table, Td, Th, Tr } from '@/components/app/table'
import { Callout, EmptyState, Skeleton } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { useFormats } from '@/components/app/formats'

// =============================================
// Produse — ofertele magazinului, cum ajung la Google, cu stocul și
// vânzările de pe site. Din ele se fac campaniile. Cifrele de sus sunt și
// filtre.
// =============================================

type Sales = { units: number; revenue: number; orders: number }
type Offer = {
  offer_id: string; external_product_id: string; item_group_id: string | null
  title: string; product_name: string | null; variant_title: string | null; category: string | null
  url: string | null; image_url: string | null
  price: number; compare_at_price: number | null; currency: string
  available: boolean; stock: number | null; sku: string | null; gtin: string | null; brand: string | null
  google_status: string | null; sales: Sales
}
type StoreInfo = {
  id: string; platform: string; platform_name: string; store_name: string | null; currency: string
  connection_status: string | null; sync_status: string | null; last_sync_at: string | null; last_error: string | null
  supported: boolean
  /** Edinio știe ce face Google cu ofertele; la WooCommerce aflăm după legarea contului Google */
  google_status_known: boolean
}
type Period = 30 | 90 | 365
/** Ce trimite GET /api/catalog: o pagină din oferte, câte sunt cu filtrul ales și cifrele filtrelor rapide. */
type CatalogData = {
  store: StoreInfo | null; offers: Offer[]; total: number
  counts: { all: number; out: number; google_issue: number }; page: number; per_page: number; days: number
}
type Quick = 'all' | 'out' | 'google_issue'
type Sort = 'sales' | 'revenue' | 'price' | 'name'

const PER_PAGE = 50
const PERIODS: Period[] = [30, 90, 365]
const SORTS: Sort[] = ['sales', 'revenue', 'price', 'name']
const QUICKS: Quick[] = ['all', 'out', 'google_issue']
const GOOGLE_TONE: Record<string, Tone> = {
  active: 'green', pending: 'amber', expirat: 'amber', disapproved: 'red', error: 'red', exclus: 'neutral',
}
/** Filtrul rapid cerut în adresă (?view=), dacă e unul cunoscut. */
const viewOf = (v: string | null): Quick | null => (v && QUICKS.includes(v as Quick) ? (v as Quick) : null)

function ProductsView() {
  const { t } = useT()
  // Căutarea din antet trimite aici cu ?search=; recomandările cu ?view= (ex. google_issue)
  const params = useSearchParams()
  const urlSearch = params.get('search')
  const urlView = params.get('view')

  const [days, setDays] = useState<Period>(30)
  const [search, setSearchState] = useState(urlSearch ?? '')
  // Căutarea pleacă spre server după o scurtă pauză în scris, nu la fiecare literă
  const [q, setQ] = useState((urlSearch ?? '').trim())
  const [quick, setQuickState] = useState<Quick>(() => viewOf(urlView) ?? 'all')
  const [sort, setSortState] = useState<Sort>('sales')
  const [page, setPage] = useState(1)
  // Crește ca pagina să se recitească (după sincronizare, la reîncercare, cât rulează prima sincronizare)
  const [tick, setTick] = useState(0)
  const [result, setResult] = useState<{ url: string; data: CatalogData } | null>(null)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  // Filtrele schimbă lista: se pornește de la prima pagină
  const setSearch = (v: string) => { setSearchState(v); setPage(1) }
  const setQuick = (v: Quick) => { setQuickState(v); setPage(1) }
  const setSort = (v: Sort) => { setSortState(v); setPage(1) }

  // O nouă căutare din antet (sau un link cu ?view=) cât timp pagina e deschisă
  const [seenUrl, setSeenUrl] = useState(`${urlSearch}|${urlView}`)
  if (seenUrl !== `${urlSearch}|${urlView}`) {
    setSeenUrl(`${urlSearch}|${urlView}`)
    if (urlSearch !== null) { setSearchState(urlSearch); setQ(urlSearch.trim()); setQuickState('all'); setPage(1) }
    const view = viewOf(urlView)
    if (view) { setQuickState(view); setPage(1) }
  }

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  // O pagină din catalog, filtrată și ordonată în baza de date: un magazin mare nu mai vine întreg
  const url = `/api/catalog?${new URLSearchParams({ days: String(days), quick, sort, page: String(page), ...(q ? { q } : {}) })}`
  const requestKey = `${url}#${tick}`
  useEffect(() => {
    let alive = true
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<CatalogData> })
      .then(d => { if (alive) { setResult({ url: requestKey, data: d }); setFailedUrl(null) } })
      .catch(() => { if (alive) setFailedUrl(requestKey) })
    return () => { alive = false }
  }, [url, requestKey])

  const data = result?.data ?? null
  const store = data?.store ?? null
  const offers = data?.offers ?? []
  const counts = data?.counts ?? { all: 0, out: 0, google_issue: 0 }
  const total = data?.total ?? 0
  // Prima încărcare: schelet; după aceea, lista veche rămâne (estompată) până vine cea nouă
  const loading = !result && failedUrl !== requestKey
  const pending = !!result && result.url !== requestKey && failedUrl !== requestKey
  const loadError = failedUrl === requestKey

  // Prima sincronizare după conectare: pagina o urmărește până apar ofertele
  const firstSyncRunning = !!store?.supported && counts.all === 0
    && (store.sync_status === 'syncing' || (!store.last_sync_at && store.connection_status === 'active'))
  useEffect(() => {
    if (!firstSyncRunning) return
    const id = setInterval(() => setTick(n => n + 1), 5000)
    return () => clearInterval(id)
  }, [firstSyncRunning])

  const f = useFormats(store?.currency || offers[0]?.currency || 'RON')

  const pages = Math.max(1, Math.ceil(total / PER_PAGE))
  const current = Math.min(page, pages)
  const visible = offers

  async function handleSync() {
    if (!store) return
    setSyncing(true); setNotice(null)
    try {
      const r = await fetch(`/api/stores/${store.id}/sync`, { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) setNotice({ ok: false, text: d.error || t('catalog.sync_error') })
      // Un magazin mare nu încape într-o rulare: restul vine la sincronizările următoare
      else setNotice({ ok: true, text: t(d.complete === false ? 'catalog.sync_partial' : 'edinio.sync_done', { offers: t('common.offers_count', { count: Number(d.synced ?? 0) }), orders: t('common.orders_count', { count: Number(d.orders ?? 0) }) }) })
      setTick(n => n + 1)
    } catch {
      setNotice({ ok: false, text: t('catalog.sync_error') })
    } finally {
      setSyncing(false)
    }
  }

  const description = store?.supported && counts.all > 0
    ? `${t('catalog.subtitle', { count: counts.all, store: store.store_name || '' })}${store.last_sync_at ? ` · ${t('catalog.synced_at', { time: f.dateTime.format(new Date(store.last_sync_at)) })}` : ''}`
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

  if (loadError && !data) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <EmptyState icon={<AlertCircle />} title={t('catalog.load_error')} description={t('campaigns.load_error_hint')}
            action={<Button variant="primary" onClick={() => setTick(n => n + 1)}>{t('catalog.retry')}</Button>} />
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

  const tiles: { key: Quick; value: number; label: string; tone?: 'amber' | 'red' }[] = [
    { key: 'all', value: counts.all, label: t('catalog.stat_all') },
    { key: 'out', value: counts.out, label: t('catalog.stat_out'), tone: counts.out ? 'amber' : undefined },
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

      {counts.all === 0 ? (
        <Card>
          <EmptyState icon={firstSyncRunning ? <Loader2 className="animate-spin" /> : <Package />}
            title={firstSyncRunning ? t('catalog.first_sync_title') : t('catalog.empty_title')}
            description={firstSyncRunning ? t('catalog.first_sync_desc') : t('catalog.empty_desc')} />
        </Card>
      ) : (
        <>
          {/* Cifrele de sus sunt și filtre */}
          <FadeIn>
            <div className={cn('grid grid-cols-2 gap-3', tiles.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2')}>
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
              </div>

              {total === 0 ? (
                <p className="border-t border-neutral-100 py-14 text-center text-[13px] text-neutral-400">{t('catalog.no_results')}</p>
              ) : (
                <Table className={cn('min-w-[760px] transition-opacity', pending && 'opacity-60')}>
                  <thead>
                    <tr>
                      <Th>{t('catalog.col_product')}</Th>
                      <Th align="right">{t('catalog.col_price')}</Th>
                      <Th>{t('catalog.col_stock')}</Th>
                      {store.google_status_known && <Th>{t('catalog.col_google')}</Th>}
                      <Th align="right">{t('catalog.col_sales', { period: t(`catalog.period_short_${days}`) })}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(o => {
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
                        </Tr>
                      )
                    })}
                  </tbody>
                </Table>
              )}

              {pages > 1 && (
                <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-5 py-3 text-[12px] text-neutral-500">
                  <span className="tabular-nums">{t('catalog.page_of', { from: f.int.format((current - 1) * PER_PAGE + 1), to: f.int.format(Math.min(current * PER_PAGE, total)), total: f.int.format(total) })}</span>
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
