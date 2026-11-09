'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { AlertCircle, ArrowRight, Check, CircleDashed, ExternalLink, ImageIcon, Megaphone, RefreshCw, ShoppingBag, Store } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardHeader } from '@/components/app/surface'
import { Badge, StatusDot } from '@/components/app/badge'
import { Button, textActionStyles } from '@/components/app/button'
import { Segmented } from '@/components/app/tabs'
import { KpiCard } from '@/components/app/kpi'
import { BarTrend, CHART } from '@/components/app/charts'
import { Callout, EmptyState, Skeleton } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { ProgressBar, ProgressRing } from '@/components/app/progress'
import { useNow } from '@/components/app/time'
import { day, useFormats } from '@/components/app/formats'
import { LaunchWizard } from '@/components/dashboard/launch-wizard'
import { isRunning } from '@/components/campaigns/live-campaigns'
import type { CampaignsData } from '@/components/campaigns/types'
import type { Plan } from '@/lib/campaigns/plan'

// =============================================
// Prezentarea generală — până la prima campanie, asistentul de lansare (toți
// pașii, cu lansarea, într-un singur loc); apoi ce vinde magazinul pe site
// (comparat cu perioada dinainte) și ce aduce Google Ads. Cifrele sunt pe
// perioada aleasă sus, în dreapta.
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
type Metric = 'revenue' | 'orders'

const PERIODS: Period[] = [7, 30, 90, 365]
const SOURCE_ORDER = ['google_ads', 'google_organic', 'meta', 'email', 'other_campaigns', 'referral', 'direct']

/** Schimbarea relativă (0,12 = +12%); fără perioadă de comparat, nimic. */
function change(cur: number, prev: number): number | null {
  return prev === 0 ? null : (cur - prev) / prev
}

/** Ziua de azi în fusul magazinului, ca `AAAA-LL-ZZ`. */
function todayIn(tz: string, now: number): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now))
  } catch {
    return new Date(now).toISOString().slice(0, 10)
  }
}

/**
 * Seria pe zile cu zilele fără vânzări puse pe 0. Peste 90 de zile, pe
 * săptămâni: 365 de bare nu mai spun nimic.
 */
function buildSeries(daily: Overview['daily'], days: number, today: string) {
  const byDay = new Map(daily.map(d => [d.day, d]))
  const [y, m, d] = today.split('-').map(Number)
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

export default function DashboardPage() {
  const { data: session } = useSession()
  const { t } = useT()
  const now = useNow()
  const [days, setDays] = useState<Period>(30)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [metric, setMetric] = useState<Metric>('revenue')
  // Planul campaniei: pașii asistentului și dacă rulează deja o campanie Hontrio
  const [campaigns, setCampaigns] = useState<CampaignsData | null>(null)
  const [planLoading, setPlanLoading] = useState(true)
  const [launchedText, setLaunchedText] = useState<string | null>(null)

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

  const loadPlan = useCallback(async (): Promise<Plan | null> => {
    try {
      const r = await fetch('/api/campaigns/plan')
      if (!r.ok) throw new Error()
      const body = (await r.json()) as CampaignsData
      setCampaigns(body)
      return body.plan
    } catch {
      return null
    } finally {
      setPlanLoading(false)
    }
  }, [])

  useEffect(() => { load(days) }, [days, load])
  useEffect(() => { loadPlan() }, [loadPlan])

  const f = useFormats(data?.store?.currency || 'RON')
  const tz = data?.store?.timezone || 'Europe/Bucharest'
  const series = useMemo(
    () => (data?.overview && now ? buildSeries(data.overview.daily, data.days, todayIn(tz, now)) : []),
    [data, tz, now],
  )

  const userName = session?.user?.name?.split(' ')[0] || ''
  const hour = now ? new Date(now).getHours() : 12
  const greeting = `${t(hour < 12 ? 'dashboard.good_morning' : hour < 18 ? 'dashboard.good_afternoon' : 'dashboard.good_evening')}${userName ? `, ${userName}` : ''}`
  const supported = !!data?.store?.supported
  const header = (
    <PageHeader title={greeting}
      description={supported ? t('overview.subtitle_store', { store: data?.store?.store_name || '' }) : t('overview.subtitle')}
      actions={supported && (
        <Segmented id="overview-period" value={String(days)} onChange={v => setDays(Number(v) as Period)}
          items={PERIODS.map(p => ({ value: String(p), label: t(`overview.period_short_${p}`) }))} />
      )} />
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2"><Skeleton className="h-8 w-72" /><Skeleton className="h-4 w-96 max-w-full" /></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[136px] rounded-xl" />)}</div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3"><Skeleton className="h-[320px] rounded-xl lg:col-span-2" /><Skeleton className="h-[320px] rounded-xl" /></div>
      </div>
    )
  }

  if (failed && !data) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <EmptyState icon={<AlertCircle />} title={t('overview.load_error')} description={t('campaigns.load_error_hint')}
            action={<Button variant="primary" onClick={() => load(days)}>{t('catalog.retry')}</Button>} />
        </Card>
      </div>
    )
  }

  const done = data?.checklist.filter(c => c.done).length ?? 0
  const totalSteps = data?.checklist.length ?? 0
  const ready = totalSteps > 0 && done === totalSteps

  // Până rulează prima campanie Hontrio, asistentul ține locul listei de pași (și duce până la lansare)
  const plan = campaigns?.plan ?? null
  const piloting = (campaigns?.campaigns ?? []).some(isRunning)
  const showWizard = !!plan && !piloting
  const wizard = showWizard && data?.store && (
    <FadeIn>
      <LaunchWizard plan={plan} audit={campaigns?.audit ?? null} f={f}
        store={{ name: data.store.store_name, offers: data.store.offers_count, orders: data.store.orders_count }}
        onChanged={async () => {
          const [next] = await Promise.all([loadPlan(), load(days)])
          return next
        }}
        onLaunched={text => {
          setLaunchedText(text)
          loadPlan()
          load(days)
        }} />
    </FadeIn>
  )
  const wizardSkeleton = planLoading && !ready && <Skeleton className="h-[460px] rounded-xl" />

  const checklistCard = data && !ready && !showWizard && !planLoading && (
    <FadeIn>
      <Card>
        <div className="flex items-center justify-between gap-4 px-5 pt-5">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-900">{t('overview.checklist_title')}</h3>
            <p className="mt-0.5 text-[13px] text-neutral-500">{t('overview.checklist_progress', { done: String(done), total: String(totalSteps) })}</p>
          </div>
          <ProgressRing value={totalSteps ? (done / totalSteps) * 100 : 0} />
        </div>
        <ul className="grid grid-cols-1 gap-2 p-5 sm:grid-cols-2">
          {data.checklist.map(c => {
            // Costurile se măsoară ca în planul campaniei: pe vânzări, când există.
            // Textul pasului vine din date: fără platformă dacă varianta nu are text, altfel unul generic
            const step = `${c.id}${c.variant ? `_${c.variant}` : ''}`
            const label = c.id !== 'costs'
              ? (t.has(`overview.check_${step}`) ? t(`overview.check_${step}`) : t.has(`overview.check_${c.id}`) ? t(`overview.check_${c.id}`) : t('overview.check_generic'))
              : data.costs.basis === 'sales' ? t('overview.check_costs_sales', { pct: String(Math.round(data.costs.coverage * 100)) })
              : t('overview.check_costs', { with: f.int.format(data.costs.with_cost), count: data.costs.total })
            const inner = (
              <span className={cn('group flex h-full items-center gap-3 rounded-lg border px-3 py-2.5 transition-all',
                c.done ? 'border-transparent bg-neutral-50' : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-card')}>
                {c.done
                  ? <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full', c.unverified ? 'bg-neutral-200 text-neutral-500' : 'bg-neutral-900 text-white')}><Check className="size-3" strokeWidth={3} /></span>
                  : <CircleDashed className="size-5 shrink-0 text-neutral-300" />}
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[13px]', c.done ? 'text-neutral-500' : 'font-medium text-neutral-900')}>{label}</span>
                  {c.unverified && <span className="block text-[12px] text-neutral-400">{c.via ? t('overview.check_unverified_via', { via: c.via }) : t('overview.check_unverified')}</span>}
                </span>
                {!c.done && (c.external
                  ? <ExternalLink className="size-3.5 shrink-0 text-neutral-300 group-hover:text-neutral-500" />
                  : <ArrowRight className="size-3.5 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500" />)}
              </span>
            )
            return (
              <li key={c.id}>
                {c.done ? inner : c.external ? <a href={c.href} target="_blank" rel="noopener">{inner}</a> : <Link href={c.href}>{inner}</Link>}
              </li>
            )
          })}
        </ul>
      </Card>
    </FadeIn>
  )

  if (!data?.store || !data.store.supported) {
    return (
      <div className="space-y-6">
        {header}
        {checklistCard}
        <Card>
          <EmptyState icon={<Store />}
            title={data?.store ? t('catalog.unsupported_title') : t('overview.no_store_title')}
            description={data?.store ? t('catalog.unsupported_desc') : t('overview.no_store_desc')}
            action={!data?.store && <Button asChild variant="primary"><Link href="/settings?tab=integrations">{t('catalog.connect_store')}</Link></Button>} />
        </Card>
      </div>
    )
  }

  const store = data.store
  const cur = data.overview?.current
  const prev = data.overview?.previous
  const aov = cur && cur.orders ? cur.revenue / cur.orders : 0
  const prevAov = prev && prev.orders ? prev.revenue / prev.orders : 0
  const adsShare = cur && cur.revenue ? Math.round((cur.google_ads_revenue / cur.revenue) * 100) : 0
  const sources = [...(data.overview?.sources ?? [])].sort((a, b) => SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source))
  const sourceTotal = sources.reduce((s, x) => s + Number(x.revenue), 0)
  const adsData = data.ads
  const hasSales = series.some(s => s.revenue > 0)
  const label = (d: string) => f.shortDate.format(day(d))
  const spark = (key: Metric | 'aov') => (hasSales ? series.map(s => ({ label: label(s.day), value: key === 'aov' ? (s.orders ? s.revenue / s.orders : 0) : s[key] })) : undefined)
  const bars = series.map(s => ({
    label: label(s.day),
    value: s[metric],
    extra: metric === 'revenue' ? t('common.orders_count', { count: s.orders }) : f.money.format(s.revenue),
  }))
  const period = t(`overview.period_${days}`)
  const lastSync = store.last_sync_at ? f.dateTime.format(new Date(store.last_sync_at)) : null

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

      {launchedText && <Callout tone="success" onClose={() => setLaunchedText(null)}>{launchedText}</Callout>}

      {wizard || wizardSkeleton}
      {checklistCard}

      {/* Până la prima campanie, cifrele magazinului vin după asistent, ca fundal */}
      {showWizard && (
        <div className="flex items-end justify-between gap-4 pt-2">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-900">{t('overview.store_numbers_title')}</h2>
            <p className="mt-0.5 text-[13px] text-neutral-500">{t('overview.store_numbers_hint', { period: t(`overview.period_${days}`).toLowerCase() })}</p>
          </div>
        </div>
      )}

      {/* Cifrele perioadei, cu schimbarea față de perioada dinainte */}
      <FadeIn delay={0.03}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label={t('overview.kpi_revenue')} value={cur?.revenue ?? 0} format={n => f.money.format(n)} delta={change(cur?.revenue ?? 0, prev?.revenue ?? 0)}
            series={spark('revenue')} help={t('overview.kpi_revenue_help')} footnote={period} />
          <KpiCard label={t('overview.kpi_orders')} value={cur?.orders ?? 0} format={n => f.int.format(n)} delta={change(cur?.orders ?? 0, prev?.orders ?? 0)}
            series={spark('orders')} help={t('overview.kpi_orders_help')} footnote={period} />
          <KpiCard label={t('overview.kpi_aov')} value={aov} format={n => f.money.format(n)} delta={change(aov, prevAov)}
            series={spark('aov')} color={CHART.neutral} help={t('overview.kpi_aov_help')} footnote={period} />
          <KpiCard label={t('overview.kpi_google_ads')} value={cur?.google_ads_revenue ?? 0} format={n => f.money.format(n)}
            delta={change(cur?.google_ads_revenue ?? 0, prev?.google_ads_revenue ?? 0)} help={t('overview.kpi_google_ads_help')}
            footnote={t('overview.kpi_google_ads_sub', { orders: t('common.orders_count', { count: cur?.google_ads_orders ?? 0 }), share: String(adsShare) })} />
        </div>
      </FadeIn>

      {/* Din Google Ads: ce au costat reclamele și ce au adus, față de pragul de profit */}
      {adsData && (
        <FadeIn delay={0.06}>
          <Card>
            <CardHeader icon={<Megaphone />} title={t('overview.ads_title')} description={period}
              action={<Link href="/reports" className={cn(textActionStyles, 'text-[13px]')}>{t('overview.ads_open_reports')}<ArrowRight /></Link>} />
            <dl className="m-5 mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-neutral-200/70 ring-1 ring-neutral-200/70 sm:grid-cols-4">
              {[
                { label: t('overview.ads_spend'), value: f.money.format(adsData.cost) },
                { label: t('overview.ads_value'), value: f.money.format(adsData.value) },
                {
                  label: t('overview.ads_roas'), value: adsData.roas === null ? '—' : f.num.format(adsData.roas),
                  sub: adsData.break_even !== null ? t('overview.ads_roas_be', { roas: f.num.format(adsData.break_even) }) : undefined,
                  tone: adsData.roas !== null && adsData.break_even !== null && adsData.roas < adsData.break_even ? 'bad' : undefined,
                },
                {
                  label: t('overview.ads_profit'), value: adsData.profit === null ? '—' : f.money.format(adsData.profit), sub: t('overview.ads_profit_hint'),
                  tone: adsData.profit === null ? undefined : adsData.profit < 0 ? 'bad' : adsData.profit > 0 ? 'good' : undefined,
                },
              ].map(k => (
                <div key={k.label} className="bg-white px-4 py-3">
                  <dt className="text-[12px] text-neutral-500">{k.label}</dt>
                  <dd className={cn('mt-1 text-[18px] font-semibold tabular-nums tracking-[-0.015em]', k.tone === 'bad' ? 'text-red-600' : k.tone === 'good' ? 'text-emerald-600' : 'text-neutral-950')}>{k.value}</dd>
                  {k.sub && <p className="mt-0.5 text-[11px] text-neutral-400">{k.sub}</p>}
                </div>
              ))}
            </dl>
          </Card>
        </FadeIn>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Venitul pe zile (pe săptămâni la 12 luni) */}
        <FadeIn delay={0.08} className="lg:col-span-2">
          <Card className="flex h-full flex-col">
            <CardHeader title={data.days > 90 ? t('overview.chart_title_weekly') : t('overview.chart_title')} description={t('overview.chart_hint')}
              action={hasSales && <Segmented id="overview-metric" size="sm" value={metric} onChange={setMetric}
                items={[{ value: 'revenue', label: t('overview.chart_revenue') }, { value: 'orders', label: t('overview.chart_orders') }]} />} />
            {hasSales ? (
              <div className="relative min-h-[240px] flex-1">
                <div className="absolute inset-x-3 bottom-4 top-4">
                  <BarTrend data={bars} height="100%" format={n => (metric === 'revenue' ? f.money.format(n) : t('common.orders_count', { count: Math.round(n) }))}
                    axisFormat={n => f.compact.format(n)} />
                </div>
              </div>
            ) : (
              <EmptyState icon={<ShoppingBag />} title={t('overview.no_sales_title')} description={t('overview.no_sales')} className="flex-1 py-14" />
            )}
          </Card>
        </FadeIn>

        {/* De unde vin vânzările */}
        <FadeIn delay={0.1}>
          <Card className="h-full">
            <CardHeader title={t('overview.sources_title')} description={t('overview.sources_hint')} />
            <div className="px-5 pb-5 pt-4">
              {sources.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-neutral-400">{t('overview.no_sales')}</p>
              ) : (
                <ul className="space-y-3.5">
                  {sources.map(s => {
                    const pct = sourceTotal ? (Number(s.revenue) / sourceTotal) * 100 : 0
                    const ads = s.source === 'google_ads'
                    return (
                      <li key={s.source}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                          <span className={ads ? 'font-semibold text-neutral-900' : 'text-neutral-600'}>
                            {t.has(`overview.source_${s.source}`) ? t(`overview.source_${s.source}`) : t('overview.source_unknown')}
                          </span>
                          <span className="tabular-nums text-neutral-500">
                            <span className="font-medium text-neutral-900">{f.money.format(Number(s.revenue))}</span> · {f.int.format(s.orders)}
                          </span>
                        </div>
                        <ProgressBar value={pct} barClassName={ads ? 'bg-neutral-900' : 'bg-neutral-300'} />
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </Card>
        </FadeIn>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Cele mai vândute produse */}
        <FadeIn delay={0.12} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader title={t('overview.top_title')} description={period}
              action={<Link href="/products" className={cn(textActionStyles, 'text-[13px]')}>{t('overview.view_products')}<ArrowRight /></Link>} />
            {data.top_products.length === 0 ? (
              <p className="px-5 py-12 text-center text-[13px] text-neutral-400">{t('overview.no_sales')}</p>
            ) : (
              <ol className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100">
                {data.top_products.map((p, i) => {
                  const margin = p.cost_price !== null && p.price ? Math.round(((p.price - p.cost_price) / p.price) * 100) : null
                  return (
                    <li key={p.offer_id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-neutral-50/70">
                      <span className="w-4 text-center text-[12px] font-medium tabular-nums text-neutral-400">{i + 1}</span>
                      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-50 ring-1 ring-inset ring-neutral-200/70">
                        {p.image_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={p.image_url} alt="" loading="lazy" className="size-full object-cover" />
                          : <ImageIcon className="size-4 text-neutral-300" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-neutral-900">{p.title}</p>
                        <p className="text-[12px] text-neutral-500">
                          {p.variant_title ? `${p.variant_title} · ` : ''}{t('catalog.units', { count: Number(p.units) })}
                          {margin !== null && <> · {t('overview.margin', { pct: String(margin) })}</>}
                        </p>
                      </div>
                      <p className="text-[13px] font-semibold tabular-nums text-neutral-900">{f.money.format(p.revenue)}</p>
                    </li>
                  )
                })}
              </ol>
            )}
          </Card>
        </FadeIn>

        {/* Magazinul */}
        <FadeIn delay={0.14}>
          <Card className="h-full">
            <CardHeader icon={<Store />} title={t('overview.store_title')}
              action={<Badge tone={store.connection_status === 'revoked' ? 'red' : store.connection_status === 'error' ? 'amber' : 'green'} dot>
                {store.connection_status === 'revoked' ? t('edinio.revoked') : store.connection_status === 'error' ? t('catalog.store_unreachable') : t('settings.connected')}
              </Badge>} />
            <div className="space-y-4 px-5 pb-5 pt-4">
              <a href={store.store_url} target="_blank" rel="noopener" className="group flex items-center gap-1.5 text-[14px] font-medium text-neutral-900">
                <span className="truncate">{store.store_name || store.store_url}</span>
                <ExternalLink className="size-3.5 shrink-0 text-neutral-300 group-hover:text-neutral-500" />
              </a>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-neutral-200/70 ring-1 ring-neutral-200/70">
                <Link href="/products" className="bg-white px-4 py-3 transition-colors hover:bg-neutral-50">
                  <p className="text-[12px] text-neutral-500">{t('overview.offers')}</p>
                  <p className="mt-0.5 text-[18px] font-semibold tabular-nums text-neutral-950">{f.int.format(store.offers_count)}</p>
                </Link>
                <div className="bg-white px-4 py-3">
                  <p className="text-[12px] text-neutral-500">{t('overview.orders')}</p>
                  <p className="mt-0.5 text-[18px] font-semibold tabular-nums text-neutral-950">{f.int.format(store.orders_count)}</p>
                </div>
              </div>
              <p className="flex items-center gap-1.5 text-[12px] text-neutral-500">
                <RefreshCw className="size-3.5 text-neutral-400" />
                {lastSync ? t('overview.last_sync', { time: lastSync }) : t('edinio.syncing')}
              </p>
              <div className="flex items-center gap-2 border-t border-neutral-100 pt-4 text-[13px] text-neutral-600">
                <StatusDot tone={data.google.connected ? 'green' : 'neutral'} />
                {data.google.connected
                  ? t('overview.google_connected', { account: data.google.account?.name || data.google.account?.id || '—' })
                  : <>{t('overview.google_not_connected')} <Link href="/settings?tab=integrations" className={cn(textActionStyles, 'ml-auto text-[13px]')}>{t('overview.google_connect')}<ArrowRight /></Link></>}
              </div>
            </div>
          </Card>
        </FadeIn>
      </div>
    </div>
  )
}
