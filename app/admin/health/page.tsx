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
import { useAdminData } from '@/components/admin/use-admin-data'
import { RefreshButton } from '@/components/admin/parts'

// =============================================
// Starea sistemului: serviciile de care depinde platforma, dacă răspund și
// cât de repede. Se poate lăsa să se verifice singură, la 30 de secunde.
// =============================================

type Check = { name: string; ok: boolean; latency: number; error?: string }
type HealthData = { checks: Check[]; allOk: boolean; checkedAt: string }

const speed = (ms: number) => (ms < 300 ? 'bg-emerald-500' : ms < 1000 ? 'bg-amber-500' : 'bg-red-500')

export default function HealthPage() {
  const { t, intlLocale } = useT()
  const { data, loading, refresh } = useAdminData<HealthData>('/api/admin/health')
  const [auto, setAuto] = useState(false)

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
      ) : (
        <Card className="divide-y divide-neutral-100 overflow-hidden">
          {checks.map(check => (
            <div key={check.name} className="px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  {check.ok ? <CheckCircle2 className="size-[18px] shrink-0 text-emerald-600" /> : <XCircle className="size-[18px] shrink-0 text-red-500" />}
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-neutral-900">{check.name}</p>
                    {check.error && <p className="mt-0.5 break-words text-[12px] text-red-600">{check.error}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-[13px] font-medium tabular-nums text-neutral-700">{t('admin.health_ms', { value: check.latency })}</span>
                  <Badge tone={check.ok ? 'green' : 'red'} dot>{check.ok ? t('admin.health_online') : t('admin.health_offline')}</Badge>
                </div>
              </div>
              {check.latency > 0 && <ProgressBar value={(check.latency / 3000) * 100} className="mt-3 h-1" barClassName={cn(speed(check.latency))} />}
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
