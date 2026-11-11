'use client'

import { RefreshCw } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/app/button'
import { Callout, Skeleton } from '@/components/app/feedback'

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

/** Inițiala unui om; adminii ies în evidență, cu negru. */
export function UserAvatar({ name, email, admin, className }: { name: string | null; email?: string; admin?: boolean; className?: string }) {
  return (
    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
      admin ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200', className)}>
      {(name?.[0] ?? email?.[0] ?? 'U').toUpperCase()}
    </span>
  )
}
