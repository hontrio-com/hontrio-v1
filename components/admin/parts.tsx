'use client'

import { RefreshCw } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Badge, type Tone } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { Callout, Skeleton } from '@/components/app/feedback'
import { ProgressBar } from '@/components/app/progress'

// =============================================
// Piesele folosite pe mai multe pagini de administrare.
// =============================================

export function RefreshButton({ loading, onClick, label }: { loading?: boolean; onClick: () => void; label?: string }) {
  const { t } = useT()
  return (
    <Button onClick={onClick} disabled={loading}>
      <RefreshCw className={cn(loading && 'animate-spin')} />{label ?? t('common.refresh')}
    </Button>
  )
}

export function LoadError() {
  const { t } = useT()
  return <Callout tone="danger">{t('admin.load_error')}</Callout>
}

/** Scheletul unei pagini de cifre, cât se încarcă. */
export function PageSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <div className={cn('grid grid-cols-2 gap-3', tiles === 5 ? 'lg:grid-cols-5' : tiles === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4')}>
        {Array.from({ length: tiles }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

const PLANS = ['free', 'starter', 'professional', 'enterprise']
const PLAN_TONE: Record<string, Tone> = { free: 'neutral', starter: 'outline', professional: 'outline', enterprise: 'brand' }

export function usePlanLabel() {
  const { t } = useT()
  return (plan: string) => t.has(`credits.plan_${plan}`) ? t(`credits.plan_${plan}`) : plan
}

export function PlanBadge({ plan }: { plan: string }) {
  const label = usePlanLabel()
  return <Badge tone={PLAN_TONE[plan] ?? 'neutral'}>{label(plan)}</Badge>
}

/** Câți oameni are fiecare plan: o bară pe plan, cu numărul și procentul. */
export function PlanDistribution({ plans, total, note }: { plans: Record<string, number>; total: number; note?: (plan: string) => string }) {
  const label = usePlanLabel()
  const known = [...PLANS, ...Object.keys(plans).filter(p => !PLANS.includes(p))]
  return (
    <div className="space-y-3.5">
      {known.map(plan => {
        const count = plans[plan] ?? 0
        const pct = total > 0 ? (count / total) * 100 : 0
        return (
          <div key={plan}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium text-neutral-900">{label(plan)}{note && <span className="ml-2 text-[12px] font-normal text-neutral-400">{note(plan)}</span>}</span>
              <span className="tabular-nums text-neutral-700">{count} <span className="text-neutral-400">({pct.toFixed(1)}%)</span></span>
            </div>
            <ProgressBar value={pct} />
          </div>
        )
      })}
    </div>
  )
}

/** Inițiala unui om; adminii ies în evidență, cu negru. */
export function UserAvatar({ name, email, admin, className }: { name: string | null; email?: string; admin?: boolean; className?: string }) {
  return (
    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
      admin ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200', className)}>
      {(name?.[0] ?? email?.[0] ?? 'U').toUpperCase()}
    </span>
  )
}
