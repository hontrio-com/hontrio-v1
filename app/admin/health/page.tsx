'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/app/page-header'
import { Card } from '@/components/app/surface'
import { Badge, StatusDot } from '@/components/app/badge'
import { Checkbox } from '@/components/app/input'
import { ChartLegend } from '@/components/app/charts'
import { ProgressBar } from '@/components/app/progress'
import { Skeleton } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { useTimeAgo } from '@/components/app/time'
import { useAdminData } from '@/components/admin/use-admin-data'
import { LoadError, RefreshButton } from '@/components/admin/parts'

// =============================================
// Starea sistemului: baza de date (și cât de repede răspunde), cheile OAuth
// pentru Google Ads și cronurile (pilotul și sincronizarea magazinelor), după
// cea mai nouă trecere a lor. Se poate lăsa să se verifice singură, la 30 de
// secunde.
// =============================================

type CheckId = 'database' | 'google_oauth' | 'ads_sync' | 'commerce_sync'
type Check = { id: CheckId; ok: boolean; latency?: number; last_at?: string | null; idle?: boolean }
type HealthData = { checks: Check[]; allOk: boolean; checkedAt: string }

const NAME: Record<CheckId, string> = {
  database: 'admin.health_database',
  google_oauth: 'admin.health_google_oauth',
  ads_sync: 'admin.health_ads_sync',
  commerce_sync: 'admin.health_commerce_sync',
}
const HINT: Record<CheckId, string> = {
  database: 'admin.health_database_hint',
  google_oauth: 'admin.health_google_oauth_hint',
  ads_sync: 'admin.health_ads_sync_hint',
  commerce_sync: 'admin.health_commerce_sync_hint',
}

const speed = (ms: number) => (ms < 300 ? 'bg-emerald-500' : ms < 1000 ? 'bg-amber-500' : 'bg-red-500')

export default function HealthPage() {
  const { t, intlLocale } = useT()
  const ago = useTimeAgo()
  const { data, loading, refresh } = useAdminData<HealthData>('/api/admin/health')
  const [auto, setAuto] = useState(false)

  /** Ce s-a găsit: timpul de răspuns, cheile sau cea mai nouă trecere a cronului. */
  const detail = (c: Check): string => {
    if (c.id === 'database') return c.ok ? t('admin.health_ms', { value: c.latency ?? 0 }) : t('admin.health_database_down')
    if (c.id === 'google_oauth') return c.ok ? t('admin.health_configured') : t('admin.health_not_configured')
    if (c.idle) return t('admin.health_idle')
    if (!c.last_at) return t('admin.health_never')
    return c.ok ? t('admin.health_last_run', { when: ago(c.last_at) }) : t('admin.health_stale', { when: ago(c.last_at) })
  }

  useEffect(() => {
    if (!auto) return
    const timer = setInterval(refresh, 30_000)
    return () => clearInterval(timer)
  }, [auto, refresh])

  const checks = data?.checks ?? []

  return (
    <FadeIn className="space-y-6">
      <PageHeader title={t('admin.nav_health')}
        description={data ? t('admin.health_checked_at', { time: new Date(data.checkedAt).toLocaleTimeString(intlLocale) }) : t('admin.health_checking')}
        actions={(
          <>
            <Checkbox checked={auto} onChange={setAuto} className="mr-1">{t('admin.health_auto')}</Checkbox>
            <RefreshButton loading={loading} onClick={refresh} label={t('admin.health_check')} />
          </>
        )} />

      {data && (
        <Card className="flex items-center gap-3 p-5">
          <StatusDot tone={data.allOk ? 'green' : 'red'} live className="size-2.5" />
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">{data.allOk ? t('admin.health_all_ok') : t('admin.health_issues')}</p>
            <p className="mt-0.5 text-[13px] text-neutral-500">{t('admin.health_services_online', { ok: checks.filter(c => c.ok).length, total: checks.length })}</p>
          </div>
        </Card>
      )}

      {loading && !data ? (
        <Card className="space-y-3 p-5">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12" />)}</Card>
      ) : !data?.checks ? (
        <LoadError />
      ) : (
        <Card className="divide-y divide-neutral-100 overflow-hidden">
          {checks.map(check => (
            <div key={check.id} className="px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  {check.ok ? <CheckCircle2 className="size-[18px] shrink-0 text-emerald-600" /> : <XCircle className="size-[18px] shrink-0 text-red-500" />}
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-neutral-900">{t(NAME[check.id])}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-neutral-500">{t(HINT[check.id])}</p>
                    <p className={cn('mt-0.5 break-words text-[12px] font-medium', check.ok ? 'text-neutral-700' : 'text-red-600')}>{detail(check)}</p>
                  </div>
                </div>
                <Badge tone={check.ok ? 'green' : 'red'} dot className="shrink-0">{check.ok ? t('admin.health_ok') : t('admin.health_problem')}</Badge>
              </div>
              {check.id === 'database' && check.ok && !!check.latency && (
                <ProgressBar value={(check.latency / 3000) * 100} className="mt-3 h-1" barClassName={cn(speed(check.latency))} />
              )}
            </div>
          ))}
        </Card>
      )}

      {data && (
        <ChartLegend items={[
          { label: t('admin.health_legend_fast'), className: 'bg-emerald-500' },
          { label: t('admin.health_legend_ok'), className: 'bg-amber-500' },
          { label: t('admin.health_legend_slow'), className: 'bg-red-500' },
        ]} />
      )}
    </FadeIn>
  )
}
