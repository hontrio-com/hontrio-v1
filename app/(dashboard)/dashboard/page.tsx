'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { AlertCircle, Banknote, Megaphone, Receipt, ShoppingBag, ShoppingCart, Store, Target, TrendingUp, Wallet } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { Button } from '@/components/app/button'
import { Segmented } from '@/components/app/tabs'
import { Callout, EmptyState, Skeleton } from '@/components/app/feedback'
import { Surface } from '@/components/app/surface'
import { useNow, useTimeAgo } from '@/components/app/time'
import { useFormats } from '@/components/app/formats'
import { ConfettiBurst } from '@/components/app/fx/feedback'
import { StatCards, type Stat } from '@/components/dashboard/stat-cards'
import { LaunchWizard } from '@/components/dashboard/launch-wizard'
import { CampaignSurface } from '@/components/dashboard/campaign-surface'
import { StoreSection, type SeriesDay } from '@/components/dashboard/store-section'
import { setupOf, type StepId } from '@/components/dashboard/setup'
import { PERIODS, type OverviewData, type Period } from '@/components/dashboard/types'
import { isRunning } from '@/components/campaigns/live-campaigns'
import type { CampaignsData } from '@/components/campaigns/types'
import type { Plan } from '@/lib/campaigns/plan'

// =============================================
// Dashboard-ul, în designul Bezeno: salutul (cu data și o pastilă de stare),
// patru cifre (primul card negru), suprafața mare cu ce ai de făcut (până la
// prima campanie, asistentul de lansare; după, ce aduc reclamele) și, sub ea,
// „Magazinul tău", pe perioada aleasă.
// =============================================

const subscribe = () => () => {}
const EASE = [0.22, 1, 0.36, 1] as const

/** Ziua de azi în fusul magazinului, ca `AAAA-LL-ZZ`. */
function todayIn(tz: string, now: number): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now))
  } catch {
    return new Date(now).toISOString().slice(0, 10)
  }
}

/** Seria pe zile, cu zilele fără vânzări pe 0; peste 90 de zile, pe săptămâni. */
function buildSeries(daily: SeriesDay[], days: number, today: string): SeriesDay[] {
  const byDay = new Map(daily.map(d => [d.day, d]))
  const [y, m, d] = today.split('-').map(Number)
  const out: SeriesDay[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10)
    const v = byDay.get(key)
    out.push({ day: key, revenue: v ? Number(v.revenue) : 0, orders: v ? Number(v.orders) : 0 })
  }
  if (days <= 90) return out
  const weeks: SeriesDay[] = []
  for (let i = out.length; i > 0; i -= 7) {
    const chunk = out.slice(Math.max(0, i - 7), i)
    weeks.unshift({ day: chunk[0].day, revenue: chunk.reduce((s, x) => s + x.revenue, 0), orders: chunk.reduce((s, x) => s + x.orders, 0) })
  }
  return weeks
}

/** Schimbarea relativă (0,12 = +12%); fără perioadă de comparat, nimic. */
function change(cur: number, prev: number): number | null {
  return prev === 0 ? null : (cur - prev) / prev
}

/** Ultimele 7 zile față de cele 7 dinainte. */
function weekChange(values: number[]): number | null {
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0)
  return change(sum(values.slice(-7)), sum(values.slice(-14, -7)))
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const { t, intlLocale } = useT()
  const now = useNow()
  const ago = useTimeAgo()
  const [days, setDays] = useState<Period>(30)
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  // Planul campaniei: pașii până la lansare, campaniile, propunerile și jurnalul pilotului
  const [campaigns, setCampaigns] = useState<CampaignsData | null>(null)
  const [planLoading, setPlanLoading] = useState(true)
  const [picked, setPicked] = useState<StepId | null>(null)
  const [launched, setLaunched] = useState<{ text: string; key: number } | null>(null)
  // Salutul și data, în fusul omului (calculate în browser, ca la Bezeno)
  const hour = useSyncExternalStore(subscribe, () => new Date().getHours(), () => 12)
  const today = useSyncExternalStore(subscribe, () => new Date().toLocaleDateString(intlLocale, { weekday: 'long', day: 'numeric', month: 'long' }), () => '')

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

  const plan = campaigns?.plan ?? null
  const piloting = (campaigns?.campaigns ?? []).some(isRunning)
  const setup = plan && !piloting ? setupOf(plan) : null
  const proposals = campaigns?.proposals ?? []
  const period = t(`overview.period_${days}`)
  const reloadAll = async () => {
    const [next] = await Promise.all([loadPlan(), load(days)])
    return next
  }

  // ── Salutul ────────────────────────────────────────────────────────────────
  const first = (session?.user?.name || '').split(' ')[0]
  const part = t(hour >= 5 && hour < 12 ? 'dashboard.good_morning' : hour >= 12 && hour < 18 ? 'dashboard.good_afternoon' : 'dashboard.good_evening')
  const status = setup
    ? { text: setup.left <= 1 ? t('home.status_ready') : t('home.status_setup', { count: setup.left }), href: null as string | null }
    : piloting
      ? (proposals.length > 0 ? { text: t('home.proposals_waiting', { count: proposals.length }), href: '/campaigns?tab=pilot' } : { text: t('home.status_pilot'), href: null })
      : null
  const store = data?.store ?? null
  const greeting = (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm text-neutral-400">
          <span className="inline-block first-letter:uppercase">{today}</span>
          {store && <span> · {store.store_name || store.store_url}{store.last_sync_at ? ` · ${t('home.synced', { time: ago(store.last_sync_at) })}` : ''}</span>}
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] text-neutral-950 sm:text-4xl">{part}{first ? `, ${first}` : ''}.</h1>
      </div>
      {status && (() => {
        const pill = (
          <span className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm text-neutral-800">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-black/50 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-black" />
            </span>
            {status.text}
          </span>
        )
        return status.href ? <Link href={status.href} className="transition hover:opacity-80">{pill}</Link> : pill
      })()}
    </motion.div>
  )

  if (loading) {
    return (
      <div>
        <div className="mb-7 space-y-2.5"><Skeleton className="h-4 w-56" /><Skeleton className="h-10 w-96 max-w-full" /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          <div className="h-[236px] animate-pulse rounded-[1.6rem] bg-neutral-900" />
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-[236px] rounded-[1.6rem]" />)}
        </div>
        <Skeleton className="mt-6 h-[420px] rounded-[1.75rem]" />
      </div>
    )
  }

  if (failed && !data) {
    return (
      <div>
        {greeting}
        <Surface>
          <EmptyState icon={<AlertCircle />} title={t('overview.load_error')} description={t('campaigns.load_error_hint')}
            action={<Button variant="primary" onClick={() => load(days)}>{t('catalog.retry')}</Button>} />
        </Surface>
      </div>
    )
  }

  if (!data?.store || !data.store.supported) {
    return (
      <div>
        {greeting}
        <Surface dotted>
          <EmptyState icon={<Store />}
            title={data?.store ? t('catalog.unsupported_title') : t('overview.no_store_title')}
            description={data?.store ? t('catalog.unsupported_desc') : t('overview.no_store_desc')}
            action={!data?.store && <Button asChild variant="primary" size="lg"><Link href="/settings?tab=integrations">{t('catalog.connect_store')}</Link></Button>} />
        </Surface>
      </div>
    )
  }

  // ── Cele patru cifre ───────────────────────────────────────────────────────
  const axis: [string, string] = [t('home.axis_from'), t('home.axis_today')]
  const trend = (d: number | null) => (d === null ? undefined : { text: `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(Math.round(d * 100))}%`, up: d > 0.005 ? true : d < -0.005 ? false : null })
  const ads = data.ads
  const cur = data.overview?.current
  const prev = data.overview?.previous
  let stats: Stat[]
  if (piloting) {
    const s14 = (campaigns?.series ?? []).slice(-14)
    const roasOf = (p: { value: number; cost: number }) => (p.cost > 0 ? p.value / p.cost : 0)
    stats = [
      { key: 'profit', icon: TrendingUp, label: t('home.stat_profit'), value: ads?.profit ?? 0, format: n => f.money.format(Math.round(n)), hint: period,
        series: s14.map(p => Math.max(0, p.profit ?? 0)), axis, trend: trend(weekChange(s14.map(p => p.profit ?? 0))) },
      { key: 'sales', icon: ShoppingBag, label: t('home.stat_sales'), value: ads?.value ?? 0, format: n => f.money.format(Math.round(n)), hint: period,
        series: s14.map(p => p.value), axis, trend: trend(weekChange(s14.map(p => p.value))) },
      { key: 'spend', icon: Wallet, label: t('overview.ads_spend'), value: ads?.cost ?? 0, format: n => f.money.format(Math.round(n)), hint: period,
        series: s14.map(p => p.cost), axis, trend: trend(weekChange(s14.map(p => p.cost))) },
      { key: 'roas', icon: Target, label: 'ROAS', value: ads?.roas ?? 0, format: n => f.num.format(n),
        hint: ads?.break_even != null ? t('overview.ads_roas_be', { roas: f.num.format(ads.break_even) }) : period,
        series: s14.map(roasOf), axis, trend: trend(weekChange(s14.map(roasOf))) },
    ]
  } else {
    const last = series.slice(-14)
    const aov = cur && cur.orders ? cur.revenue / cur.orders : 0
    const prevAov = prev && prev.orders ? prev.revenue / prev.orders : 0
    const share = cur && cur.revenue ? Math.round((cur.google_ads_revenue / cur.revenue) * 100) : 0
    stats = [
      { key: 'revenue', icon: Banknote, label: t('overview.kpi_revenue'), value: cur?.revenue ?? 0, format: n => f.money.format(Math.round(n)), hint: period,
        series: last.map(s => s.revenue), axis, trend: trend(change(cur?.revenue ?? 0, prev?.revenue ?? 0)) },
      { key: 'orders', icon: ShoppingCart, label: t('overview.kpi_orders'), value: cur?.orders ?? 0, format: n => f.int.format(Math.round(n)), hint: period,
        series: last.map(s => s.orders), axis, trend: trend(change(cur?.orders ?? 0, prev?.orders ?? 0)) },
      { key: 'aov', icon: Receipt, label: t('home.chart_aov_short'), value: aov, format: n => f.money.format(Math.round(n)), hint: period,
        series: last.map(s => (s.orders ? s.revenue / s.orders : 0)), axis, trend: trend(change(aov, prevAov)) },
      { key: 'google', icon: Megaphone, label: t('overview.kpi_google_ads'), value: cur?.google_ads_revenue ?? 0, format: n => f.money.format(Math.round(n)),
        hint: t('common.orders_count', { count: cur?.google_ads_orders ?? 0 }), trend: trend(change(cur?.google_ads_revenue ?? 0, prev?.google_ads_revenue ?? 0)),
        footer: (
          <div>
            <div className="mb-1.5 flex justify-between text-[11px] text-neutral-400"><span>{t('home.ads_share')}</span><span className="font-semibold text-neutral-900">{share}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
              <motion.div className="h-full rounded-full bg-black" initial={{ width: 0 }} animate={{ width: `${share}%` }} transition={{ duration: 0.9, ease: EASE }} />
            </div>
          </div>
        ) },
    ]
  }

  return (
    <div>
      {greeting}

      {(data.store.connection_status === 'revoked' || data.store.connection_status === 'error') && (
        <Callout tone="warning" className="mb-6"
          action={data.store.connection_status === 'revoked' && <Button asChild size="sm"><Link href="/settings?tab=integrations">{t('catalog.reconnect')}</Link></Button>}>
          {data.store.connection_status === 'revoked' ? t('catalog.revoked', { platform: data.store.platform_name }) : t('catalog.store_error', { platform: data.store.platform_name })}
          {data.store.connection_status === 'error' && data.store.last_error && <span className="block opacity-80">{translateStored(t, data.store.last_error)}</span>}
        </Callout>
      )}

      {launched && (
        <>
          <ConfettiBurst key={launched.key} />
          <Callout tone="success" onClose={() => setLaunched(null)} className="mb-6">{launched.text}</Callout>
        </>
      )}

      <StatCards stats={stats} />

      {/* Ce ai de făcut: lansarea sau ce aduc reclamele */}
      <div className="mt-6">
        {planLoading ? (
          <Skeleton className="h-[420px] rounded-[1.75rem]" />
        ) : setup && plan ? (
          <LaunchWizard plan={plan} audit={campaigns?.audit ?? null} f={f}
            store={{ name: data.store.store_name, offers: data.store.offers_count, orders: data.store.orders_count }}
            picked={picked} onPick={setPicked} onChanged={reloadAll}
            onLaunched={text => {
              setPicked(null)
              setLaunched({ text, key: Date.now() })
              window.scrollTo({ top: 0, behavior: 'smooth' })
              reloadAll()
            }} />
        ) : piloting ? (
          <CampaignSurface plan={plan} series={campaigns?.series ?? []} days={days} f={f} />
        ) : null}
      </div>

      {/* Magazinul tău (Bezeno · „Your projects") */}
      <section className="mt-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-neutral-950">{t('home.store_title')}</h2>
            <p className="mt-0.5 text-sm text-neutral-500">{t('home.store_hint', { period: period.toLowerCase() })}</p>
          </div>
          <Segmented id="overview-period" value={String(days)} onChange={v => setDays(Number(v) as Period)}
            items={PERIODS.map(p => ({ value: String(p), label: t(`overview.period_short_${p}`) }))} />
        </div>
        <div className="mt-6">
          <StoreSection data={data} series={series} weekly={data.days > 90} f={f} plan={plan}
            proposals={piloting ? proposals : null} journal={campaigns?.journal ?? []} onChanged={reloadAll} />
        </div>
      </section>
    </div>
  )
}
