'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { AlertCircle, Store } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { cn } from '@/lib/utils'
import { Button } from '@/components/app/button'
import { Segmented } from '@/components/app/tabs'
import { Callout, EmptyState, Skeleton } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { useNow, useTimeAgo } from '@/components/app/time'
import { useFormats } from '@/components/app/formats'
import { BlurText } from '@/components/app/fx/text'
import { ConfettiBurst } from '@/components/app/fx/feedback'
import { CampaignHero, SetupHero } from '@/components/dashboard/hero'
import { LaunchWizard } from '@/components/dashboard/launch-wizard'
import { StoreSection, type SeriesDay } from '@/components/dashboard/store-section'
import { setupOf, type StepId } from '@/components/dashboard/setup'
import { PERIODS, type OverviewData, type Period } from '@/components/dashboard/types'
import { isRunning } from '@/components/campaigns/live-campaigns'
import type { CampaignsData } from '@/components/campaigns/types'
import type { Plan } from '@/lib/campaigns/plan'

// =============================================
// Dashboard-ul: sus, pe negru, unde e omul — înainte de prima campanie, harta
// drumului până la lansare (cu panoul de pași dedesubt); după, ce aduc
// reclamele. Dedesubt, „Magazinul tău": cifrele perioadei alese, graficul,
// sursele, produsele de top și produsele care pot intra în campanie sau
// pilotul automat.
// =============================================

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
  const live = campaigns?.campaigns ?? []
  const piloting = live.some(isRunning)
  const setup = plan && !piloting ? setupOf(plan) : null
  const period = t(`overview.period_${days}`)

  const openStep = (id: StepId | null) => {
    setPicked(id)
    requestAnimationFrame(() => document.getElementById('setup-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const reloadAll = async () => {
    const [next] = await Promise.all([loadPlan(), load(days)])
    return next
  }

  // ── Antetul paginii ────────────────────────────────────────────────────────
  const userName = session?.user?.name?.split(' ')[0] || ''
  const hour = now ? new Date(now).getHours() : 12
  const greeting = `${t(hour < 12 ? 'dashboard.good_morning' : hour < 18 ? 'dashboard.good_afternoon' : 'dashboard.good_evening')}${userName ? `, ${userName}` : ''}`
  const dateLine = now ? new Intl.DateTimeFormat(intlLocale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(now)) : null
  const ads = data?.ads ?? null
  const summary = setup
    ? (setup.left <= 1 ? t('home.summary_ready') : t('home.summary_setup', { count: setup.left }))
    : piloting
      ? (ads?.profit != null
        ? t(ads.profit >= 0 ? 'home.summary_profit' : 'home.summary_loss', { amount: f.money.format(Math.abs(ads.profit)), period: period.toLowerCase() })
        : t('home.summary_warming'))
      : data?.store?.supported ? t('overview.subtitle_store', { store: data.store.store_name || '' }) : t('overview.subtitle')
  const store = data?.store ?? null
  const synced = store?.last_sync_at ? t('home.synced', { time: ago(store.last_sync_at) }) : store ? t('home.syncing') : null

  const header = (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-medium text-neutral-500">
          {dateLine && <span className="inline-block first-letter:uppercase">{dateLine}</span>}
          {store && (
            <>
              <span className="text-neutral-300">·</span>
              <span className="flex items-center gap-1.5">
                <span className={cn('size-1.5 rounded-full', store.connection_status === 'active' ? 'bg-emerald-500' : 'bg-amber-500')} />
                {store.store_name || store.store_url}
              </span>
              {synced && <><span className="text-neutral-300">·</span><span className="text-neutral-400">{synced}</span></>}
            </>
          )}
        </p>
        <h1 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-[-0.035em] text-neutral-950 sm:text-[32px]">
          <BlurText key={greeting} text={greeting} />
        </h1>
        <p className="mt-1.5 text-[14px] text-neutral-500">{summary}</p>
      </div>
      {store?.supported && (
        <Segmented id="overview-period" value={String(days)} onChange={v => setDays(Number(v) as Period)}
          items={PERIODS.map(p => ({ value: String(p), label: t(`overview.period_short_${p}`) }))} />
      )}
    </header>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2.5"><Skeleton className="h-4 w-56" /><Skeleton className="h-8 w-80 max-w-full" /><Skeleton className="h-4 w-96 max-w-full" /></div>
        <div className="h-[340px] animate-pulse rounded-[22px] bg-neutral-900" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[150px] rounded-[20px]" />)}</div>
      </div>
    )
  }

  if (failed && !data) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-[20px] border border-neutral-200/80 bg-white shadow-card">
          <EmptyState icon={<AlertCircle />} title={t('overview.load_error')} description={t('campaigns.load_error_hint')}
            action={<Button variant="primary" onClick={() => load(days)}>{t('catalog.retry')}</Button>} />
        </div>
      </div>
    )
  }

  if (!data?.store || !data.store.supported) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-[20px] border border-neutral-200/80 bg-white shadow-card">
          <EmptyState icon={<Store />}
            title={data?.store ? t('catalog.unsupported_title') : t('overview.no_store_title')}
            description={data?.store ? t('catalog.unsupported_desc') : t('overview.no_store_desc')}
            action={!data?.store && <Button asChild variant="primary"><Link href="/settings?tab=integrations">{t('catalog.connect_store')}</Link></Button>} />
        </div>
      </div>
    )
  }

  const selected = picked ?? setup?.current ?? 'store'

  return (
    <div className="space-y-6">
      {header}

      {(data.store.connection_status === 'revoked' || data.store.connection_status === 'error') && (
        <Callout tone="warning"
          action={data.store.connection_status === 'revoked' && <Button asChild size="sm"><Link href="/settings?tab=integrations">{t('catalog.reconnect')}</Link></Button>}>
          {data.store.connection_status === 'revoked' ? t('catalog.revoked', { platform: data.store.platform_name }) : t('catalog.store_error', { platform: data.store.platform_name })}
          {data.store.connection_status === 'error' && data.store.last_error && <span className="block opacity-80">{translateStored(t, data.store.last_error)}</span>}
        </Callout>
      )}

      {launched && (
        <>
          <ConfettiBurst key={launched.key} />
          <Callout tone="success" onClose={() => setLaunched(null)}>{launched.text}</Callout>
        </>
      )}

      {/* Sus, pe negru: drumul până la lansare sau ce aduce campania */}
      {planLoading ? (
        <div className="h-[340px] animate-pulse rounded-[22px] bg-neutral-900" />
      ) : setup && plan ? (
        <FadeIn>
          <SetupHero setup={setup} selected={selected} onSelect={id => openStep(id === setup.current ? null : id)} onContinue={() => openStep(null)} />
        </FadeIn>
      ) : piloting ? (
        <FadeIn>
          <CampaignHero ads={ads} series={campaigns?.series ?? []} days={days} period={period} mode={plan?.settings.mode ?? 'approve'}
            proposals={campaigns?.proposals?.length ?? 0} f={f} />
        </FadeIn>
      ) : null}

      {/* Pașii, până la lansare */}
      {setup && plan && (
        <FadeIn delay={0.05}>
          <LaunchWizard plan={plan} audit={campaigns?.audit ?? null} f={f}
            store={{ name: data.store.store_name, offers: data.store.offers_count, orders: data.store.orders_count }}
            picked={picked} onPick={setPicked} onChanged={reloadAll}
            onLaunched={text => {
              setPicked(null)
              setLaunched({ text, key: Date.now() })
              window.scrollTo({ top: 0, behavior: 'smooth' })
              reloadAll()
            }} />
        </FadeIn>
      )}

      {/* Magazinul tău */}
      <section className="space-y-3 pt-2">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-neutral-950">{t('home.store_title')}</h2>
          <p className="mt-0.5 text-[13px] text-neutral-500">{t('home.store_hint', { period: period.toLowerCase() })}</p>
        </div>
        <StoreSection data={data} series={series} weekly={data.days > 90} f={f} plan={plan}
          proposals={piloting ? (campaigns?.proposals ?? []) : null} journal={campaigns?.journal ?? []} onChanged={reloadAll} />
      </section>
    </div>
  )
}
