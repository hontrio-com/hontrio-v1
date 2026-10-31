'use client'

import { useState } from 'react'
import { AlertTriangle, Clock, FileText, ImageIcon } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { PageHeader } from '@/components/app/page-header'
import { Card } from '@/components/app/surface'
import { StatCard } from '@/components/app/kpi'
import { Segmented } from '@/components/app/tabs'
import { EmptyState, Skeleton } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { useTimeAgo } from '@/components/app/time'
import { useAdminData } from '@/components/admin/use-admin-data'
import { RefreshButton } from '@/components/admin/parts'

// =============================================
// Jurnalul de erori: generările eșuate, cu omul, ce a încercat și de ce a
// picat. Se poate filtra după tip.
// =============================================

type ErrorEntry = { id: string; type: string; detail: string; user: string; created_at: string; error: string }
type ErrorData = { errors: ErrorEntry[]; totalErrors: number; last24h: number }
type Filter = 'all' | 'image_generation' | 'text'

export default function ErrorsPage() {
  const { t } = useT()
  const ago = useTimeAgo()
  const { data, loading, refresh } = useAdminData<ErrorData>('/api/admin/errors')
  const [filter, setFilter] = useState<Filter>('all')

  const jobType = (type: string) => t.has(`admin.job_type_${type}`) ? t(`admin.job_type_${type}`) : type
  const shown = (data?.errors ?? []).filter(e => filter === 'all' || e.type === filter)

  return (
    <FadeIn className="space-y-6">
      <PageHeader title={t('admin.nav_errors')} description={t('admin.errors_subtitle')} actions={<RefreshButton loading={loading} onClick={refresh} />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label={t('admin.errors_total')} value={data?.totalErrors ?? '—'} />
        <StatCard label={t('admin.errors_last_24h')} value={data?.last24h ?? '—'} />
        <StatCard label={t('admin.errors_rate')} value={data ? t('admin.errors_per_day', { value: data.totalErrors > 0 ? data.last24h : 0 }) : '—'} />
      </div>

      <Segmented id="errors-filter" value={filter} onChange={setFilter} items={[
        { value: 'all', label: t('common.all') },
        { value: 'image_generation', label: t('admin.financial_images') },
        { value: 'text', label: t('admin.financial_texts') },
      ]} />

      <Card className="divide-y divide-neutral-100 overflow-hidden">
        {loading && !data ? (
          <div className="space-y-3 p-5">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}</div>
        ) : shown.length === 0 ? (
          <EmptyState icon={<AlertTriangle />} title={t('admin.errors_empty')} />
        ) : shown.map(err => (
          <div key={err.id} className="flex items-start gap-3 px-5 py-3.5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 [&_svg]:size-3.5">
              {err.type === 'image_generation' ? <ImageIcon /> : <FileText />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13px] font-semibold text-neutral-900">{jobType(err.type)}</span>
                <span className="text-[12px] text-neutral-500">{err.user}</span>
              </p>
              <p className="truncate text-[13px] text-neutral-600">{err.detail}</p>
              <p className="mt-0.5 break-words text-[12px] text-red-600">{err.error}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-[12px] text-neutral-400"><Clock className="size-3" />{ago(err.created_at)}</span>
          </div>
        ))}
      </Card>
    </FadeIn>
  )
}
