'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/context'
import { AlertCircle, ImageIcon, Info, Store } from 'lucide-react'

// =============================================
// Rapoarte — ce aduc reclamele Google Ads (din cronul zilnic): cheltuiala,
// valoarea conversiilor, ROAS-ul față de pragul de profit, profitul estimat,
// pe zi, campanie, produs și termen de căutare; plus vânzările de pe site
// pe sursă și cele aduse de campaniile Hontrio.
// =============================================

type Kpi = { cost: number; clicks: number; impressions: number; conversions: number; value: number; roas: number | null; profit: number | null }
type Data = {
  store: { platform: string; supported: boolean; store_name?: string | null; currency?: string } | null
  period?: { days: number; from: string; to: string }
  google?: { connected: boolean; account: { id: string; name: string | null } | null; synced_at: string | null }
  break_even?: number | null
  ads?: {
    total: Kpi
    hontrio: Kpi | null
    daily: { date: string; cost: number; value: number }[]
    campaigns: { id: string; name: string; channel: string; hontrio: boolean; cost: number; clicks: number; conversions: number; value: number; roas: number | null; profit: number | null }[]
    products: { item_id: string; title: string; image_url: string | null; cost: number; clicks: number; conversions: number; value: number; roas: number | null; break_even: number | null; verdict: 'loses' | 'profitable' | 'no_sales' | 'none' }[]
    search_terms: { term: string; cost: number; clicks: number; conversions: number; value: number }[]
  } | null
  sales?: {
    daily: { day: string; revenue: number; google_ads: number; hontrio: number; orders: number }[]
    sources: { source: string; orders: number; revenue: number }[]
    total: { orders: number; revenue: number }
    hontrio: { orders: number; revenue: number }
  } | null
}

const PERIODS = [7, 30, 90]
const VERDICT_STYLE = { loses: 'bg-red-50 text-red-600', profitable: 'bg-emerald-50 text-emerald-700', no_sales: 'bg-amber-50 text-amber-700', none: 'bg-neutral-100 text-neutral-500' } as const

export default function ReportsPage() {
  const { t, intlLocale } = useT()
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async (d: number) => {
    setFailed(false)
    try {
      const r = await fetch(`/api/reports?days=${d}`)
      if (!r.ok) throw new Error()
      setData(await r.json())
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(days) }, [load, days])

  const currency = data?.store?.currency || 'RON'
  const fmt = useMemo(() => {
    try { return new Intl.NumberFormat(intlLocale, { style: 'currency', currency, maximumFractionDigits: 0 }) }
    catch { return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 }) }
  }, [intlLocale, currency])
  const fmtNum = useMemo(() => new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 1 }), [intlLocale])
  const fmtInt = useMemo(() => new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 }), [intlLocale])
  const fmtDay = useCallback((d: string) => new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`)), [intlLocale])

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">{t('reports.title')}</h1>
        <p className="text-[13px] text-neutral-400 mt-0.5">{t('reports.subtitle')}</p>
      </div>
      <div className="flex items-center gap-1 rounded-xl bg-neutral-100 p-1 self-start">
        {PERIODS.map(p => (
          <button key={p} onClick={() => { setDays(p); setLoading(true) }}
            className={`h-8 px-3 rounded-lg text-[12px] font-medium transition-all ${days === p ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}>
            {t('reports.period_days', { count: p })}
          </button>
        ))}
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-5">
        {header}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">{[0, 1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-xl bg-neutral-100 animate-pulse" />)}</div>
        <div className="h-64 rounded-xl bg-neutral-100 animate-pulse" />
      </div>
    )
  }

  if (failed && !data) {
    return (
      <div className="space-y-5">
        {header}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white py-16 text-center">
          <AlertCircle className="h-6 w-6 text-neutral-400" />
          <p className="mt-3 text-[14px] font-medium text-neutral-900">{t('reports.load_error')}</p>
          <button onClick={() => load(days)} className="mt-4 h-9 px-4 rounded-xl bg-neutral-900 text-white text-[13px] font-medium hover:bg-neutral-800">{t('catalog.retry')}</button>
        </div>
      </div>
    )
  }

  if (!data?.store || !data.store.supported) {
    return (
      <div className="space-y-5">
        {header}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white py-16 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100"><Store className="h-6 w-6 text-neutral-500" /></div>
          <p className="mt-4 text-[15px] font-semibold text-neutral-900">{data?.store ? t('catalog.unsupported_title') : t('reports.no_store_title')}</p>
          <p className="mt-1 max-w-md text-[13px] text-neutral-400 leading-relaxed">{data?.store ? t('catalog.unsupported_desc') : t('reports.no_store_desc')}</p>
        </div>
      </div>
    )
  }

  const ads = data.ads ?? null
  const be = data.break_even ?? null
  const sales = data.sales ?? null
  const noAdsReason = !data.google?.connected ? 'reports.no_ads_google' : !data.google.account ? 'reports.no_ads_account' : data.google.synced_at ? 'reports.no_ads_empty' : 'reports.no_ads_waiting'

  const kpis = (k: Kpi) => [
    { label: t('reports.kpi_spend'), value: fmt.format(k.cost) },
    { label: t('reports.kpi_value'), value: fmt.format(k.value) },
    { label: t('reports.kpi_roas'), value: k.roas === null ? '—' : fmtNum.format(k.roas), sub: be !== null ? t('reports.kpi_roas_be', { roas: fmtNum.format(be) }) : undefined, warn: k.roas !== null && be !== null && k.roas < be },
    { label: t('reports.kpi_profit'), value: k.profit === null ? '—' : fmt.format(k.profit), sub: k.profit === null ? t('reports.kpi_profit_need_costs') : t('reports.kpi_profit_sub'), warn: k.profit !== null && k.profit < 0 },
    { label: t('reports.kpi_conversions'), value: fmtNum.format(k.conversions), sub: t('reports.kpi_clicks', { count: k.clicks }) },
  ]

  const maxDaily = Math.max(1, ...(ads?.daily ?? []).flatMap(d => [d.cost, d.value]))
  const maxSales = Math.max(1, ...(sales?.daily ?? []).map(d => Number(d.revenue)))

  return (
    <div className="space-y-5">
      {header}

      {/* Google Ads */}
      {!ads ? (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-[13px] leading-relaxed bg-white border border-neutral-200 text-neutral-600">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-neutral-400" />
          <div>
            <p>{t(noAdsReason)}</p>
            {noAdsReason !== 'reports.no_ads_empty' && noAdsReason !== 'reports.no_ads_waiting' && (
              <Link href="/settings?tab=integrations" className="mt-1 inline-block text-[12px] font-medium text-neutral-900 underline underline-offset-2">{t('reports.go_settings')}</Link>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {kpis(ads.total).map(k => (
              <div key={k.label} className="bg-white border border-neutral-200 rounded-xl p-4">
                <p className="text-[11px] text-neutral-400">{k.label}</p>
                <p className={`mt-1 text-[20px] font-bold tabular-nums leading-tight ${k.warn ? 'text-red-600' : 'text-neutral-900'}`}>{k.value}</p>
                {k.sub && <p className="mt-0.5 text-[11px] text-neutral-400 leading-snug">{k.sub}</p>}
              </div>
            ))}
          </div>
          {ads.hontrio && (
            <p className="text-[12px] text-neutral-500">
              {t('reports.hontrio_line', { spend: fmt.format(ads.hontrio.cost), value: fmt.format(ads.hontrio.value), roas: ads.hontrio.roas === null ? '—' : fmtNum.format(ads.hontrio.roas) })}
            </p>
          )}

          {/* Pe zile: cheltuiala și valoarea conversiilor */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[15px] font-semibold text-neutral-900">{t('reports.daily_title')}</p>
              <div className="flex items-center gap-3 text-[11px] text-neutral-500">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-neutral-900" />{t('reports.kpi_spend')}</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-400" />{t('reports.kpi_value')}</span>
              </div>
            </div>
            <div className="mt-4 flex h-40 items-end gap-[2px]">
              {ads.daily.map(d => (
                <div key={d.date} className="group relative flex h-full flex-1 items-end gap-[1px]"
                  title={t('reports.daily_tooltip', { day: fmtDay(d.date), spend: fmt.format(d.cost), value: fmt.format(d.value) })}>
                  <div className="flex-1 rounded-t-sm bg-neutral-900" style={{ height: `${Math.max(1, (d.cost / maxDaily) * 100)}%` }} />
                  <div className="flex-1 rounded-t-sm bg-emerald-400" style={{ height: `${Math.max(1, (d.value / maxDaily) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-neutral-400">
              <span>{ads.daily[0] ? fmtDay(ads.daily[0].date) : ''}</span>
              <span>{ads.daily.length ? fmtDay(ads.daily[ads.daily.length - 1].date) : ''}</span>
            </div>
          </div>

          {/* Campaniile */}
          <Table title={t('reports.campaigns_title')} empty={t('reports.empty')}
            head={[t('reports.col_campaign'), t('reports.kpi_spend'), t('reports.kpi_value'), t('reports.kpi_roas'), t('reports.kpi_conversions'), t('reports.kpi_profit')]}
            rows={ads.campaigns.map(c => [
              <div key="n" className="min-w-0">
                <p className="text-[13px] font-medium text-neutral-900 truncate">{c.name}</p>
                <p className="text-[11px] text-neutral-400">{t.has(`reports.channel_${c.channel.toLowerCase()}`) ? t(`reports.channel_${c.channel.toLowerCase()}`) : c.channel}{c.hontrio ? ` · ${t('reports.by_hontrio')}` : ''}</p>
              </div>,
              fmt.format(c.cost), fmt.format(c.value),
              <span key="r" className={c.roas !== null && be !== null && c.roas < be ? 'text-red-600 font-semibold' : ''}>{c.roas === null ? '—' : fmtNum.format(c.roas)}</span>,
              fmtNum.format(c.conversions),
              <span key="p" className={c.profit !== null && c.profit < 0 ? 'text-red-600' : ''}>{c.profit === null ? '—' : fmt.format(c.profit)}</span>,
            ])} />

          {/* Produsele */}
          <Table title={t('reports.products_title')} hint={t('reports.products_hint')} empty={t('reports.empty')}
            head={[t('catalog.col_product'), t('reports.kpi_spend'), t('reports.kpi_value'), t('reports.kpi_roas'), t('reports.col_break_even'), t('reports.col_verdict')]}
            rows={ads.products.map(p => [
              <div key="n" className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-neutral-100 bg-neutral-50 flex items-center justify-center">
                  {p.image_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <ImageIcon className="h-3.5 w-3.5 text-neutral-300" />}
                </div>
                <span className="text-[13px] text-neutral-900 line-clamp-2">{p.title}</span>
              </div>,
              fmt.format(p.cost), fmt.format(p.value),
              p.roas === null ? '—' : fmtNum.format(p.roas),
              p.break_even === null ? '—' : fmtNum.format(p.break_even),
              <span key="v" className={`inline-flex text-[11px] font-medium px-1.5 py-0.5 rounded-md ${VERDICT_STYLE[p.verdict]}`}>{t(`reports.verdict_${p.verdict}`)}</span>,
            ])} />

          {/* Termenii de căutare */}
          {ads.search_terms.length > 0 && (
            <Table title={t('reports.terms_title')} hint={t('reports.terms_hint')} empty={t('reports.empty')}
              head={[t('reports.col_term'), t('reports.kpi_spend'), t('reports.kpi_clicks_short'), t('reports.kpi_conversions'), t('reports.kpi_value')]}
              rows={ads.search_terms.map(s => [s.term, fmt.format(s.cost), fmtInt.format(s.clicks), fmtNum.format(s.conversions), fmt.format(s.value)])} />
          )}
        </>
      )}

      {/* Vânzările de pe site */}
      {sales && (
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[15px] font-semibold text-neutral-900">{t('reports.sales_title')}</p>
              <p className="text-[12px] text-neutral-400 mt-0.5">
                {t('reports.sales_hint', { revenue: fmt.format(Number(sales.total.revenue)), orders: t('common.orders_count', { count: Number(sales.total.orders) }) })}
                {Number(sales.hontrio.orders) > 0 && ` ${t('reports.sales_hontrio', { revenue: fmt.format(Number(sales.hontrio.revenue)), orders: t('common.orders_count', { count: Number(sales.hontrio.orders) }) })}`}
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-neutral-500">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-sky-500" />{t('reports.source_google_ads')}</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-neutral-300" />{t('reports.sales_other')}</span>
            </div>
          </div>
          {sales.daily.length === 0 ? (
            <p className="mt-6 text-center text-[13px] text-neutral-400">{t('reports.sales_empty')}</p>
          ) : (
            <div className="mt-4 flex h-32 items-end gap-[2px]">
              {sales.daily.map(d => {
                const total = Number(d.revenue)
                const g = Number(d.google_ads)
                return (
                  <div key={d.day} className="flex h-full flex-1 flex-col justify-end"
                    title={t('reports.sales_tooltip', { day: fmtDay(d.day), revenue: fmt.format(total), google: fmt.format(g) })}>
                    <div className="rounded-t-sm bg-neutral-300" style={{ height: `${Math.max(0, ((total - g) / maxSales) * 100)}%` }} />
                    <div className="bg-sky-500" style={{ height: `${Math.max(0, (g / maxSales) * 100)}%` }} />
                  </div>
                )
              })}
            </div>
          )}
          {sales.sources.length > 0 && (
            <ul className="mt-4 divide-y divide-neutral-100">
              {sales.sources.map(s => (
                <li key={s.source} className="flex items-center justify-between py-2 text-[12px]">
                  <span className="text-neutral-700">{t.has(`overview.source_${s.source}`) ? t(`overview.source_${s.source}`) : s.source}</span>
                  <span className="tabular-nums text-neutral-500">{t('common.orders_count', { count: Number(s.orders) })} · <span className="font-medium text-neutral-900">{fmt.format(Number(s.revenue))}</span></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-neutral-400 leading-relaxed">
        <Info className="h-3.5 w-3.5 shrink-0 mt-px" />{t('reports.footer')}
      </p>
    </div>
  )
}

function Table({ title, hint, head, rows, empty }: { title: string; hint?: string; head: string[]; rows: ReactNode[][]; empty: string }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-neutral-100">
        <p className="text-[15px] font-semibold text-neutral-900">{title}</p>
        {hint && <p className="text-[12px] text-neutral-400 mt-0.5">{hint}</p>}
      </div>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-neutral-400">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead>
              <tr className="border-b border-neutral-100 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                {head.map((h, i) => <th key={h} className={`px-4 py-2.5 ${i ? 'text-right' : ''}`}>{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {rows.map((r, i) => (
                <tr key={i} className="align-middle">
                  {r.map((c, j) => <td key={j} className={`px-4 py-2.5 text-[13px] ${j ? 'text-right tabular-nums text-neutral-700 whitespace-nowrap' : 'max-w-[320px]'}`}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
