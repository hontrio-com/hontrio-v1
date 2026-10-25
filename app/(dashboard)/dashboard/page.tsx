'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import {
  AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Circle, ExternalLink, ImageIcon,
  Megaphone, Receipt, RefreshCw, ShoppingBag, Store, Wallet,
} from 'lucide-react'

// =============================================
// Prezentarea generală — cât de pregătit e contul pentru campanii și ce
// vinde magazinul pe site (comparat cu perioada dinainte).
// =============================================

type Totals = { revenue: number; orders: number; google_ads_orders: number; google_ads_revenue: number }
type Overview = {
  current: Totals; previous: Totals
  daily: { day: string; revenue: number; orders: number }[]
  sources: { source: string; orders: number; revenue: number }[]
}
type StoreInfo = {
  id: string; platform: string; platform_name: string; store_name: string | null; store_url: string; currency: string; timezone: string
  connection_status: string | null; sync_status: string | null; last_sync_at: string | null; last_error: string | null
  offers_count: number; orders_count: number; supported: boolean
}
type TopProduct = {
  offer_id: string; title: string; variant_title: string | null; image_url: string | null
  price: number | null; cost_price: number | null; units: number; revenue: number
}
type Data = {
  days: number
  store: StoreInfo | null
  google: { connected: boolean; status: string | null; account: { id: string; name: string | null; currency: string | null } | null }
  /** `unverified`: un plugin pe care Hontrio nu-l poate întreba (se verifică la lansare); `variant`: platforma. */
  checklist: { id: string; done: boolean; href: string; external: boolean; unverified?: boolean; variant?: string | null; via?: string | null }[]
  costs: { with_cost: number; total: number; coverage: number; basis: 'sales' | 'catalog' | null; ready: boolean }
  /** Cifrele din Google Ads ale perioadei (null = nicio cheltuială încă), cu profitul estimat după prag. */
  ads: { cost: number; value: number; conversions: number; roas: number | null; break_even: number | null; profit: number | null } | null
  overview: Overview | null
  top_products: TopProduct[]
}
type Period = 7 | 30 | 90 | 365

const PERIODS: Period[] = [7, 30, 90, 365]
const SOURCE_ORDER = ['google_ads', 'google_organic', 'meta', 'email', 'other_campaigns', 'referral', 'direct']

function change(cur: number, prev: number): number | 'new' | null {
  if (prev === 0) return cur > 0 ? 'new' : null
  return ((cur - prev) / prev) * 100
}

/** Ziua de azi în fusul magazinului, ca `AAAA-LL-ZZ`. */
function todayIn(tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/**
 * Seria pe zile cu zilele fără vânzări puse pe 0. Peste 90 de zile, pe
 * săptămâni: 365 de bare nu mai spun nimic.
 */
function buildSeries(daily: Overview['daily'], days: number, tz: string) {
  const byDay = new Map(daily.map(d => [d.day, d]))
  const [y, m, d] = todayIn(tz).split('-').map(Number)
  const out: { day: string; revenue: number; orders: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10)
    const v = byDay.get(key)
    out.push({ day: key, revenue: v ? Number(v.revenue) : 0, orders: v ? Number(v.orders) : 0 })
  }
  if (days <= 90) return out
  const weeks: typeof out = []
  for (let i = out.length; i > 0; i -= 7) {
    const chunk = out.slice(Math.max(0, i - 7), i)
    weeks.unshift({ day: chunk[0].day, revenue: chunk.reduce((s, x) => s + x.revenue, 0), orders: chunk.reduce((s, x) => s + x.orders, 0) })
  }
  return weeks
}

function Delta({ value }: { value: number | 'new' | null }) {
  const { t } = useT()
  if (value === null) return null
  if (value === 'new') return <span className="text-[11px] font-medium text-emerald-600">{t('overview.new')}</span>
  const up = value >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      <Icon className="h-3 w-3" />{Math.abs(Math.round(value))}%
    </span>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-neutral-100 rounded-xl ${className || ''}`} />
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const { t, intlLocale: numberLocale } = useT()
  const [days, setDays] = useState<Period>(30)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async (period: Period) => {
    setFailed(false)
    try {
      const r = await fetch(`/api/overview?days=${period}`)
      if (!r.ok) throw new Error()
      setData(await r.json())
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(days) }, [days, load])

  const currency = data?.store?.currency || 'RON'
  const fmt = useMemo(() => {
    try { return new Intl.NumberFormat(numberLocale, { style: 'currency', currency, maximumFractionDigits: 0 }) }
    catch { return new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 }) }
  }, [numberLocale, currency])
  const fmtInt = useMemo(() => new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 }), [numberLocale])
  const fmtDay = useCallback((iso: string, withYear = false) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(numberLocale, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' }), [numberLocale])

  const series = useMemo(
    () => (data?.overview ? buildSeries(data.overview.daily, data.days, data.store?.timezone || 'Europe/Bucharest') : []),
    [data],
  )
  const maxRevenue = Math.max(0, ...series.map(s => s.revenue))

  const userName = session?.user?.name?.split(' ')[0] || ''
  const hour = new Date().getHours()
  const greeting = hour < 12 ? t('dashboard.good_morning') : hour < 18 ? t('dashboard.good_afternoon') : t('dashboard.good_evening')

  const header = (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">{greeting}{userName ? `, ${userName}` : ''}</h1>
        <p className="text-neutral-400 mt-0.5 text-[13px]">
          {data?.store?.supported ? t('overview.subtitle_store', { store: data.store.store_name || '' }) : t('overview.subtitle')}
        </p>
      </div>
      {data?.store?.supported && (
        <select value={days} onChange={e => setDays(Number(e.target.value) as Period)} aria-label={t('overview.period')}
          className="h-9 px-3 rounded-xl border border-neutral-200 bg-white text-[12px] font-medium text-neutral-600 focus:outline-none focus:border-neutral-400 self-start sm:self-auto">
          {PERIODS.map(p => <option key={p} value={p}>{t(`overview.period_${p}`)}</option>)}
        </select>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}</div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5"><Skeleton className="lg:col-span-2 h-72" /><Skeleton className="h-72" /></div>
      </div>
    )
  }

  if (failed && !data) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white py-16 text-center">
          <AlertCircle className="h-6 w-6 text-neutral-400" />
          <p className="mt-3 text-[14px] font-medium text-neutral-900">{t('overview.load_error')}</p>
          <button onClick={() => load(days)} className="mt-4 h-9 px-4 rounded-xl bg-neutral-900 text-white text-[13px] font-medium hover:bg-neutral-800">
            {t('catalog.retry')}
          </button>
        </div>
      </div>
    )
  }

  const done = data?.checklist.filter(c => c.done).length ?? 0
  const totalSteps = data?.checklist.length ?? 0
  const ready = totalSteps > 0 && done === totalSteps
  const cur = data?.overview?.current
  const prev = data?.overview?.previous
  const aov = cur && cur.orders ? cur.revenue / cur.orders : 0
  const prevAov = prev && prev.orders ? prev.revenue / prev.orders : 0
  const adsShare = cur && cur.revenue ? Math.round((cur.google_ads_revenue / cur.revenue) * 100) : 0
  const sources = [...(data?.overview?.sources ?? [])].sort((a, b) => SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source))
  const sourceTotal = sources.reduce((s, x) => s + Number(x.revenue), 0)

  const checklistCard = data && !ready && (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[15px] font-semibold text-neutral-900">{t('overview.checklist_title')}</p>
          <p className="text-[12px] text-neutral-400 mt-0.5">{t('overview.checklist_progress', { done: String(done), total: String(totalSteps) })}</p>
        </div>
        <div className="h-1.5 w-28 rounded-full bg-neutral-100 overflow-hidden">
          <div className="h-full rounded-full bg-neutral-900 transition-all" style={{ width: `${totalSteps ? (done / totalSteps) * 100 : 0}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {data.checklist.map(c => {
          // Costurile se măsoară ca în planul campaniei: pe vânzări, când există.
          // Textul pasului vine din date: fără platformă dacă varianta nu are text, altfel unul generic
          const step = `${c.id}${c.variant ? `_${c.variant}` : ''}`
          const label = c.id !== 'costs'
            ? (t.has(`overview.check_${step}`) ? t(`overview.check_${step}`) : t.has(`overview.check_${c.id}`) ? t(`overview.check_${c.id}`) : t('overview.check_generic'))
            : data.costs.basis === 'sales' ? t('overview.check_costs_sales', { pct: String(Math.round(data.costs.coverage * 100)) })
            : t('overview.check_costs', { with: fmtInt.format(data.costs.with_cost), count: data.costs.total })
          const inner = (
            <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all ${c.done ? 'border-neutral-100 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300 bg-white'}`}>
              {c.done ? <CheckCircle2 className={`h-4 w-4 shrink-0 ${c.unverified ? 'text-neutral-300' : 'text-emerald-500'}`} /> : <Circle className="h-4 w-4 text-neutral-300 shrink-0" />}
              <span className={`flex-1 text-[13px] ${c.done ? 'text-neutral-400' : 'text-neutral-800'}`}>
                {label}
                {c.unverified && <span className="block text-[11px]">{c.via ? t('overview.check_unverified_via', { via: c.via }) : t('overview.check_unverified')}</span>}
              </span>
              {!c.done && (c.external ? <ExternalLink className="h-3.5 w-3.5 text-neutral-300" /> : <ArrowRight className="h-3.5 w-3.5 text-neutral-300" />)}
            </div>
          )
          if (c.done) return <div key={c.id}>{inner}</div>
          return c.external
            ? <a key={c.id} href={c.href} target="_blank" rel="noopener">{inner}</a>
            : <Link key={c.id} href={c.href}>{inner}</Link>
        })}
      </div>
    </div>
  )

  if (!data?.store || !data.store.supported) {
    return (
      <div className="space-y-6">
        {header}
        {checklistCard}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white py-16 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100"><Store className="h-6 w-6 text-neutral-500" /></div>
          <p className="mt-4 text-[15px] font-semibold text-neutral-900">{data?.store ? t('catalog.unsupported_title') : t('overview.no_store_title')}</p>
          <p className="mt-1 max-w-md text-[13px] text-neutral-400 leading-relaxed">{data?.store ? t('catalog.unsupported_desc') : t('overview.no_store_desc')}</p>
          {!data?.store && (
            <Link href="/settings?tab=integrations" className="mt-5 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-neutral-900 text-white text-[13px] font-medium hover:bg-neutral-800">
              {t('catalog.connect_store')}
            </Link>
          )}
        </div>
      </div>
    )
  }

  const store = data.store
  // Cifrele din Google Ads ale perioadei (din cronul zilnic)
  const adsData = data?.ads ?? null
  const fmtRoas = new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 })

  const kpis = [
    { key: 'revenue', icon: Wallet, label: t('overview.kpi_revenue'), value: fmt.format(cur?.revenue ?? 0), delta: change(cur?.revenue ?? 0, prev?.revenue ?? 0), sub: null as string | null },
    { key: 'orders', icon: ShoppingBag, label: t('overview.kpi_orders'), value: fmtInt.format(cur?.orders ?? 0), delta: change(cur?.orders ?? 0, prev?.orders ?? 0), sub: null },
    { key: 'aov', icon: Receipt, label: t('overview.kpi_aov'), value: fmt.format(aov), delta: change(aov, prevAov), sub: null },
    {
      key: 'ads', icon: Megaphone, label: t('overview.kpi_google_ads'), value: fmt.format(cur?.google_ads_revenue ?? 0),
      delta: change(cur?.google_ads_revenue ?? 0, prev?.google_ads_revenue ?? 0),
      sub: t('overview.kpi_google_ads_sub', { orders: t('common.orders_count', { count: cur?.google_ads_orders ?? 0 }), share: String(adsShare) }),
    },
  ]

  return (
    <div className="space-y-6">
      {header}

      {(store.connection_status === 'revoked' || store.connection_status === 'error') && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-[12px] leading-relaxed bg-amber-50 border border-amber-100 text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 mt-px" />
          <span className="flex-1">
            {store.connection_status === 'revoked' ? t('catalog.revoked', { platform: store.platform_name }) : t('catalog.store_error', { platform: store.platform_name })}
            {store.connection_status === 'error' && store.last_error && <span className="block text-amber-700/70">{translateStored(t, store.last_error)}</span>}
          </span>
          {store.connection_status === 'revoked' && (
            <Link href="/settings?tab=integrations" className="font-medium underline underline-offset-2">{t('catalog.reconnect')}</Link>
          )}
        </div>
      )}

      {checklistCard}

      {/* Cifrele perioadei, cu schimbarea față de perioada dinainte */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.key} className="bg-white border border-neutral-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="h-8 w-8 rounded-lg bg-neutral-100 flex items-center justify-center"><k.icon className="h-4 w-4 text-neutral-500" /></div>
              <Delta value={k.delta} />
            </div>
            <p className="text-[20px] font-bold text-neutral-900 tabular-nums leading-tight">{k.value}</p>
            <p className="text-[12px] text-neutral-400 mt-0.5">{k.label}</p>
            {k.sub && <p className="text-[11px] text-neutral-400 mt-0.5">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Din Google Ads: ce au costat reclamele și ce au adus, față de pragul de profit */}
      {adsData && (
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-neutral-900">{t('overview.ads_title')}</p>
            <Link href="/reports" className="text-[12px] font-medium text-neutral-600 hover:text-neutral-900 underline underline-offset-2">{t('overview.ads_open_reports')}</Link>
          </div>
          <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: t('overview.ads_spend'), value: fmt.format(adsData.cost) },
              { label: t('overview.ads_value'), value: fmt.format(adsData.value) },
              {
                label: t('overview.ads_roas'), value: adsData.roas === null ? '—' : fmtRoas.format(adsData.roas),
                sub: adsData.break_even !== null ? t('overview.ads_roas_be', { roas: fmtRoas.format(adsData.break_even) }) : undefined,
                warn: adsData.roas !== null && adsData.break_even !== null && adsData.roas < adsData.break_even,
              },
              { label: t('overview.ads_profit'), value: adsData.profit === null ? '—' : fmt.format(adsData.profit), sub: t('overview.ads_profit_hint'), warn: adsData.profit !== null && adsData.profit < 0 },
            ].map(k => (
              <div key={k.label} className="rounded-lg bg-neutral-50 px-3 py-2">
                <dt className="text-[11px] text-neutral-400">{k.label}</dt>
                <dd className={`text-[15px] font-semibold tabular-nums ${k.warn ? 'text-red-600' : 'text-neutral-900'}`}>{k.value}</dd>
                {k.sub && <dd className="text-[10px] text-neutral-400">{k.sub}</dd>}
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Venitul pe zile (pe săptămâni la 12 luni) */}
        <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[15px] font-semibold text-neutral-900">{data.days > 90 ? t('overview.chart_title_weekly') : t('overview.chart_title')}</p>
            <p className="text-[12px] text-neutral-400">{t('overview.chart_hint')}</p>
          </div>
          {maxRevenue === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center">
              <ShoppingBag className="h-6 w-6 text-neutral-200" />
              <p className="mt-2 text-[13px] text-neutral-400">{t('overview.no_sales')}</p>
            </div>
          ) : (
            <>
              <div className="h-44 flex items-end gap-[2px]">
                {series.map(s => (
                  <div key={s.day} className="flex-1 h-full flex items-end group"
                    title={t('overview.bar_tooltip', { day: fmtDay(s.day, true), revenue: fmt.format(s.revenue), orders: t('common.orders_count', { count: s.orders }) })}>
                    <div className={`w-full rounded-t-sm transition-colors ${s.revenue > 0 ? 'bg-neutral-900 group-hover:bg-neutral-600' : 'bg-neutral-100'}`}
                      style={{ height: s.revenue > 0 ? `${Math.max(2, (s.revenue / maxRevenue) * 100)}%` : '2px' }} />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-neutral-400">
                <span>{series[0] && fmtDay(series[0].day)}</span>
                <span>{series.length > 2 && fmtDay(series[Math.floor(series.length / 2)].day)}</span>
                <span>{series.length > 1 && fmtDay(series[series.length - 1].day)}</span>
              </div>
            </>
          )}
        </div>

        {/* De unde vin vânzările */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-[15px] font-semibold text-neutral-900 mb-4">{t('overview.sources_title')}</p>
          {sources.length === 0 ? (
            <p className="text-[13px] text-neutral-400 py-8 text-center">{t('overview.no_sales')}</p>
          ) : (
            <div className="space-y-3">
              {sources.map(s => {
                const pct = sourceTotal ? (Number(s.revenue) / sourceTotal) * 100 : 0
                return (
                  <div key={s.source}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span className={s.source === 'google_ads' ? 'font-semibold text-neutral-900' : 'text-neutral-600'}>{t.has(`overview.source_${s.source}`) ? t(`overview.source_${s.source}`) : t('overview.source_unknown')}</span>
                      <span className="tabular-nums text-neutral-500">{fmt.format(Number(s.revenue))} · {fmtInt.format(s.orders)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                      <div className={`h-full rounded-full ${s.source === 'google_ads' ? 'bg-neutral-900' : 'bg-neutral-300'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              <p className="text-[11px] text-neutral-400 pt-1">{t('overview.sources_hint')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Cele mai vândute produse */}
        <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[15px] font-semibold text-neutral-900">{t('overview.top_title')}</p>
            <Link href="/products" className="text-[12px] text-neutral-400 hover:text-neutral-700 flex items-center gap-1">
              {t('overview.view_products')}<ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.top_products.length === 0 ? (
            <p className="text-[13px] text-neutral-400 py-8 text-center">{t('overview.no_sales')}</p>
          ) : (
            <div className="divide-y divide-neutral-50">
              {data.top_products.map((p, i) => {
                const margin = p.cost_price !== null && p.price ? Math.round(((p.price - p.cost_price) / p.price) * 100) : null
                return (
                  <div key={p.offer_id} className="flex items-center gap-3 py-2.5">
                    <span className="w-4 text-[12px] text-neutral-300 tabular-nums">{i + 1}</span>
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50 flex items-center justify-center">
                      {p.image_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={p.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                        : <ImageIcon className="h-4 w-4 text-neutral-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-neutral-900 truncate">{p.title}</p>
                      <p className="text-[11px] text-neutral-400">
                        {p.variant_title ? `${p.variant_title} · ` : ''}{t('catalog.units', { count: Number(p.units) })}
                        {margin !== null && <> · {t('overview.margin', { pct: String(margin) })}</>}
                      </p>
                    </div>
                    <p className="text-[13px] font-semibold text-neutral-900 tabular-nums">{fmt.format(p.revenue)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Magazinul */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-[15px] font-semibold text-neutral-900 flex items-center gap-2 mb-3"><Store className="h-4 w-4 text-neutral-400" />{t('overview.store_title')}</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <a href={store.store_url} target="_blank" rel="noopener" className="text-[13px] font-medium text-neutral-800 truncate hover:text-neutral-950">
                {store.store_name || store.store_url}
              </a>
              <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${store.connection_status === 'revoked' ? 'bg-red-50 text-red-600' : store.connection_status === 'error' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {store.connection_status === 'revoked' ? t('edinio.revoked') : store.connection_status === 'error' ? t('catalog.store_unreachable') : t('settings.connected')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/products" className="bg-neutral-50 hover:bg-neutral-100 rounded-lg p-2.5 text-center transition-colors">
                <p className="text-[15px] font-bold text-neutral-900 tabular-nums">{fmtInt.format(store.offers_count)}</p>
                <p className="text-[11px] text-neutral-400">{t('overview.offers')}</p>
              </Link>
              <div className="bg-neutral-50 rounded-lg p-2.5 text-center">
                <p className="text-[15px] font-bold text-neutral-900 tabular-nums">{fmtInt.format(store.orders_count)}</p>
                <p className="text-[11px] text-neutral-400">{t('overview.orders')}</p>
              </div>
            </div>
            <p className="text-[11px] text-neutral-400 flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              {store.last_sync_at
                ? t('overview.last_sync', { time: new Date(store.last_sync_at).toLocaleString(numberLocale, { dateStyle: 'short', timeStyle: 'short' }) })
                : t('edinio.syncing')}
            </p>
            <div className="pt-1 border-t border-neutral-100">
              <p className="text-[12px] text-neutral-500 flex items-center gap-1.5 pt-2">
                <Megaphone className="h-3.5 w-3.5 text-neutral-400" />
                {data.google.connected
                  ? t('overview.google_connected', { account: data.google.account?.name || data.google.account?.id || '—' })
                  : t('overview.google_not_connected')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
